# Publish pack (stage 6)

## Assemble

```bash
node ~/.claude/skills/ai-video-skills/scripts/publish.mjs a --cover-at 1.4
```

It copies the picked render, renders the no-subtitle copies if missing (9:16, and 16:9 when
`out/a-16x9.mp4` exists), adds the 16:9 cut, writes `captions.srt` / `.vtt`, grabs the covers from the
no-subtitle copies (a cover never shows a caption), length-checks `captions.md`, probes every video and prints
a table plus a TO FIX list. Run it again after fixing anything.
Pick `--cover-at` from a moment with the hook's biggest text on screen (check the contact sheet); it is
the cover on profile grids and the Shorts shelf.

## Which file goes where

| Platform | Upload | Also |
|---|---|---|
| Instagram Reels | `<slug>-9x16.mp4` | cover-9x16.png as the cover |
| YouTube Shorts | `<slug>-9x16.mp4` | pick the cover frame in the app |
| TikTok | `<slug>-9x16.mp4` | |
| Facebook Reels | `<slug>-9x16.mp4` | |
| LinkedIn | `<slug>-9x16.mp4` (autoplay is muted, so burned-in captions help) | |
| YouTube (long-form) | `<slug>-16x9-nosubs.mp4` + captions.srt (or `<slug>-16x9.mp4` with burned-in captions) | cover-16x9.jpg as the thumbnail |
| Anywhere you add captions yourself | `<slug>-9x16-nosubs.mp4` | captions.srt |

## captions.md

Write `publish/captions.md` with exactly these `##` sections (publish.mjs checks the limits it knows):
Instagram (≤ 2,200 chars), YouTube Shorts (`Title:` ≤ 100, `Description:` ≤ 5,000), YouTube (16:9; same
limits, plus `Chapters:`), TikTok (≤ 4,000), LinkedIn (≤ 3,000), X (≤ 280), Facebook.

How to write them, and why:

- **First line = the hook**, because feeds truncate after ~125 characters. Reuse the spoken hook's idea,
  not its exact words (the video already says it).
- **Language**: match the audience of the voice-over, but keep technical keywords in English — people
  search "elixir concurrency". For a Hindi reel, Hinglish (Roman-script Hindi + English terms) reads best.
- **Instagram, TikTok and Facebook are teasers, not the story** (users asked for the full-story caption to be cut):
  the hook line, one line with the shock number, a pull to watch ("asli twist video ke end mein hai"), a comment
  question, the follow line with the reel's handle (`reel.json → handle`), the hashtags — about 300–450
  characters. Never give away the twist; the video does that.
- **YouTube Shorts and YouTube carry the value**: the 2–4 takeaways from the script, then the follow line.
- **Hashtags**: 3–5 specific ones (topic, language/framework, #programming or #coding, and one audience tag
  such as #codinginhindi for a Hindi reel). Specific beats generic.
- **YouTube**: keyword-first title ("Elixir Concurrency in 50 Seconds — 2M connections on 1 server"); the
  description carries the takeaways and the sources from research.md (credibility, and links are
  clickable there). Long-form chapters need `00:00` first, at least 3 entries, ≥ 10 s apart — use the
  scene starts from words.json.
- **LinkedIn**: more professional, English-first, 1 question at the end to invite comments; no hashtag wall.
- **X**: one punchy line + the most surprising number; ≤ 280 chars including any link.

Template:

```markdown
# Captions — <title>

## Instagram
<hook line>

<the shock number in one line>. <a pull to watch, without giving away the twist>

<a comment question> 👇
<the follow line with @yourhandle>

#tag1 #tag2 #tag3 #tag4

## YouTube Shorts
Title: <keyword-first title>
Description:
<2–3 lines>
Sources: <urls>
#Shorts #tag1 #tag2

## YouTube
Title: <title>
Description:
<3–5 lines + sources>
Chapters:
00:00 <hook>
00:12 <scene 2>
00:25 <scene 3>

## TikTok
<hook line> <takeaway> #tag1 #tag2 #tag3

## LinkedIn
<2–4 short paragraphs, English-first, end with a question>

## X
<one line + number>

## Facebook
<same as Instagram, hashtags optional>
```

## Final message to the user

List the publish/ files with one line each (what to upload where), paste the Instagram and YouTube Shorts
captions inline so they can copy them, and mention any TO FIX items publish.mjs reported.
