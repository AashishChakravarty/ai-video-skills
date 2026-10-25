# Voice-over and words (stages 3–4)

Commands run from `~/.claude/skills/ai-video-skills/scripts` with `--reel <reel folder>` (or from inside the reel
folder). The language comes from the reel (set from the config's `language` when the reel was created); the
default local engine is `tts.default` in the config.

## The audio script and the four ways to make the voice

After the script gate, `node script.mjs audio` writes `audio-script.md`: an **ElevenLabs block** (audio tags
kept, pronunciation fixes applied), a **plain block** (tags removed, pauses as "…") and a per-scene table.
Show the user the path and the ElevenLabs block, then ask how they want the voice made:

| Option | What happens | Best for |
|---|---|---|
| 1. Generated locally | `tts.mjs` with VoiceStudio, Chatterbox or macOS say (table below) | free, private, your saved voices |
| 2. ElevenLabs | user pastes the ElevenLabs block into Eleven v3, downloads the MP3 | richest delivery: every audio tag is acted |
| 3. Another platform | user pastes the plain block; puts the delivery notes in the platform's style field | Sarvam Bulbul (Indian voices and accents), Google Gemini TTS / AI Studio, OpenAI TTS (instructions field), Azure Speech, Murf, … |
| 4. Own recording | user reads the plain block (phone or mic, quiet room) | your real voice |

Bring a file back with `tts.mjs --engine file`: one file for the whole reel (`--input take.mp3`), or one per
scene (`--scene hook --input hook.mp3`, stitched once every scene has a take). Imports get the same treatment
as generated audio: edge silence trimmed, the `--tail` added, loudness to −16 LUFS. Remind the user to check
the platform's licence for commercial use and that cloned voices need the speaker's consent.

## Audio tags by engine

| Tag kind | ElevenLabs (v3) | VoiceStudio (OmniVoice) | Chatterbox | macOS say |
|---|---|---|---|---|
| `[pause]`, `[short pause]`, `[long pause]` | kept | `[pause 400ms]` (250 / 800) | "…" | `[[slnc 400]]` |
| `[laughing]` `[chuckling]` `[sighing]` `[gasping]` `[scoffing]` | kept | `[laughter]` `[sigh]` `[surprise-ah]` `[dissatisfaction-hnn]` | dropped | dropped |
| other vocalizations | kept | dropped | dropped | dropped |
| emotion / delivery / character | kept, acted where placed | dropped (its `instruct` is voice design, not emotion) | sets the scene's exaggeration: 0.75 lively, 0.3 calm | dropped |
| sound effects | kept, generated in the audio | dropped | dropped | dropped |

`tts.mjs` prints every tag it could not voice per scene; add important sound effects to the version's
cues.json instead (mix.mjs).

## Local engines

| Engine | Licence | Languages | Voice choice | Speed on an Apple-silicon Mac | Use it for |
|---|---|---|---|---|---|
| **VoiceStudio** ([voicestudio.sh](https://voicestudio.sh), OmniVoice engine) | AGPL app, Apache-2.0 model; called over its local API only | 600+ (good Hindi + English code-mix) | saved voices (clone or designed), or clone from any recording | ~30–40 s per scene | default: best quality, your own voices |
| **Chatterbox Multilingual** (Resemble AI) | MIT | 23, incl. English, Hindi, Spanish, French, German | default voice, or clone from a 5–15 s clip | slower; first run downloads ~3 GB | second opinion / a different timbre |
| **macOS say** | built in | whatever system voices are installed (`--voices`) | best installed voice for the language, or `--voice` / config `tts.sayVoice` | instant | draft timing only, never publish |
| **Your recording** (`--engine file`) | yours | any | — | — | your real voice; record from the approved script |

```bash
node tts.mjs --engine voicestudio --voices                 # saved VoiceStudio voices (ids)
node tts.mjs --engine voicestudio --voice <id> --sample    # opening sentence → audio/samples/
node tts.mjs --engine chatterbox --voice me.wav --sample   # clone any recording
node tts.mjs --engine voicestudio --voice <id>             # all scenes → audio/takes/*.wav → audio/vo.wav
node tts.mjs --engine voicestudio --voice <id> --scene processes   # re-take one scene, re-stitch
node tts.mjs --engine file --input ~/Downloads/eleven.mp3     # import a whole-reel file (ElevenLabs, recording…)
node tts.mjs --engine file --scene hook --input hook.mp3     # or one file per scene
```

Options: `--speed 1.05` (slightly faster reads better on reels), `--seed 7` (same seed = same take),
`--quality 32` (VoiceStudio diffusion steps: 8 draft, 16 default, 32 best), `--instruct "indian accent"`
(VoiceStudio voice-design attributes, also applied on top of a cloned voice: gender, age, pitch, whisper and an
accent — american, british, australian, canadian, indian, chinese, japanese, korean, portuguese, russian),
`--gap 0.35` (silence between scenes), `--tail 1.5` (silence after the last word, so the end card holds ≥ 2 s).
Without `--voice` / `--instruct`, tts.mjs uses the config's default voice (`tts.voicestudioProfile`,
`tts.chatterboxRef`, `tts.sayVoice`) and `tts.instruct`.

How it behaves, so you can explain failures:
- VoiceStudio is opened automatically when its API (127.0.0.1:3900) is down.
- A saved clone made from a long clip (> 20 s) makes VoiceStudio ask for a speech-to-text model. tts.mjs
  then downloads the clip, cuts a clean 6–10 s passage at a pause, transcribes it with the cached Whisper
  model (`tts/prep_ref.py`) and clones from that. The prepared reference is cached in `audio/refs/`.
- Each scene is a separate take, trimmed of edge silence and joined with `--gap`; the result is normalised
  to −16 LUFS mono 48 kHz. reel.json gets `audio = { vo, duration, frames }`.

## Choosing the voice (gate 2a)

Offer 2–3 samples of the opening sentence (the default voice first, then e.g. a designed voice or Chatterbox)
and give their paths so the user can listen (`open <file>` plays it). Let them pick, then render the full VO.
For an Indian audience include a sample with `--instruct "indian accent"`. If they pick a non-default voice,
offer to save it: `config.mjs set tts.voicestudioProfile=<id> "tts.instruct=indian accent"`.

## Pronunciation

A Hindi voice-over written as Hinglish keeps tech terms in Latin script ("Elixir में data…"). Voices read
Latin-script words with an English (usually American) accent: "data" comes out as "day-ta" instead of the
Indian "डाटा". The voice should read them respelled in Devanagari, the way the audience says them, while
subtitles keep the script's spelling.

Respellings come from three layers, later ones winning:

| Layer | File | Holds |
|---|---|---|
| starter | `pronounce/<lang>.json` in the skill | ~130 common tech words for Hindi (data → डाटा, server → सर्वर, cache → कैश) |
| personal | `~/.config/ai-video-skills/pronounce/<lang>.json` | every fix the user has made; shared by all their reels |
| reel | `<reel>/pronounce.json` | this reel only |

```bash
node pronounce.mjs                                  # Latin words with no respelling, per scene
node pronounce.mjs set data=डाटा "genserver=जेन सर्वर"  # saves to the reel and the personal dictionary
node pronounce.mjs set nginx="engine x" --reel-only  # this reel only
node pronounce.mjs list                             # respellings in use and where each comes from
```

`script.mjs vo` prints the same warning, so check it right after the script gate: respell every listed word
before any audio is made (Indian English: "डाटा" not "डेटा", "रिस्पॉन्स", "कैश"). English voice-overs need this
only for odd terms (`kubectl` → "cube control"). For one wrong word after the voice is made, `pronounce.mjs
set` it and re-take only the scenes that use it with `--scene`.

## Gate 2 — audio approval

Give the user `audio/vo.wav` (and the duration vs target). Ask: approve, re-take scenes (which, and what to
fix), switch voice, or use their own recording. Record `gates.audio` in reel.json when approved.

## Words (stage 4, no gate)

```bash
uv run align.py --audio audio/vo.wav --vo vo.txt --out words.json     # ~1 min for 50 s of audio
node script.mjs time                                                   # → script.timed.md + anchors.json
```

align.py force-aligns the approved narration (not a fresh transcription), so every word keeps the
script's spelling, then snaps word edges to real pauses in the audio (Whisper alignment tends to start
words early, inside the pause before them). Expect: words after a pause land within ~1–2 frames; words
in the middle of fast phrases can be ±0.2 s. Put beat-critical slams on words that follow a pause.
Show the user the per-scene start/end it prints; if a scene boundary looks wrong, listen around it before
building. If the recording deviates from the script (ad-libs), update the scene's `VO:` to what was said,
re-run `script.mjs vo`, then align again.
