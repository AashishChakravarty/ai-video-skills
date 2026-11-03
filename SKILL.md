---
name: ai-video-skills
description: End-to-end short-video studio for tech explainer reels (Instagram Reels, YouTube Shorts, TikTok, LinkedIn, plus a 16:9 YouTube cut) in any language the voice engines speak (tested with English and Hindi/Hinglish). Asks for a topic, researches it, writes the hook and scene script with an ElevenLabs-style tagged audio script, gets approval, makes the voice-over locally (VoiceStudio/OmniVoice, Chatterbox, macOS say) or imports one from ElevenLabs, another platform or the user's recording, aligns words, builds the video with HyperFrames in its Living Diagram style (several directions to compare only when asked), then produces the publish pack (final video, no-subtitle copy, 16:9 cut, SRT, covers, per-platform captions). Use this whenever the user wants to make, script, voice, build, render or publish a reel, short, explainer video or "video on <topic>", wants to continue or fix an existing reel folder (one with reel.json), or asks for reel captions/hashtags — even if they don't name the skill.
---

# AI Video Skills

Turns a topic into a finished, publish-ready reel through gated stages. The user reviews the script, the
voice and the final versions; everything between gates is yours. Each reel lives in its own folder with
a `reel.json` that records the stage, so work can stop and resume in any session.

Scripts live in `~/.claude/skills/ai-video-skills/scripts` (call it `$S`); every script takes `--reel <folder>`
or runs from inside the reel folder. The user's settings (handle, channel, language, reels folder, CTA,
palette, fonts, TTS defaults) live in `~/.config/ai-video-skills/config.json` over the repo's
`config.default.json`; `node $S/config.mjs` shows them and `node $S/config.mjs set key=value …` changes them.
Their brand and look can also be saved as named themes (handle, channel, CTA, channel logo, palette, fonts,
background) that new reels reuse: `node $S/theme.mjs` lists them, `theme.mjs save <name> --from <theme> key=value …`
creates one, `theme.mjs default <name>` makes it the default.

## Stage 0 — start or resume

1. Run `node $S/doctor.mjs`. Fix required items before going on (it prints the fix); optional items only
   limit which voice engines you can offer. If it reports no config, this is a first run: ask the user once,
   in one message with suggested defaults, for their handle, channel name, voice-over language, on-screen
   language, reels folder and spoken follow line, then save them with `node $S/config.mjs set …`.
   In the same round, set up their default voice: list what this machine has (`node $S/tts.mjs --engine
   voicestudio --voices`, `--engine say --voices`; Chatterbox clones any clean 5–15 s clip) and save the pick
   with `config.mjs set tts.default=<engine> tts.voicestudioProfile=<id>` (or `tts.chatterboxRef=<clip>`), plus
   `"tts.instruct=indian accent"` (or another accent) when their audience expects one. Doctor's `default voice`
   row shows the choice; if it is `!` on a later run, ask then. The user can change it any time the same way.
   Also offer, with `midnight` as the default, a look from `node $S/theme.mjs` and an optional channel logo for
   the follow button (`config.mjs set channelLogo=<png>`). When they describe a brand (colours, a second channel),
   save it as a theme and make it the default if they want it on every reel.
2. If the current folder (or a folder the user names) has `reel.json` and its `stage` is not `done`, read it
   and resume at that stage; say where you are resuming in one line. If the user names a new topic, or the
   reel is `done`, start a new reel instead (step 3) — every topic gets its own folder.
3. Otherwise ask for the topic — just the topic; offer, don't require, an angle, length (default 45–60 s)
   and language (default from the config).
   Then: `node $S/new-reel.mjs "<topic>" --logo <simple-icons slug>` (find slugs with
   `node $S/logo.mjs --search <text>`), adding `--theme <name>` when the user asks for a look (`alert` suits
   security news). It creates `<reelsRoot>/<slug>/` with templates and the theme's brand and look, and picks a
   contrast-safe accent from the topic's brand colour unless the theme fixes one (a taken slug fails: pass
   `--slug <topic>-2`). To change an existing reel's look later: `theme.mjs apply <name>`, then
   `scaffold.mjs <v> --sync` for each built version. A ticker strip under the header is off by default; only
   when the user asks for one, set `reel.json → ticker` (4–6 short items) and build.md §6. From here on pass `--reel <that folder>` to every script (or work
   from inside it): scripts otherwise act on the reel.json nearest the current directory.

## Stage 1–2 — research and script → Gate 1

Read `reference/script.md`, then research (with sources) into `research.md` and write `script.md` in its
voice (§Voice and rhythm): a hook that talks to the viewer, the concept as an everyday picture before any news or
number, connected sentences a local voice reads without stopping; the alert arc only for news the viewer acts on. When the user hands you their own draft, keep its words
and rhythm and change only the facts, the writing system (Devanagari for Hindi) and the format. When the
config's `audioTags` is true, pause tags stay rare and an emotion tag marks each change of feeling (script.md §Audio tags).

Run `node $S/script.mjs vo`. It writes `vo.txt` and `audio-script.txt` (the whole narration as the voice will
read it, ready to paste into any TTS) and lists what the voice would misread. Spell listed numerals out in
`VO:`. In a Hindi (or other non-Latin) voice-over, English words left in Latin script are read with an English
accent: respell each the way the audience says it (Indian English: data → डाटा, not डेटा) with
`node $S/pronounce.mjs set data=डाटा …`; that saves it to the reel and to the user's dictionary, so later reels
already know it. Run `vo` again until it lists nothing.

Present the hook, the scene table (narration with its tags), the estimated duration and the path to
`audio-script.txt`, and offer more, fewer or no tags. **Wait for the user's approval**; iterate on their
edits, re-running `vo` after each. Then record `gates.script`.

## Stage 3 — audio script and voice-over → Gate 2

Read `reference/audio.md`. Give the user `audio-script.txt` (path, plus its text inline; `audio-script.md`
adds a plain copy for other platforms) and ask in one question how to create the voice-over, recommending one:
1. **I generate it locally** — with their default voice (doctor's `default voice` row) or another one the
   engines doctor reported (VoiceStudio holds their saved voices; Chatterbox; macOS say for drafts). Make 2–3
   samples of the opening sentence, let them pick, render with `tts.mjs`; if they pick a voice other than the
   default, offer to make it the default (`config.mjs set tts.voicestudioProfile=<id>`).
2. **ElevenLabs** — they paste `audio-script.txt` (Eleven v3) and send back the MP3.
3. **Another platform** — Sarvam Bulbul, Google Gemini TTS, OpenAI TTS, Azure Speech, … with the plain block
   from `audio-script.md`.
4. **Record it themselves** — reading the plain block.

For 2–4, wait for the file (whole reel or one per scene) and import it with `tts.mjs --engine file`.
Show the per-scene report tts.mjs prints (lengths, stalls cut, pauses) with the voice, and offer to save a
measured speaking rate or a picked speed to the config. **Wait for approval of `audio/vo.wav`**; re-take single
scenes on request (`--scene`, another `--seed` for a stop or an over-stressed word). A mispronounced word
is fixed with `pronounce.mjs set word=respelling`, then a re-take of the scenes that use it; a wrong accent
overall is a voice choice (another voice, or `--instruct "indian accent"` on VoiceStudio). Record `gates.audio`.

## Stage 4 — words (no gate)

```bash
uv run $S/align.py --audio audio/vo.wav --vo vo.txt --out words.json
node $S/script.mjs time
```

This turns the approved audio into word timings (script spelling kept) and every `@word` beat into an
exact time (`script.timed.md`, `anchors.json`). Glance at the scene boundaries it prints.

## Stage 5 — build → Gate 3

Read `reference/build.md` and load the `/hyperframes` skill. Build **one version**, `build/a`, in the
**Living Diagram** direction (build.md §1): write its DIRECTION.md for this topic, then scaffold →
`starter.mjs` (a renderable baseline to replace scene by scene) → direction.js → scenes → cues.json →
`mix.mjs` → `render.mjs`. Every scene builds on `assets/design.js` (one type scale, standard object sizes, a
row grid, step flows for explanations — build.md §1 Design system); build one explanation scene and the CTA
first and show their frames before the rest. Review the contact sheet against the checklist in build.md and fix once. Present
`out/a.mp4`, its contact sheet and one paragraph on how the direction plays out. **Wait for approval** (or
fixes).

Build more than one version only when the user asks for it (versions, options, another style, a
comparison — at the topic, at this gate or later): then write that many clearly different directions, build
them in parallel with background subagents (build.md §3), run `node $S/compare.mjs` and let the user pick.
Record `gates.version` and `picked` (`a` when there is one version).

## Stage 6 — 16:9 cut and publish pack

Build the 16:9 cut of the picked version (build.md §11), write `publish/captions.md` from
`reference/publish.md` (Instagram, TikTok and Facebook as short teasers), then `node $S/publish.mjs <v> --cover-at <s>`. Fix its TO FIX list, and finish
with the file list, what to upload where, and the Instagram + YouTube Shorts captions inline.

## Working agreements

- Gates are real: don't start the voice before the script is approved, the build before the audio is
  approved, or the publish pack before the version is approved. Batch your questions at each gate into one
  message with a recommended default.
- Show evidence, not claims: when a stage finishes, quote the script's own output (durations, LUFS,
  frame counts, check results) and the paths the user can open.
- Keep `reel.json` current (`stage`, `gates`, `versions`) — it is how the next session resumes.
- Facts on screen need a source in research.md; numbers are what viewers fact-check.
- The project folder is the user's: never commit, never delete renders or takes without asking.
