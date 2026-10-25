# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["stable-ts>=2.17", "faster-whisper>=1.0"]
# ///
"""
align.py: forced-aligns the approved narration (vo.txt) to the voice-over and writes words.json — the same
shape as the Elixir reel's vo.aligned.json: { audio, duration, scenes[{id,start,end,narration}], words[{word,start,end}] }.
Words keep the script's exact spelling (any script, mixed-language terms included), so subtitles never show
Whisper's misspellings. Uses faster-whisper large-v3 through stable-ts (downloaded once to the Hugging Face cache).

  uv run align.py --audio audio/vo.wav --vo vo.txt --out words.json [--lang hi] [--model large-v3] [--compare ref.json]

--lang defaults to the language in the reel.json next to --out.
"""
import argparse
import json
import os
import re
import statistics
import subprocess
import sys

import stable_whisper


def parse_vo(text: str):
    scenes = []
    for line in text.splitlines():
        head = re.match(r"^\s*\[([\w-]+)\]\s*$", line)
        if head:
            scenes.append({"id": head.group(1), "text": ""})
        elif line.strip():
            if not scenes:
                raise SystemExit(f"vo.txt: text before the first [scene-id] header: {line.strip()!r}")
            scenes[-1]["text"] = (scenes[-1]["text"] + " " + line.strip()).strip()
    if not scenes:
        raise SystemExit("vo.txt has no [scene-id] blocks")
    return scenes


def duration(path: str) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def silences(path: str, db: float, min_len: float, total: float):
    """[(start, end)] of every pause quieter than `db` dBFS for at least `min_len` seconds (a trailing one ends at `total`)."""
    out = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", f"silencedetect=noise={db}dB:d={min_len}", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    if len(starts) > len(ends):
        ends.append(total)
    return list(zip(starts, ends))


SENTENCE_END = re.compile(r"[।॥.!?…,;:]$")


def snap_to_pauses(words, pauses):
    """Moves word edges out of detected pauses, and starts a word that follows sentence punctuation at the
    nearest pause end. The aligner tends to start words early, inside the pause before them."""
    for k, w in enumerate(words):
        for s0, s1 in pauses:
            if s0 <= w["start"] < s1:
                w["start"] = round(s1, 3)
            if s0 < w["end"] <= s1 and s0 - w["start"] >= 0.05:
                w["end"] = round(s0, 3)
        if k and SENTENCE_END.search(words[k - 1]["word"]):
            near = [s1 for s0, s1 in pauses if -0.3 <= s1 - w["start"] <= 0.7]
            if near:
                w["start"] = round(min(near, key=lambda s1: abs(s1 - w["start"])), 3)
                words[k - 1]["end"] = min(words[k - 1]["end"], w["start"])
    return words


MIN_WORD = 0.12
SQUASHED = 0.08


def repair(words, pauses, total):
    """Makes timings usable for karaoke captions: starts strictly increase; a run of words the aligner squashed
    together (each under 80 ms, typically a failed tail) is spread over the time up to the next word or the end
    of speech, by length; a too-short word shares its span with the adjacent next word; ends never overlap."""
    for k in range(1, len(words)):
        words[k]["start"] = max(words[k]["start"], words[k - 1]["start"] + 0.02)
    speech_end = pauses[-1][0] if pauses and pauses[-1][1] >= total - 0.05 else total
    k = 0
    while k < len(words):
        if words[k]["end"] - words[k]["start"] >= SQUASHED:
            k += 1
            continue
        j = k
        while j + 1 < len(words) and words[j + 1]["end"] - words[j + 1]["start"] < SQUASHED:
            j += 1
        a = words[k]["start"]
        b = words[j + 1]["start"] if j + 1 < len(words) else speech_end
        if (j > k or j == len(words) - 1) and b - a > SQUASHED * (j - k + 1):
            weights = [len(w["word"]) + 2 for w in words[k:j + 1]]
            t = a
            for w, wt in zip(words[k:j + 1], weights):
                w["start"] = round(t, 3)
                t += (b - a) * wt / sum(weights)
                w["end"] = round(t, 3)
        k = j + 1
    for k in range(len(words) - 1):
        w, nxt = words[k], words[k + 1]
        span = nxt["end"] - w["start"]
        if w["end"] - w["start"] < MIN_WORD and nxt["start"] - w["end"] < 0.05 and span > 0.12:
            wa, wb = len(w["word"]) + 2, len(nxt["word"]) + 2
            cut = w["start"] + max(span * wa / (wa + wb), min(MIN_WORD, span / 2))
            w["end"] = nxt["start"] = round(min(cut, nxt["end"] - 0.06), 3)
    for k, w in enumerate(words):
        limit = words[k + 1]["start"] if k + 1 < len(words) else total
        w["end"] = round(min(max(w["end"], w["start"] + MIN_WORD), limit), 3)
    return words


def spans(tokens):
    """Character span of each token inside the tokens joined without whitespace."""
    out, pos = [], 0
    for t in tokens:
        out.append((pos, pos + len(t)))
        pos += len(t)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", required=True)
    ap.add_argument("--vo", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--lang")
    ap.add_argument("--model", default="large-v3")
    ap.add_argument("--compare")
    ap.add_argument("--silence-db", type=float, default=-38.0)
    ap.add_argument("--no-snap", action="store_true")
    args = ap.parse_args()

    if not args.lang:
        reel = os.path.join(os.path.dirname(os.path.abspath(args.out)), "reel.json")
        args.lang = json.load(open(reel, encoding="utf-8")).get("language", "en") if os.path.exists(reel) else "en"

    scenes = parse_vo(open(args.vo, encoding="utf-8").read())
    tokens = [w for s in scenes for w in s["text"].split()]
    text = " ".join(tokens)

    model = stable_whisper.load_faster_whisper(args.model, device="cpu", compute_type="int8")
    result = model.align(args.audio, text, language=args.lang, original_split=False)
    aligned = [w for seg in result.segments for w in seg.words]

    # Map stable-ts words back onto the script's whitespace tokens by character offsets, so a token
    # that the aligner split ("Hey" + "!") still gets one start/end.
    flat = []
    for w in aligned:
        for ch in w.word.strip():
            if not ch.isspace():
                flat.append((w.start, w.end))
    joined = "".join(tokens)
    if len(flat) != len(re.sub(r"\s", "", joined)):
        raise SystemExit(f"aligner changed the text ({len(flat)} vs {len(joined)} characters); check vo.txt for unusual characters")

    total = duration(args.audio)
    words, prev_end = [], 0.0
    for tok, (a, b) in zip(tokens, spans(tokens)):
        start = max(prev_end, round(flat[a][0], 3))
        end = max(start + 0.02, round(flat[b - 1][1], 3))
        words.append({"word": tok, "start": start, "end": min(end, total)})
        prev_end = start
    pauses = silences(args.audio, args.silence_db, 0.12, total)
    if not args.no_snap:
        snap_to_pauses(words, pauses)
    repair(words, pauses, total)

    out_scenes, i = [], 0
    for k, s in enumerate(scenes):
        n = len(s["text"].split())
        chunk = words[i:i + n]
        out_scenes.append({
            "id": s["id"],
            "start": 0.0 if k == 0 else chunk[0]["start"],
            "end": chunk[-1]["end"],
            "narration": s["text"],
        })
        i += n

    doc = {"audio": os.path.relpath(args.audio, os.path.dirname(os.path.abspath(args.out))), "duration": round(total, 3), "scenes": out_scenes, "words": words}
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)

    short = sum(1 for w in words if w["end"] - w["start"] < 0.06)
    print(f"words.json: {len(words)} words, {len(out_scenes)} scenes, {total:.3f}s; {short} words under 60 ms")
    for s in out_scenes:
        print(f"  [{s['id']}] {s['start']:.2f}–{s['end']:.2f}s")

    if args.compare:
        ref = json.load(open(args.compare, encoding="utf-8"))["words"]
        if len(ref) != len(words):
            print(f"compare: word counts differ ({len(words)} vs {len(ref)})")
        else:
            d = sorted(abs(a["start"] - b["start"]) for a, b in zip(words, ref))
            print(f"compare vs {args.compare}: median |Δstart| {statistics.median(d):.3f}s, p90 {d[int(0.9 * len(d))]:.3f}s, max {d[-1]:.3f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
