# Research and script (stage 2)

The script decides whether the reel works; the build only amplifies it. Spend the effort here.

## Research → `research.md`

1. Search the web for the topic (WebSearch; several queries in one turn): official docs, the original
   announcement or paper, a credible case study, and one "common misconception" source.
2. Fill the facts table. **Every number on screen needs a source URL** — viewers screenshot numbers and
   comment when they are wrong. Prefer primary sources; mark anything you could only find second-hand.
3. Note what viewers usually get wrong: the best hooks correct a belief.
4. Write 3 hook candidates. Hooks that work for developer reels:
   - **Stat question**: "WhatsApp ran 2 million connections on one server. How?" (number + mystery)
   - **Contradiction**: "Threads are slow. Processes are faster." (violates an expectation)
   - **Stakes**: "This one bug could take down 70% of the internet."
   - **Before/after**: show the painful way, then the one-line way.

## Script → `script.md`

Use the template new-reel.mjs created. Its header carries the voice-over language and style from the config
(`node config.mjs`). Structure for a 45–60 s reel:

| Scene | Job | Length |
|---|---|---|
| S1 hook | stop the scroll in the first 3 s, pose the question | 8–12 s |
| S2–S4 | one idea per scene, each answering the last scene's question | 8–12 s each |
| S5 CTA | recap in one line, tease the next video, ask for the follow | 6–10 s |

Rules, and why:

- **Scene headers** are `## S2 · PROCESSES · [processes]`. The `[id]` is the scene's key everywhere
  (vo.txt, words.json, anchors, compositions), so keep ids short, lowercase, unique.
- **`VO:` is the exact narration** in the configured language — the single source for the voice, the
  subtitles and the timings. Write it the way it will be said: numbers as spoken words when the voice must
  say them, tech terms in the form the audience uses. Use `...` and sentence punctuation for pauses — they
  become breaths in TTS and pause anchors in alignment.
- **Length**: `node script.mjs vo` estimates each scene from `wordsPerSecond` in the config (about 2.5 for
  English, 2.35 for Hindi); trim if over target.
- **Beats** are lines starting with `- @word:` — the on-screen event that fires as that word is spoken.
  `@word` matches the next occurrence in that scene (punctuation/case ignored); `@{two words}` matches a
  phrase. Write `\@name` for a literal @ in on-screen text (the reel's own handle is exempt).
- **A new visual event at least every 2 s; nothing static longer than 0.7 s except the final CTA.** Reels
  are judged on retention; a static frame is where people swipe. Add a `Filler:` line per scene with
  secondary motion (counters rolling, dots drifting, a camera drift) for the gaps between beats.
- **On-screen text** (configured `onScreenLanguage`) is short (≤ 4 words per line) and names the concept
  rather than repeating the subtitle — the karaoke captions already carry every spoken word.
- **Every scene hands an object to the next** (the server card becomes the corner badge; the grid
  collapses into three spheres). Write the hand-off into the last beat of each scene; it is what makes
  the reel feel like one continuous shot.
- **Palette**: bg, accent (from the topic logo), success green, text, white. No red unless you add it to
  the palette on purpose — strikes and crash flashes read fine in white.
- **CTA scene** names the next topic and ends on the spoken follow line from the config (`cta.spoken`).

### Language notes

- **Hindi / Hinglish** (`language: hi`): Hindi in Devanagari with tech terms in Latin script as people say
  them — "Elixir में हर request को अपना process मिलता है।" Write numbers as Hindi words ("बीस लाख") so the voice
  reads them naturally; `।` marks sentence pauses. English on-screen text works well with Hindi narration.
  Keep tech terms in Latin script in `VO:` (subtitles show them that way); the voice gets Devanagari
  respellings from `pronounce.mjs` so they sound Indian, not American (audio.md §Pronunciation).
- **Other languages**: the default font (Noto Sans Devanagari) covers Latin and Devanagari. For other
  scripts set `fonts.sans` in the config to a TTF that covers them (for example a Noto Sans variant), and
  check VoiceStudio/Chatterbox support the language before scripting.

### Audio tags

ElevenLabs-style tags in square brackets direct the voice: `VO: [excited] WhatsApp ने एक server पर बीस लाख
connections चलाए। [pause] कैसे?`. They are never shown on screen or in subtitles (script.mjs strips them for
vo.txt; vo.tagged.txt and audio-script.md keep them). When `audioTags` is on, add 3–6 per reel — tags are
seasoning, and a tag on every line flattens the delivery:

- an emotion at the hook's start (`[excited]`, `[playful]`), maybe another on the punchline scene;
- `[pause]` before a reveal or answer (it is also a reliable beat anchor for the word after it);
- at most one vocalization (`[chuckling]`, `[sighing]`) where a human would make it;
- sound-effect tags only when the user will generate on ElevenLabs — otherwise put the sound in cues.json.

Vocabulary (ElevenLabs v3 style; it accepts other free-form tags too):

| Kind | Tags |
|---|---|
| Emotion | `[excited]` `[playful]` `[angry]` `[menacing]` `[bored]` `[tired]` `[weak]` |
| Vocalizations | `[chuckling]` `[laughing]` `[sighing]` `[gasping]` `[scoffing]` `[clears throat]` `[coughing]` `[sniffling]` `[yawning]` `[sharp exhale]` `[humming]` `[panting]` |
| Delivery | `[pause]` `[short pause]` `[long pause]` `[whispering]` `[softly]` `[slowly]` `[singing]` `[voice breaking]` |
| Character | `[sleepy drowsy voice]` `[witch voice]` `[drunken voice]` |
| Sound effects | `[keyboard typing]` `[applause]` `[crowd cheering]` `[drum roll]` `[heartbeat]` `[bell ringing]` `[phone ringing]` `[knocking on door]` `[rain falling]` `[engine starting]` `[dog barking]` `[echoing]` |

Local engines honour what they can (reference/audio.md §Audio tags by engine) and report the rest.

## Gate 1 — script review

Show the user: the hook, the scene table (id, VO, beats), the estimated duration, and the 3–5 facts with
sources. Ask for approval or edits; iterate until they say it's good. Then record
`gates.script = "<date>"` in reel.json and run `node script.mjs vo`.
