# /// script
# requires-python = ">=3.10,<3.12"
# dependencies = ["chatterbox-tts>=0.1.4", "soundfile", "setuptools<80"]
# ///
"""
tts_chatterbox.py: local Resemble Chatterbox Multilingual TTS (MIT) for ai-video-skills. Loads the model once and
renders every job in a jobs file, so a reel's scenes share one warm model.

  uv run tts_chatterbox.py --jobs jobs.json [--lang hi] [--ref voice.wav] [--exaggeration 0.5] [--cfg 0.5] [--seed 7]
  uv run tts_chatterbox.py --warmup        # download and load the model only

jobs.json is [{"id": "hook", "text": "...", "out": "/abs/path/hook.wav", "exaggeration": 0.75}, ...] (exaggeration optional). --ref clones the voice in a
clean 5-15s clip; without it the model's default voice is used.
"""
import argparse
import json
import random
import sys

import numpy as np
import soundfile as sf
import torch


def pick_device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    return "cuda" if torch.cuda.is_available() else "cpu"


def load_model(device: str):
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    # Checkpoints are saved from CUDA; without a default map_location they fail to load on MPS/CPU.
    original = torch.load
    torch.load = lambda *a, **k: original(*a, **{"map_location": torch.device(device), **k})
    try:
        return ChatterboxMultilingualTTS.from_pretrained(device=device)
    finally:
        torch.load = original


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--jobs")
    ap.add_argument("--lang", default="en")
    ap.add_argument("--ref")
    ap.add_argument("--exaggeration", type=float, default=0.5)
    ap.add_argument("--cfg", type=float, default=0.5)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--warmup", action="store_true")
    args = ap.parse_args()

    device = pick_device()
    model = load_model(device)
    print(f"chatterbox ready on {device} (sr={model.sr})", file=sys.stderr)
    if args.warmup:
        return 0

    jobs = json.load(open(args.jobs, encoding="utf-8"))
    for job in jobs:
        random.seed(args.seed)
        np.random.seed(args.seed)
        torch.manual_seed(args.seed)
        wav = model.generate(
            job["text"],
            language_id=args.lang,
            audio_prompt_path=args.ref,
            exaggeration=job.get("exaggeration", args.exaggeration),
            cfg_weight=args.cfg,
        )
        sf.write(job["out"], wav.squeeze(0).cpu().numpy(), model.sr)
        print(f"wrote {job['out']}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
