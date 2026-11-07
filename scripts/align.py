# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["stable-ts>=2.17", "faster-whisper>=1.0"]
# ///
"""
align.py: forced-aligns the approved narration (vo.txt) to the voice-over and writes words.json — the same
shape as the Elixir reel's vo.aligned.json: { audio, duration, scenes[{id,start,end,narration}], words[{word,start,end}] }.
Words keep the script's exact spelling (any script, mixed-language terms included), so subtitles never show
Whisper's misspellings. Uses faster-whisper large-v3 through stable-ts (downloaded once to the Hugging Face cache).
When the voice-over is tts.mjs takes joined by digital silence, each scene is aligned on its own (a whole-reel pass
drifts on long takes). --score rates one take: words the aligner can barely match (a misread "status", a slurred
"banks") and the mean match, so tts.mjs --seeds can keep the cleanest of several takes.

  uv run align.py --audio audio/vo.wav --vo vo.txt --out words.json [--lang hi] [--model large-v3] [--compare ref.json]
  uv run align.py --audio audio/takes/pending.wav --vo vo.txt --score pending      (one take's unclear words, as JSON)

--lang defaults to the language in the reel.json next to --out (or vo.txt).
"""
import argparse
import json
import os
import re
import statistics
import subprocess
import sys
import tempfile

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


UNCLEAR_P = 0.2


def align_chars(model, audio, groups, lang, total):
    """(start, end, probability) for every non-space character of the narration, from stable-ts. `groups` holds each
    scene's tokens; when the voice-over is takes joined by digital silence (tts.mjs), each scene is aligned on its own,
    so one hard passage can't pull the rest of the reel out of sync (whole-reel alignment drifts)."""
    gaps = [g for g in silences(audio, -90.0, 0.25, total) if g[0] > 0.05 and g[1] < total - 0.05]
    parts = []
    if len(groups) > 1 and len(gaps) == len(groups) - 1:
        bounds = zip([0.0] + [g[1] for g in gaps], [g[0] for g in gaps] + [total])
        with tempfile.TemporaryDirectory() as tmp:
            for k, (toks, (a, b)) in enumerate(zip(groups, bounds)):
                clip = os.path.join(tmp, f"{k}.wav")
                subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{a:.3f}", "-to", f"{b:.3f}", "-i", audio, "-ac", "1", "-ar", "16000", clip], check=True)
                parts.append((model.align(clip, " ".join(toks), language=lang, original_split=False), a))
    else:
        parts.append((model.align(audio, " ".join(t for toks in groups for t in toks), language=lang, original_split=False), 0.0))
    return [(w.start + off, w.end + off, w.probability) for res, off in parts for seg in res.segments for w in seg.words for ch in w.word.strip() if not ch.isspace()]


def token_times(tokens, flat):
    """Per script token: (start, end, probability, length) from its characters, so a token the aligner split ("Hey" +
    "!") still gets one span; the probability is its lowest character's, so a misread word shows as a low one."""
    if len(flat) != sum(map(len, tokens)):
        raise SystemExit(f"aligner changed the text ({len(flat)} vs {sum(map(len, tokens))} characters); check vo.txt for unusual characters")
    return [(flat[a][0], flat[b - 1][1], min(x[2] for x in flat[a:b]), flat[b - 1][1] - flat[a][0]) for a, b in spans(tokens)]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", required=True)
    ap.add_argument("--vo", required=True)
    ap.add_argument("--out")
    ap.add_argument("--lang")
    ap.add_argument("--model", default="large-v3")
    ap.add_argument("--compare")
    ap.add_argument("--silence-db", type=float, default=-38.0)
    ap.add_argument("--no-snap", action="store_true")
    ap.add_argument("--score", metavar="SCENE", help="score one take (--audio) against that scene of vo.txt: prints JSON with its unclear words; writes nothing")
    args = ap.parse_args()
    if not args.out and not args.score:
        ap.error("--out is required (or --score SCENE)")

    reel_dir = os.path.dirname(os.path.abspath(args.out or args.vo))
    if not args.lang:
        reel = os.path.join(reel_dir, "reel.json")
        args.lang = json.load(open(reel, encoding="utf-8")).get("language", "en") if os.path.exists(reel) else "en"

    scenes = parse_vo(open(args.vo, encoding="utf-8").read())
    if args.score:
        scenes = [s for s in scenes if s["id"] == args.score]
        if not scenes:
            raise SystemExit(f"--score: no scene [{args.score}] in {args.vo}")
    groups = [s["text"].split() for s in scenes]
    tokens = [w for g in groups for w in g]

    model = stable_whisper.load_faster_whisper(args.model, device="cpu", compute_type="int8")
    total = duration(args.audio)
    times = token_times(tokens, align_chars(model, args.audio, groups, args.lang, total))
    if args.score:
        unclear = [(tok, round(t[0], 2), round(t[2], 2)) for tok, t in zip(tokens, times) if t[2] < UNCLEAR_P or t[3] < 0.06]
        print(json.dumps({"scene": args.score, "unclear": unclear, "mean": round(statistics.mean(t[2] for t in times), 3)}, ensure_ascii=False))
        return 0

    words, prev_end = [], 0.0
    for tok, (t0, t1, _, _) in zip(tokens, times):
        start = max(prev_end, round(t0, 3))
        end = max(start + 0.02, round(t1, 3))
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
