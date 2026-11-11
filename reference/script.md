# Research and script (stage 2)

The script decides whether the reel works; the build only amplifies it. Spend the effort here.

## Research → `research.md`

1. Search the web for the topic (WebSearch; several queries in one turn): official docs, the original
   announcement or paper, a credible case study, and one "common misconception" source.
2. Fill the facts table. **Every number on screen needs a source URL** — viewers screenshot numbers and
   comment when they are wrong. Prefer primary sources; mark anything you could only find second-hand.
3. Note what viewers usually get wrong: the best hooks correct a belief.
4. For news (a security bug, a release, an outage), collect what a viewer acts on, not only what happened: the
   name and identifiers (CVE IDs), severity and who rated it, affected and fixed versions per branch, the
   well-known products it touches, how it works as 3–5 plain cause → effect steps, what it needs (a login? a
   setting?), the impact, the backstory that makes it surprising (how long it hid, how it was found), and the
   fix: versions, stopgaps and their limits, a tool to check.
5. Write 3 hook candidates. Hooks that work for developer reels:
   - **Stat question**: "WhatsApp ran 2 million connections on one server. How?" (number + mystery)
   - **Contradiction**: "Threads are slow. Processes are faster." (violates an expectation)
   - **Stakes**: "This one bug could take down 70% of the internet."
   - **Before/after**: show the painful way, then the one-line way.
   - **Viewer stake**: "अगर तुम भी AI shares में पैसा लगा रहे हो, तो रुको, पहले देखो China में क्या हुआ।" (talks to
     the viewer about their own money, code or job)

   Talk to the viewer; don't report to them. A hook that relays news ("…और सत्रह दिन बाद ख़बर आई कि…") sounds
   like a bulletin and viewers asked for it to be redone; the news belongs in scene 2, after the viewer cares.

## Script → `script.md`

Use the template new-reel.mjs created. Its header carries the voice-over language and style from the config
(`node config.mjs`). Structure for a 45–60 s reel:

| Scene | Job | Length |
|---|---|---|
| S1 hook | stop the scroll in the first 3 s, pose the question | 8–12 s |
| S2–S4 | one idea per scene, each answering the last scene's question | 8–12 s each |
| S5 CTA | recap in one line (the lesson), then the follow line | 6–10 s |

For news the viewer cannot act on (markets, policy, a company's crash or funding round), keep the explainer
structure and teach the concept before the news — the numbers mean nothing until the idea is clear:

| Scene | Job | Example (China AI bubble, Hindi) |
|---|---|---|
| hook | the viewer's stake, then the event in one line | "अगर तुम भी AI shares में पैसा लगा रहे हो, तो रुको, पहले देखो China में क्या हुआ…" |
| concept | the idea as an everyday picture, before any number | "जब दस लाख का plot लोग एक करोड़ में ख़रीदने लगें, ये सोच के कि कल अच्छा profit होगा…" |
| what | what happened, with the 1–2 numbers that matter | "…चार महीने में forty percent गिर गए, यानी चालीस लाख करोड़ रुपये से भी ज़्यादा डूब गए।" |
| why | the causes in plain words, one sentence | "shares की कीमतें कमाई से बहुत आगे निकल गई थीं, ऊपर से…" |
| twist | what makes it surprising | "मज़े की बात, सरकार ख़ुद पैसा लगाना बंद नहीं कर रही…" |
| cta | the lesson in one line, then the follow line | "AI की technology असली है, पर हर AI share की कीमत नहीं।" |

For news the viewer acts on (security bugs, releases, outages) use the alert arc instead. It runs 60–90 s because every scene
carries a fact the viewer acts on:

| Scene | Job | Example (PHP2Shell, Hindi) |
|---|---|---|
| hook | scale and stakes, then the name | "Internet का seventy percent अभी-अभी एक critical bug की चपेट में आया है।" |
| what | count, severity, versions, a roll-call of names the viewer knows | "WordPress। Drupal। Joomla। Wikipedia। [short pause] सब कुछ।" |
| how | "Trick समझो": the mechanism as 3–5 cause → effect steps, one actor each | "PHP उस request को मार देता है… लेकिन dead memory का एक pointer पीछे छोड़ देता है।" |
| impact | the result, then what the attack does not need | "ना login चाहिए। [short pause] ना आपके app में कोई bug चाहिए।" |
| twist | the backstory that makes it surprising | "ये code PHP के अंदर दस साल से था।" |
| fix | exact versions, stopgaps, a tool to check | "Update करो eight point five point twelve…" |
| cta | the action in two words, then the follow line | "आज ही।" |

### A scenario the viewer lives

- The example must be something the audience does on that day: on Diwali people are home with family, so the
  payment goes to a crowded mithai shop, not to mummy. Ask "would they really be doing this then?" before writing
  the hook.
- For a festival or event, prefer numbers for the whole festival (the three days from Dhanteras to Diwali) over a
  record on one side day, and name the festival the viewer thinks of.
- When the scenario changes, re-check every rule the script states for it: a shop payment is refunded within T+5,
  a transfer to a person by T+1 (RBI's failed-transaction rules differ by payment type).

### Voice and rhythm

Write for the ear, like someone who knows the subject explaining it to a friend — teach, don't report:

- One idea per sentence, joined the way people talk (तो, यानी, क्योंकि, पर). A string of clipped fragments
  ("दो CVEs। दोनों nine point two।") sounds like a news bulletin, not an explanation.
- Explain each mechanism with an everyday picture first, then name the term: a hot wallet is the exchange's
  cash counter, the cold wallet its तिजोरी, an EIP-7702 delegation a power of attorney.
- Explain before you report: a viewer who has not understood the idea cannot follow the numbers. Give the
  concept its own scene before the news.
- Plain words in the voice, jargon on screen: say "बड़ी AI और chip companies", show "STAR50"; say "पाबंदियाँ",
  show "US CHIP CURBS". Big money the way the audience counts it: "चालीस लाख करोड़ रुपये" next to "$480B" on
  screen (keep the exchange-rate source in research.md).
- Punctuation carries the rhythm (`।` `,` `?`). Local voices (VoiceStudio, Chatterbox) stop at every `।`, `...` and
  pause tag, so for them write each scene as one or two connected sentences joined with commas, and never use
  `...`. Start a new sentence where the subject changes, though: comma clauses across subjects sound breathless
  ("…Alice spy है, China इसे झूठ बताता है, इस ख़बर के बाद…" was redone as "…और China इसे झूठ बताता है। इस ख़बर
  के बाद…"). A pause tag goes only where the user wants a pause, or before a real reveal — about one per scene at
  most, never at a scene's start (scenes already get a gap between them).
- Turn a section with a one-word question ("Result?", "कैसे?") or an instruction that pulls the viewer in
  ("Trick समझो।").
- Names go one per sentence and end on a closer: "WordPress। Drupal। Joomla। Wikipedia। सब कुछ।" This roll-call
  only works on ElevenLabs; a local voice makes it stop-start ("Moore Threads, आधी। MetaX, आधी।" was redone), so
  there say the names in one sentence or leave them on screen.
- Don't wrap a name in commas: a local voice stops before and after it ("gaming company, Seven Road, ने" broke;
  "gaming company Seven Road ने" was fine).
- "Not needed" pairs land harder than a list of requirements: "ना login चाहिए। ना आपके app में कोई bug चाहिए।"
- Exact beats vague: the real version numbers, the real setting, the real tool. Viewers act on specifics.

Rules, and why:

- **Scene headers** are `## S2 · PROCESSES · [processes]`. The `[id]` is the scene's key everywhere
  (vo.txt, words.json, anchors, compositions), so keep ids short, lowercase, unique.
- **`VO:` is the exact narration** in the configured language — the single source for the voice, the
  subtitles and the timings. Write it the way it will be said: numbers as spoken words when the voice must
  say them, tech terms in the form the audience uses. Never digits: voices misread "8.5.12" and "70%", so
  write "eight point five point twelve" (`script.mjs vo` lists any numerals left). Sentence punctuation and the
  rare pause tag make the pauses — they become breaths in TTS and pause anchors in alignment.
- **Length**: `node script.mjs vo` estimates each scene from `wordsPerSecond` in the config (about 2.5 for
  English, 2.35 for Hindi); trim if over target. A fast local voice reads quicker (VoiceStudio at 1.05× ran
  3.1 words/s in Hindi); `tts.mjs` prints the measured rate after each render with the command to save it.
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
- **CTA scene** ends on the spoken follow line from the config (`cta.spoken`). Before it, an explainer gives
  the lesson in one line (tease a next video only when the user has one planned); a news reel gives the action
  with urgency ("आज ही।").

### Language notes

- **Hindi / Hinglish** (`language: hi`): Hindi in Devanagari with tech terms in Latin script as people say
  them — "Elixir में हर request को अपना process मिलता है।" Write in Devanagari even when the user hands you a
  Roman-script Hinglish draft ("Internet ka seventy percent…" → "Internet का seventy percent…"): voices read
  Devanagari with an Indian accent. Prefer everyday words (चपेट, भरोसा, सीधा) to formal ones. `।` marks
  sentence pauses. English on-screen text works well with Hindi narration.
  Say numbers the way Indian developers do: technical figures (percentages, scores, versions, sizes) as
  English words — "seventy percent", "nine point two", "eight point four point twenty-seven" — and counts and
  time spans in Hindi — "दो CVEs", "बीस लाख connections", "दस साल".
  Keep tech terms and acronyms in Latin script in `VO:` (subtitles show them that way); the voice gets
  Devanagari respellings from `pronounce.mjs`, so they sound Indian, not American, and acronyms are respelled
  with the letters joined (php2shell → पीएचपी टू शेल, CEO → सीईओ). The starter list already covers English
  number words (audio.md §Pronunciation).
  A local voice stretches the final vowel of a short word right before `,` or `।` ("पहला," → "पहलाआ"; "समझो।"
  sounds heavy; "भेज दी जाती थीं।" → "दीईई"). Follow an ordinal with a noun so the pause lands on a consonant
  ("पहला step, … दूसरा step, …"), end on a softer phrase ("तो चलो, पूरा case समझते हैं।", not "तो पूरा case
  समझो।"), or rephrase away from the long-vowel word ("…chips को चुपके से China भेजा जाता था।").
- **Other languages**: the default font (Noto Sans Devanagari) covers Latin and Devanagari. For other
  scripts set `fonts.sans` in the config to a TTF that covers them (for example a Noto Sans variant), and
  check VoiceStudio/Chatterbox support the language before scripting.

### Audio tags

ElevenLabs-style tags in square brackets direct the voice: `VO: [excited] WhatsApp ने एक server पर बीस लाख
connections चलाए। [pause] कैसे?`. They are never shown on screen or in subtitles (script.mjs strips them for
vo.txt; vo.tagged.txt and audio-script.txt keep them). When `audioTags` is on, use the two kinds differently:

- **Pause tags are rare**: one before a reveal, about one per scene at most (§Voice and rhythm). A pause
  before a word also makes it a reliable beat anchor, so spend them on the big slams.
- **Emotion tags carry the delivery**: one where the feeling changes, about one per scene — `[curious]` on a
  question hook, `[whispering]` on a secret, `[excited]` on the trick, `[serious]` on the root cause, `[playful]`
  on a light moment; at most one vocalization (`[chuckling]`, `[sighing]`)
  where a human would make it; sound-effect tags only when the user will generate on ElevenLabs — otherwise
  put the sound in cues.json. A mood tag on every line flattens the delivery.

Vocabulary (ElevenLabs v3 style; it accepts other free-form tags too):

| Kind | Tags |
|---|---|
| Emotion | `[serious]` `[excited]` `[playful]` `[angry]` `[menacing]` `[bored]` `[tired]` `[weak]` |
| Vocalizations | `[chuckling]` `[laughing]` `[sighing]` `[gasping]` `[scoffing]` `[clears throat]` `[coughing]` `[sniffling]` `[yawning]` `[sharp exhale]` `[humming]` `[panting]` |
| Delivery | `[pause]` `[short pause]` `[long pause]` `[whispering]` `[softly]` `[slowly]` `[singing]` `[voice breaking]` |
| Character | `[sleepy drowsy voice]` `[witch voice]` `[drunken voice]` |
| Sound effects | `[keyboard typing]` `[applause]` `[crowd cheering]` `[drum roll]` `[heartbeat]` `[bell ringing]` `[phone ringing]` `[knocking on door]` `[rain falling]` `[engine starting]` `[dog barking]` `[echoing]` |

Local engines honour what they can (reference/audio.md §Audio tags by engine) and report the rest.

## Gate 1 — script review

First run `node script.mjs vo`: besides vo.txt it writes `audio-script.txt`, the whole narration as the
voice will read it (tags kept, pronunciation fixes applied), ready to paste into ElevenLabs or any TTS. Spell
out any numerals it lists and respell every Latin word it lists (audio.md §Pronunciation), then run it again.

Show the user: the hook, the scene table (id, VO, beats), the estimated duration, the 3–5 facts with
sources, and the path to `audio-script.txt`. Ask for approval or edits; iterate until they say it's good,
re-running `vo` after each edit. Then record `gates.script = "<date>"` in reel.json.
