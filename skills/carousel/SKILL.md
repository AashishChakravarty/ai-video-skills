---
name: carousel
description: Instagram carousels for tech explainer posts. Researches the topic, writes 6–8 slides (cover, stats, takeaways, call to action) in the user's brand theme, renders them to 1080×1350 PNGs with overflow and font checks, and writes the Instagram caption and per-slide alt text, with one review. Use whenever the user wants a carousel, slides, a swipe post or a cheat-sheet post, or continues a folder whose reel.json has kind "carousel" — even if they don't name the skill.
---

# Carousel (Instagram slides, about 25 minutes)

No voice: research, slides (still or animated), one review. A carousel lives in its own topic folder like a reel, with a
`reel.json` (`kind: "carousel"`) that records the stage. The plugin folder is `${CLAUDE_PLUGIN_ROOT}` (call it
`$R`); scripts live in `$R/scripts` (call it `$S`). Brand, look and settings are the reel skill's: the user's
config (`node $S/config.mjs`) and themes (`node $S/theme.mjs`).

## Start or resume

1. Run `node $S/doctor.mjs`. A carousel needs only its config, node, ffmpeg, node packages, Playwright Chromium and
   default theme rows; ignore the rest. With no config yet, ask once, with suggested defaults, for the handle,
   channel name, on-screen language, reels folder and a theme, and save them with `node $S/config.mjs set …`.
2. If the current folder (or one the user names) has a `reel.json` with `kind: "carousel"` and a stage that is not
   `done`, resume at that step and say so in one line. Otherwise take the topic from the arguments, or ask for it.

## Steps

1. `node $S/new-reel.mjs "<topic>" --carousel [--theme <name>]` → the topic folder (stage `slides`) with
   `research.md` and `slides.html` (`$R/templates/carousel`: cover, stat, point with rows, cta). Pass `--reel <that
   folder>` to every script from here on, or work from inside it.
2. Research only the facts the slides state into research.md, with sources.
3. Write `slides.html`: 6–8 `<section class="slide">`, the cover first (the hook in under 10 words, then swipe) and
   the cta last (a save line, one comment question, the follow line); one idea per slide in between, about 30
   words at most, and a `.src` line under every number. Write in the configured `onScreenLanguage`, translating a
   brief or calendar hook written in another language. Slides never set colours, fonts or footers: the theme and
   carousel.mjs do.
4. `node $S/carousel.mjs` → `publish/slide-NN.png` (1080×1350) and `out/slides-sheet.png`. Fix every `!` line by
   cutting words rather than shrinking type, re-run until it prints none, then look at each slide yourself. Add
   `--animate` when the user wants motion: it also writes `publish/slide-NN.mp4` (4 s each; blocks and rows rise
   in, `.big` numbers count up, then the slide holds). Check a few mid-build frames, not only the sheet.
5. Write `publish/captions.md` (below).
6. **The one gate**: show the sheet, the slide paths and the Instagram caption inline; ask for all notes in one
   message, apply them, re-run. Then record `gates.slides` and set `stage` to `done`.

## captions.md

The slides upload in order (`slide-01.png` …, or the `.mp4`s when animated) as one Instagram post. A video's
first frame is still empty, so an animated carousel uploads `slide-01.png` as its cover. `publish/captions.md` has two `##` sections:

- **Instagram** (≤ 2,200 chars): the hook line (the cover's idea, not its exact words), one line on what the slides
  give, a save prompt ("save this before your next interview"), the comment question from the cta slide, the
  follow line with the handle, 3–5 hashtags; about 300–450 characters. A carousel has no voice-over, so the caption
  and alt text use the slides' language, not the reel caption rule; hashtags as for reels
  (`$R/reference/publish.md`, "captions.md").
- **Alt text**: one numbered line per slide saying what it shows in a sentence, numbers included. Paste each into
  Instagram's alt text (Advanced settings → Accessibility) when posting.

## Working agreements

- Facts on a slide need a source in research.md; numbers are what readers fact-check.
- Show evidence, not claims: quote carousel.mjs's output and give the paths the user can open.
- The folder is the user's: never commit, never delete their files without asking.
