# IRCTC Tatkal — reel script (fast-mode example)

Topic: IRCTC Tatkal
Wordmark: IRCTC TATKAL
Promise: why the Tatkal page spins at 10 AM
Length: ~50 s (tests every library scene) · 9:16 1080×1920 · 30fps
VO language: en. On-screen text: en.

---

## S1 · HOOK · [hook]
Kind: hook-app
VO: Ever tried booking a Tatkal ticket at ten? The page spins, the payment hangs, and the seat is gone. But why?
- @Ever: question bubble "EVER BOOKED A | TATKAL TICKET?"
- @page: the booking page "irctc.co.in | BOOK TICKET | NEW DELHI · MUMBAI | AC 3-TIER · TATKAL | BOOK NOW"
- @spins: loader "PLEASE WAIT…"
- @payment: stuck screen "PAYMENT | ₹ 2,315 | PROCESSING PAYMENT… | UPI, CARD, NET BANKING"
- @gone: stamp "NOT AVAILABLE"
- @why: "WHY? | SYSTEM DESIGN"

## S2 · NUMBER · [number]
Kind: big-number
VO: At two minutes past ten, thirty seven thousand tickets were booked in one minute. That is over six hundred every second.
- @two: "10:02 AM | 16 AUG 2025"
- @tickets: "37,410 | TICKETS / MIN"
- @six: "≈ 623 | / SEC"

## S3 · LAYERS · [stack]
Kind: stack
VO: Your request passes four layers. The edge serves files and blocks bots. Web servers handle login and payment. A router picks the right partition, and the database holds the seats.
- @layers: "HOW A BOOKING FLOWS"
- @edge: "EDGE | CDN · ANTI-BOT | globe"
- @Web: "WEB SERVERS | LOGIN · PAYMENT | server"
- @router: "ROUTER | PICKS THE PARTITION | router"
- @database: "DATABASE | SEATS + LOCKS | db"

## S4 · ONE BOOKING · [steps]
Kind: steps
VO: Booking one seat takes a few steps. Lock the quota, count free berths, apply the rules, write the PNR, then unlock.
- @steps: "booking txn"
- @Lock: "LOCK | train + date + class quota"
- @count: "COUNT | free berths"
- @rules: "RULES | lower berth for seniors"
- @PNR: "WRITE | your PNR"
- @unlock: "COMMIT | unlock for the next one"

## S5 · THE JAM · [jam]
Kind: bottleneck
VO: Here is the jam. Everyone wants the same few trains, and the lock lets one booking through at a time. The rest wait, and that wait is your spinning page.
- @jam: "WHERE IT JAMS"
- @trains: "BOTTLENECK"
- @time: "1 TRANSACTION AT A TIME"
- @spinning: spinner "YOUR PAGE"

## S6 · CTA · [cta]
Kind: end
VO: More servers cannot create more seats. Comment design for the full notes. Follow for more.
- @Comment: "COMMENT | DESIGN"
- @Follow: FOLLOW flies in
