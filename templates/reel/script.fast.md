# {{TITLE}} — reel script (fast mode)

Topic: {{TOPIC}}
Wordmark: <2–3 words for the header: the topic only, no series name or part number>
Promise: <the one thing the viewer learns, in one line>
Length: 45–60s · 5 scenes · 9:16 1080×1920 · 30fps
VO language: {{LANGUAGE}} — {{VOICE_STYLE}} On-screen text: {{ONSCREEN}}.
Palette: bg {{BG}} · accent {{ACCENT}} · success {{SUCCESS}} · text {{TEXT}} (+ white). Max 3 colours + white.
Logo: {{LOGO}} (assets/logo.svg)

Fast mode: every scene is a ready-made library scene (`Kind:` above its VO). Each @beat's quoted label fills the
kind's next slot, fields split on " | "; start a label with a slot name ("stamp: …") to skip slots. Keep each field
to 2–5 words, and land each scene's last beat at least 1.5 s before the scene ends so it can be read. Slots per kind
are listed in build/<v>/assets/library.js; the examples below use them all.
A process told step by step can use `Kind: steps` in S3 or S4: a window-title beat, then up to 6 "KEY | TEXT" steps.
Stack layer icons: globe, shield, server, router, db, lock, cloud, chat, train, clock, phone, bank, user, laptop, key.

---

## S1 · HOOK · [hook]
Kind: hook-app
VO: [curious] <a question the viewer has lived, said like to a friend: the page spins, the payment hangs, the thing is gone. Why?>
- @<word>: question bubble "<LINE 1> | <LINE 2?>"
- @<word>: the app's own page "<app.url> | <PAGE HEADING> | <ITEM> | <ITEM DETAIL> | <BUTTON>"
- @<word>: loader card "PLEASE WAIT…"
- @<word>: stuck screen "<PAYMENT> | <₹ AMOUNT> | <PROCESSING…> | <OPTION, OPTION, OPTION>"
- @<word>: stamp "<NOT AVAILABLE>"
- @<word>: "<WHY?> | <SYSTEM DESIGN>"

## S2 · NUMBER · [number]
Kind: big-number
VO: <the one number that shows the scale, with its time or date, then what it means per second>
- @<word>: hero number alone "<10:02 AM> | <16 AUG 2025>"
- @<word>: counter "<37,410> | <TICKETS / MIN>"
- @<word>: second counter "<≈ 623> | </ SEC>"

## S3 · HOW IT WORKS · [stack]
Kind: stack
VO: <the layers a request passes through, one connected sentence each, with an everyday picture>
- @<word>: "<HOW A BOOKING FLOWS>"
- @<word>: "<EDGE> | <CDN · ANTI-BOT> | globe"
- @<word>: "<WEB SERVERS> | <LOGIN · PAYMENT> | server"
- @<word>: "<ROUTER> | <PICKS THE PARTITION> | router"
- @<word>: "<DATABASE> | <SEATS + LOCKS> | db"

## S4 · THE BOTTLENECK · [jam]
Kind: bottleneck
VO: <where it breaks and why: everyone wants the same thing at once, one at a time gets through>
- @<word>: "<WHERE IT JAMS>"
- @<word>: "<BOTTLENECK>"
- @<word>: "<1 TRANSACTION AT A TIME>"
- @<word>: spinner "<YOUR PAGE>"

## S5 · CTA · [cta]
Kind: end
VO: <one-line takeaway>. <Comment KEYWORD for the full notes>. {{CTA_SPOKEN}}
- @<word>: "COMMENT | <KEYWORD>"
- @<word>: "next: NEXT | <TOPIC>" (optional, needs the "next:" prefix; drop it to keep the reel evergreen)
- @<the follow word>: FOLLOW flies in (always the last beat)
