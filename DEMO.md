# 5-minute demo script

Setup before you go on stage (answers to judges' questions are in `JUDGES_QA.md`):
- `npm run reset-db` then `npm run build && npm start` (one process, port 3001). Tunnel with cloudflared if using real phones.
- **Laptop on the projector:** Jiliana. **Phone 1 (pass to a judge):** Mum (switches the app to 中文 automatically). **Phone 2 / second window:** Moderator Mei.
- Turn the laptop volume up — the demo scam call speaks out loud.

---

### 1. The problem (30 s)
"Scams don't wait for you to search a website. They happen in the moment — an SMS at 11pm, a 'police officer' on the phone. And the people most at risk are often alone when it happens."

### 2. Check a message (60 s) — Jiliana
Home → **Check it now** → **Try an example** (DBS SMS) → **Check message**.
- The needle swings to red: *Very likely a scam*.
- Point at the **highlighter marks** — tap `dbs-sg-secure.com`: "Fake-looking link: copies a real brand but isn't the official site."
- "**8 people reported something like this**" — community memory.
- Clear next steps, ending with *Call 1799*.

### 3. Ask my Kaki (45 s) — the human loop
Tap **Ask my family**. Mum's phone (judge holding it) pops up in Chinese: *Jiliana 问：这是诈骗吗？* Judge taps **是诈骗！**
Laptop instantly shows "Mum says it's a scam". "AI gives the warning signs. Family gives the trust."

### 4. Live Call Guard (90 s) — the wow moment
Home → **I'm on a call now** → **Play a demo scam call**.
The "ICA officer" speaks. Watch the meter climb: amber at "money laundering", then at "don't tell anyone… transfer to a safe account" the screen **flashes red: Hang up now**.
A 5-second *Telling your family…* countdown appears (with *Don't tell them*). Then Mum's phone shows a red banner: *Jiliana is on a suspicious call — 100/100*. "Her family knows **while the call is still happening** — before any money moves."

### 4b. "Won't this annoy my family?" (30 s)
Tap the bell → **Inbox**: a calm *This week in Jiliana's Family* summary instead of a stream of pings; community alerts marked *Arrived quietly*.
**Settings**: asks go to Mum first, the rest only if she doesn't answer; quiet hours; mute. "We only interrupt your family when a scammer is trying to cut you off from them."

### 4c. "What if AI copies my son's voice?" (40 s): the Safety Circle answer
Mum's phone (Simple mode: three giant buttons) → **I'm on a call** → **Caller says they are family?** → pick **Ethan** → **Ask Ethan's phone**.
Ethan's phone pops up: *Mum asks: are you calling her right now?* → he taps **No, it's not me** → Mum's screen turns red: *Ethan says it is NOT him. Hang up now.*
"A voice can be faked. Your son's own phone can't."
Then Jiliana → **Check** → **Try an example** (the ICA one): *Blocked by your family*, because Dad blocked that number. "Block once, the whole family is protected."

### 5. Report → moderate → protect everyone (45 s)
Moderator Mei → **Review** → IRAS refund SMS (AI risk shown) → **Verify & alert everyone**.
Every phone gets a red *New community alert* toast. "AI never publishes accusations by itself. A human verifies."

### 6. Learn (20 s)
Learn → **Play now** → swipe a card to **Scam**. "For kids and teens — same warning signs, as a game."

### 7. Close (20 s)
"KakiGuard turns scam awareness from a lonely decision into a shared one. **Don't face a scam alone.**"
Show: 4 languages switcher, **AA** big text button.

---

**Likely judge questions**
- *Is the call recorded?* No. Speech is turned into text on the device by the browser, checked locally, and nothing is stored unless the user taps Alert family.
- *What if AI is wrong?* We show *why* (red flags), never just a verdict; humans (family + moderators) decide; we always point to 1799 and official channels.
- *Why not just use ScamShield?* We complement it: ScamShield blocks known numbers and SMS; KakiGuard handles the moment of doubt, live calls, and brings family in.
- *How does it scale?* Rule engine is instant and free; AI is optional; SQLite can be swapped for PostgreSQL by changing `server/db.js`.
