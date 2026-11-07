# Testing ai-video-skills

Three levels, each building on the last. Level 1 takes 2 minutes, level 2 about 10, level 3 is a real reel
(roughly an hour, mostly rendering and your reviews).

| Level | What it proves | Needs Claude? |
|---|---|---|
| 1. Setup check | tools, plugins, models, voice engines and your config are in place | no |
| 2. Pipeline test | every script works on your machine, from a script to a publish pack | no |
| 3. Full skill test | Claude runs the whole workflow with the three review gates | yes |

Throughout, `S=~/.claude/skills/ai-video-skills/scripts` (the skill symlink; any clone path works).

## Level 1 — setup check

```bash
S=~/.claude/skills/ai-video-skills/scripts
node $S/config.mjs          # your settings; * marks values from your config
node $S/doctor.mjs          # every required row must be ✓
```

Expected: `ready. Voice engines: …` and exit code 0. A ✗ row prints the exact fix. Optional rows (`!`) only
limit which voice engines you can use. No config yet? `node $S/config.mjs set handle=@you channel="You" language=en`.

To test without touching your real settings, point everything at a throwaway config:
`export AI_VIDEO_SKILLS_CONFIG=/tmp/reel-test-config.json` and run the `config.mjs set …` line above.

## Level 2 — pipeline test (scripts only)

Uses the 15-second example script and starter scenes, so nothing needs hand-written animation.
A reel takes its language from the config when it is created, so set the language first (in the throwaway
config from level 1 if you'd rather not change yours). To test Hindi, set `language=hi` and copy
`script.hi.md` instead; it has 2 scenes and runs about 10 s, so expect 2 where the checks below say 3.

```bash
S=~/.claude/skills/ai-video-skills/scripts
node $S/config.mjs set language=en          # or language=hi with script.hi.md
node $S/new-reel.mjs "Git rebase vs merge" --slug pipeline-test --root /tmp/reel-test --logo git
cd /tmp/reel-test/pipeline-test
cp ~/.claude/skills/ai-video-skills/examples/script.en.md script.md
node $S/script.mjs vo
```
✓ `vo.txt: 3 scenes, 37 words ≈ 15s`. The logo line shows the Git brand colour and the accent chosen from it.
With the Hindi script, `node $S/pronounce.mjs` reports `every Latin word is respelled` (the starter list
covers the example); `node $S/pronounce.mjs list` shows the respellings in use.

**Audio script** — `vo` also wrote `audio-script.txt`, the whole narration with its tags (`[excited]`,
`[pause]`, `[sighing]`) ready to paste into a TTS, and `audio-script.md` (`open audio-script.md`): the same
text as an ElevenLabs block, a plain block, and a per-scene table.

**Voice** — pick one way:

```bash
node $S/tts.mjs --engine say --sample && open audio/samples/*.wav      # instant draft (macOS)
node $S/tts.mjs --engine say                                           # full voice-over
# or: node $S/tts.mjs --engine voicestudio --voices; node $S/tts.mjs --engine voicestudio --voice <id>
# or: node $S/tts.mjs --engine chatterbox          (first run downloads ~3 GB)
# or ElevenLabs: paste the ElevenLabs block into Eleven v3, download, then
#    node $S/tts.mjs --engine file --input ~/Downloads/<file>.mp3
```
✓ `audio/vo.wav: …s → … frames, -16.0 LUFS` (±0.1), plus a line per scene naming tags that engine cannot
voice (macOS voices none; VoiceStudio turns `[pause]` into real silence). Listen: `open audio/vo.wav`.

**Words**

```bash
uv run $S/align.py --audio audio/vo.wav --vo vo.txt --out words.json   # first run downloads Whisper (~3 GB)
node $S/script.mjs time
```
✓ `words.json: N words, 3 scenes …; 0 words under 60 ms` and `script.timed.md: 6 anchors resolved`.
Open `script.timed.md`: every `@word` became `<seconds> "word"`.

**Build, mix, render**

```bash
node $S/scaffold.mjs a          # build/a from the HyperFrames template
node $S/starter.mjs a           # one starter scene per script scene + cues.json
node $S/mix.mjs a               # ✓ … → -14.0 LUFS
node $S/render.mjs a            # ✓ Check passed; out/a.mp4 1080x1920 30fps <frames> frames
open out/a.mp4 out/a-contact.png
```
Look for: header (logo, wordmark, handle) clear of the phone's top bar (y ≥ 260), no ticker strip
under it (off by default), a moving dot field in every
contact-sheet tile, the beat labels slamming in on their words, karaoke captions in sync with the voice,
the progress bar, and the pinned FOLLOW footer.

**Fast mode** (optional) — the same pipeline with ready-made library scenes:

```bash
node $S/new-reel.mjs "IRCTC Tatkal" --fast --slug fast-test --root /tmp/reel-test && cd /tmp/reel-test/fast-test
cp ~/.claude/skills/ai-video-skills/examples/script.fast.en.md script.md
node $S/script.mjs vo && node $S/tts.mjs --engine say
uv run $S/align.py --audio audio/vo.wav --vo vo.txt --out words.json && node $S/script.mjs time
node $S/scaffold.mjs a && node $S/starter.mjs a && node $S/mix.mjs a && node $S/render.mjs a
```
✓ starter prints `library scenes: hook, number, stack, steps, jam, cta; wrote a fast-mode direction.js`, and the
render passes check (warnings only). In `out/a-contact.png`: a question bubble, a browser page with a loader, a
payment screen and a stamp, a big 10:02 that settles above two rolling counters, a four-layer stack, a step window
with ticks, a funnel with a lock, and the COMMENT DESIGN card before the FOLLOW lockup.

**Themes** (optional) — `node $S/theme.mjs` lists `midnight`, `terminal` and `alert`. Switch this reel and build
another version in that look:

```bash
node $S/theme.mjs apply terminal && node $S/scaffold.mjs t && node $S/starter.mjs t && node $S/mix.mjs t && node $S/render.mjs t
open out/t.mp4          # green palette, blueprint grid; out/a.mp4 keeps the look it was built with
node $S/theme.mjs apply midnight
```

**Second version and compare** (optional: the skill builds one version unless you ask for several)

```bash
node $S/scaffold.mjs b && node $S/starter.mjs b && node $S/mix.mjs b && node $S/render.mjs b
node $S/compare.mjs && open out/compare.mp4
```

**16:9 cut and publish pack**

```bash
node $S/scaffold.mjs a-16x9 --from a && cp build/a/cues.json build/a-16x9/
node $S/mix.mjs a-16x9 && node $S/render.mjs a-16x9          # ✓ 1920x1080
printf '# Captions\n\n## Instagram\nTest caption #test\n\n## X\nTest\n' > publish/captions.md
node $S/publish.mjs a --cover-at 1
open publish
```
✓ A table with `pipeline-test-9x16.mp4`, `-9x16-nosubs.mp4` and `-16x9.mp4`, all with the same frame count and
≈ −14 LUFS, then `publish pack complete`. `cat reel.json` shows `"stage": "done"`.

Clean up: `rm -rf /tmp/reel-test` (and `unset AI_VIDEO_SKILLS_CONFIG` if you used a throwaway config).

## Level 3 — full skill test (with Claude)

Start Claude Code in any folder and type `/ai-video-skills` (or "make a reel about Docker layers"). What should
happen, and what to check at each step:

| Stage | Claude should… | You check |
|---|---|---|
| 0 Start | run `doctor.mjs`; on a first run ask your handle, channel, language, folder and CTA line once | no repeated questions; config saved (`node $S/config.mjs`) |
| 1 Topic | ask only for the topic (angle/length/language optional) and create the reel folder | folder under your `reelsRoot`, logo found |
| 2 Script ✋ | research with sources, then show the hook, scene table, duration and the path to `audio-script.txt`; **wait** | facts have URLs in `research.md`; beats use `@word`; short sentences with pause tags, few mood tags; no digits in VO; in a Hindi reel `audio-script.txt` has no Latin words left; length near target |
| 3 Voice ✋ | ask: local engine / ElevenLabs / other platform / record; samples or import; **wait** | `audio-script.txt` pastes cleanly into ElevenLabs; an imported file lines up; try a re-take of one scene |
| 4 Words | align and time without asking | scene boundaries it prints look sensible |
| 5 Build ✋ | write the Living Diagram direction for the topic, build version A, review its contact sheet, show it; **wait** | the video plays; strokes draw on and one hero object carries every hand-off; captions never overlap scene text |
| 6 Publish | build the 16:9 cut, write captions.md, run publish.mjs | `publish/` has every file; captions within platform limits |

Also test:
- **Resume**: quit Claude mid-way (e.g. after the script gate), start it again in the reel folder and run
  `/ai-video-skills` — it should say which stage it is resuming.
- **Changes after audio**: ask for a different word in one scene's narration after the build; Claude should
  re-take that scene, re-align, `scaffold --sync` and re-render rather than start over.
- **Versions on request**: say "make two versions" (at the topic or the build gate); Claude should build two
  clearly different directions, often in parallel, then show both plus `compare.mp4` and wait for a pick.
- **Pronunciation**: ask it to fix a mispronounced term; it should add it to `pronounce.json` and re-take
  only that scene.
- **Themes**: ask for "a reel about Log4Shell in the alert theme"; Claude should pass `--theme alert` to
  `new-reel.mjs`. Ask it to save your brand colours and logo as the default theme; the next reel should use them.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `no handle configured` | `node $S/config.mjs set handle=@you` |
| `VoiceStudio backend did not answer` | open the app once and install/load the OmniVoice model in its Models tab |
| VoiceStudio clone voice errors about speech-to-text | handled automatically (tts.mjs trims and transcribes the reference); if it persists, re-save the voice from a 5–15 s clip |
| English words sound American in a Hindi voice-over ("day-ta") | `node $S/pronounce.mjs` lists the unrespelled ones; `pronounce.mjs set data=डाटा`, then re-take those scenes with `--scene`. For the accent overall: `node $S/config.mjs set "tts.instruct=indian accent"` |
| Chatterbox `'NoneType' object is not callable` | outdated cached env: `uv cache clean chatterbox-tts` and run again |
| A number sounds wrong ("8.5.12", "70%") | write it as spoken words in `VO:` (eight point five point twelve, seventy percent); `script.mjs vo` lists any numerals left |
| `aligner changed the text` | unusual characters in the VO line (emoji, smart symbols) — remove them and re-run `script.mjs vo` |
| `take(s) made from older text` | the script, a tag or a respelling changed after that take was made — re-take the scenes it names (`tts.mjs --scene …`) |
| `anchor reference(s) no longer exist` / render refuses | a scene, direction.js or cues.json still uses an `@beat` the script dropped or renamed — point it at a current beat (script.timed.md) |
| `anchors not found` | the `@word` isn't in that scene's narration (check spelling, or use `@{two words}`) |
| `check` fails with *missing_local_asset* | a `<video>` points at a clip that wasn't rendered — run `render-clips.mjs` in `build/<v>/remotion` |
| Boxes instead of letters | the language's script isn't in the configured font — set `fonts.sans` to a TTF that covers it |
| Render looks frozen on one frame | a composition threw an error: open `build/<v>` with `npx hyperframes preview` and read the console |
