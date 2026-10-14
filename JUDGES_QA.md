# KakiGuard: answers to judges' feedback

Each answer starts with a short line you can say out loud. After that comes what the app actually does today, with file names so you can show the code. Anything still a plan is marked **Next step**, so we never claim more than we've built.

---

## 1. How does the PDPA affect us?

**Say:** "We collect as little as possible, never keep the messages you check, remove NRIC, card and OTP numbers automatically, and let you download or delete your data in two taps."

The PDPA applies because we collect personal data: names, Safety Circle members, family asks, and scam reports. Here's how each obligation maps to the app:

| PDPA obligation | What KakiGuard does |
|---|---|
| **Consent** | Sign-up needs a tick on the privacy notice (`consent_at` is saved). Under 13: the PDPC's 2024 guidelines need a parent's or guardian's consent, so sign-up tells children to set up with a parent. **Next step:** parent-created child accounts from inside the Safety Circle. |
| **Notification + purpose** | A plain-language privacy notice (`/privacy`) says what we collect, why, and who sees it. No ads, no selling data. |
| **Purpose limitation** | Family asks are only visible inside your circle. Community reports go public only after a moderator approves them. |
| **Access & correction** | Profile → Privacy → **Download my data** gives one JSON file with everything we hold (`GET /api/me/export`). |
| **Withdrawing consent** | Profile → Privacy → **Delete my account**, after typing DELETE (`DELETE /api/me`). Your reports, comments and asks are removed. |
| **Protection** | Passwords are hashed with bcrypt. **NRIC/FIN, card numbers, bank account numbers and OTP codes are removed before anything is saved** (`shared/privacy.js`). This also follows the PDPC's NRIC guidelines. Rate limits and security headers are on (`server/index.js`). |
| **Retention limitation** | The text of messages you check is **never stored**, only the score. Family-ask text is wiped after 30 days, and notifications and scores after 90 days. This runs automatically every 12 hours (`server/db.js`, `runRetention`). |
| **Transfer limitation** | The optional AI explanation sends text to an overseas AI provider. We only call it when the free rule engine is unsure, and we **remove personal numbers first** (`routes/check.js`). **Next step:** host the server in a Singapore cloud region and name the AI provider in the notice. |
| **Data breach notification** | **Plan:** if a breach affects 500 or more people, or could cause significant harm, we notify the PDPC within 3 calendar days of finishing our assessment, and tell affected users. |
| **Accountability** | **Next step:** name a Data Protection Officer (put the team email in `client/src/pages/Privacy.jsx`) and write a data protection impact assessment, which the PDPC expects for services that children use. |

**Data about other people.** Scam reports can contain a scammer's phone number. That number might belong to a money mule, or be spoofed from an innocent person. So: (1) every report is checked by a moderator before it's public, (2) the family block list is only visible inside your circle, and (3) **next step:** hide the middle digits of numbers in public posts.

**Why it matters:** organisations can be fined up to S$1 million, or 10% of Singapore turnover for those earning over S$10 million a year.

---

## 2. How do we take care of the data?

**Say:** "The safest data is data we never collect."

- **Never collected:** the messages you check, call audio (speech is turned into text on your phone and thrown away), and your family code word (agreed in person, never typed into the app).
- **Removed automatically:** NRIC, card, bank account numbers and OTPs, before anything is saved.
- **Deleted on a schedule:** after 30 days for ask text, 90 days for the rest.
- **Who sees what:** asks and block lists stay inside your Safety Circle. Community posts are public only after a moderator approves them. Moderators can hide comments.
- **Your controls:** download your data, delete your account, quiet hours, mute people.

---

## 3. How do we make it cheaper, better, faster and safer?

**Cheaper**
- The scam checker is our own rule engine. It's free to run, works offline, and runs on the phone during calls.
- The paid AI only runs **when the rule engine is unsure** (score 20–75), and answers are **cached**, so a viral scam is only explained once (`routes/check.js`).
- It's a web app you install from the browser, so there are no app-store fees for the prototype, and one codebase covers Android, iPhone and desktop.
- SQLite is a single file with no database server to pay for.

**Better**
- Explanations, not verdicts: the risky words are highlighted with the reason.
- Real people decide: family for asks, moderators for public alerts.
- Two app styles for different users (see question 8). Four languages.

**Faster**
- Live Call Guard analyses speech **on the phone**, so nothing has to travel to a server and back.
- Family alerts arrive in real time (Socket.io), in under a second on the same Wi-Fi.
- **Next step:** a search index for "N people reported this" once there are thousands of reports. Today it checks every report one by one.

**Safer**
- Rate limits on login, checks and identity checks. Security headers (helmet). Passwords hashed with bcrypt.
- Personal numbers removed before saving and before sending anything to AI.
- AI never publishes accusations; a moderator verifies every public alert.
- The identity check trusts your family member's logged-in phone, not a voice (see question 5).
- **Next step:** shorter login sessions using secure cookies, two-factor login for moderators, and an outside security review before launch.

---

## 4. Scalability

**Say:** "The prototype runs on one small server. Every part has a clear way to grow."

| Part | Today (hackathon) | At national scale |
|---|---|---|
| Database | SQLite file | Managed PostgreSQL (same tables; only `server/db.js` changes) |
| Real-time | One Socket.io server | Several servers sharing messages through Redis (Socket.io Redis adapter) |
| Logins | JWT, so any server can check them | Same, behind a load balancer |
| "Ask the rest of the family after 2 minutes" | A timer in memory (lost if the server restarts) | A job queue such as BullMQ on Redis |
| Similar-report search | Compares against every report | A full-text or vector search index |
| Phones | Web app | The same React code wrapped as a native app (for example with Capacitor) for call blocking (question 6) |
| Static files | Served by Node | A CDN |

Most of the work happens on the phone (rule engine, Call Guard), so server load grows slowly as users are added.

---

## 5. How do we stop AI imitating a family member's voice?

**Say:** "A voice can be faked. Your son's own phone can't. So we ask his phone, not the voice."

Built today:
1. **"Is it really you?"** On a call, Mum taps **Caller says they are family?** and picks Ethan. **Ethan's own KakiGuard** gets an urgent pop-up: *"Mum asks: are you calling her right now?"* He taps **No, it's not me**, and Mum's screen turns red: *Ethan says it is NOT him. Hang up now.* If Ethan doesn't answer within 60 seconds, she's told to hang up and call him back on the number she already has. (`components/Verify.jsx`, `routes/safety.js`)
2. **Family code word.** The Safety Circle page asks families to agree on a secret word **in person**. If "family" calls asking for money, ask for the word. The app never stores it, so a hacked account can't leak it.
3. **Live Call Guard still listens to what's said.** A cloned voice still has to ask for money, secrecy or OTPs, and those words trigger the warning.

Why it works: the check goes through a different channel the scammer doesn't control. It's the same idea as banks confirming a transfer in their own app.

---

## 6. If I block a number, can it be blocked on my Safety Circle's phones too?

**Say:** "Yes. Block once and the whole family is protected. In this web version that means a warning inside KakiGuard; the app-store version would block the call itself."

Built today:
- **Family block list** on the Safety Circle page. Anyone adds a number, and everyone in the circle sees it instantly.
- If a blocked number appears in a message someone checks, KakiGuard flags **"Blocked by your family"**, says who blocked it, and sets the risk to very high (`routes/check.js`).

Honest limit: a website **can't block phone calls**. Phones only let installed apps do that:
- **Android:** an app given the call-screening role can reject calls from a list.
- **iPhone:** an app can provide a list of numbers to block through Apple's Call Directory extension.

**Next step:** wrap the app as a native app, and that same shared list syncs into each family member's phone blocker. ScamShield blocks numbers the authorities already know are scams; our list covers new numbers your own family met first.

---

## 7. The Safety Circle is our selling point

**Say:** "ScamShield blocks known scam numbers. KakiGuard puts your family on the call with you."

What changed in the app to make the circle the centre:
- **Home opens on "Your Safety Circle":** who's online, the last family ask, the **Is it really you?** button and the **Family block list** count. The checker comes second.
- The tab is called **Circle**, and the page now holds everything the family does together: members (each with *Is it really you?*), the family code word, the shared block list, and asks with replies.
- Everything new from this round of feedback lives in the circle: the identity check, the code word and the block list.

The Safety Circle in one list:
1. **Ask my Kaki:** a second opinion from family in seconds.
2. **Live Call Guard:** family see a risky call while it's happening.
3. **Is it really you?:** beats AI voice clones.
4. **Family block list:** one block protects everyone.
5. **Quiet by default:** a weekly summary instead of constant pings, and only urgent alerts break through.

---

## 8. Two modes: Simple for seniors, Full for adults, chosen at sign-up

Built today:
- **Sign-up asks "How should KakiGuard look?"** with two picture cards: **Simple** (big buttons, bigger text, fewer screens) and **Full** (everything). It can be changed any time in Profile → App style.
- **Simple mode:** three giant buttons (Check a message, I'm on a call, Get help), the family below them, three tabs (Home, Check, Circle) and larger text. Fewer details on results, no community feed or games, and no editing of invite codes or block lists.
- **Full mode:** the Safety Circle hero, community alerts, games, notification settings and moderator tools.
- Demo accounts: **Mum and Dad use Simple**, Jiliana and Ethan use Full, so judges see both side by side.

---

Sources
- [PDPA data breach notification guide](https://complyhq.app/blog/pdpa-data-breach-notification-guide)
- [PDPC Advisory Guidelines on Children's Personal Data (Rajah & Tann summary)](https://www.rajahtannasia.com/viewpoints/pdpc-issues-advisory-guidelines-on-childrens-personal-data-in-the-digital-environment/)
- [PDPC Advisory Guidelines on Children's Personal Data (PDF)](https://www.pdpc.gov.sg/-/media/files/pdpc/pdf-files/advisory-guidelines/advisory-guidelines-on-the-pdpa-for-children's-personal-data-in-the-digital-environment_mar24.pdf)
