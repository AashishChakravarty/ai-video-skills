# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["faster-whisper>=1.0"]
# ///
"""
prep_ref.py: turns any recording into a voice-cloning reference: a clean 6-10 s passage that starts after
leading silence and ends on a pause, plus its transcript (cached faster-whisper large-v3). Prints JSON
{"audio", "text", "start", "end"}.

  uv run prep_ref.py --audio my-voice.m4a --out refs/me.wav [--lang hi] [--min 6] [--max 10]
"""
import argparse
import json
import re
import subprocess
import sys

from faster_whisper import WhisperModel


def silences(path, db=-38.0, min_len=0.15):
    err = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", f"silencedetect=noise={db}dB:d={min_len}", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", err)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    return starts, ends


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--lang", default="en")
    ap.add_argument("--min", type=float, default=6.0)
    ap.add_argument("--max", type=float, default=10.0)
    args = ap.parse_args()

    starts, ends = silences(args.audio)
    begin = next((e for s, e in zip(starts, ends) if s < 0.05 and e < 1.5), 0.0)
    cuts = [s for s in starts if args.min <= s - begin <= args.max]
    end = cuts[-1] if cuts else begin + args.max
    subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", f"{begin:.3f}", "-to", f"{end:.3f}", "-i", args.audio, "-ac", "1", "-ar", "24000", args.out],
        check=True,
    )

    model = WhisperModel("large-v3", device="cpu", compute_type="int8")
    segments, _ = model.transcribe(args.out, language=args.lang, beam_size=5)
    text = " ".join(s.text.strip() for s in segments).strip()
    print(json.dumps({"audio": args.out, "text": text, "start": round(begin, 3), "end": round(end, 3)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
