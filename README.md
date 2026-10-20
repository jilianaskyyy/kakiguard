# KakiGuard 
**Don't face a scam alone.** A community-powered scam protection app for Singapore — NCS Hackathon 2026, Problem Statement 2.

> Why not "ScamShield"? That's already the name of the official government app (scamshield.gov.sg). Using it would confuse judges and users, so this project is called **KakiGuard** — *kaki* = buddy in Singlish.

---

## What makes it new (the wow factor)

Most scam apps help *you* check *after* the fact. KakiGuard protects people **in the moment** and **together**:

| Features |
|---|---|
| **Live Call Guard** | Put a call on speaker. The app listens, highlights scam phrases as they're spoken, and when risk hits "high" the whole screen turns red: **Hang up now**. Your family's phones light up *during* the call. |
| **Ask my Kaki** | One tap sends a suspicious message to your family. Their phones pop up a big *Scam! / Looks okay / I'm calling you* sheet. Answers stream back live. A human second opinion in seconds. |
| **Highlighter explanation** | Instead of "this is a scam", the exact risky words are marked with a highlighter. Tap any mark to learn *why*. Teaches people, doesn't just judge. |
| **Community memory** | "8 people reported something like this" — your message is matched against verified reports from neighbours. |
| **Moderated alerts** | AI pre-screens reports; a human moderator verifies; then every connected phone gets an alert instantly. No AI accusations published automatically. |
| **Scam or Safe?** | Swipeable game for kids and teens, explained in the user's language. |
| **Is it really you?** | Beats AI voice clones: when a caller claims to be family, KakiGuard asks that person's *own phone* "Are you calling Mum right now?". Plus a family code word that is never stored. |
| **Family block list** | Block a number once and your whole Safety Circle is warned whenever it shows up. |
| **Simple / Full mode** | Chosen at sign-up and can be changed anytime. Simple = three giant buttons and the family, for seniors. Full = everything. |
| **Privacy built in (PDPA)** | Checked messages are never stored, NRIC/card/OTP numbers are removed before saving, old data auto-deletes, and users can download or delete their data. |
| **Quiet by default** | Notifications screen with a weekly family summary instead of constant pings. Asks go to your *main kaki* first and only reach the rest of the family if nobody answers in 2 minutes. Quiet hours, mute, and "urgent only" mode. SOS and risky live calls always come through. |
| **For all ages** | 4 languages (English, 中文, Melayu, தமிழ்), a one-tap **AA** bigger-text mode, very large buttons.|

---

## Tech stack

| Part | Tool | Why |
|---|---|---|
| Phone app | **React 18 + Vite** | Fast dev server, hot reload |
| Routing | react-router-dom | Pages like `/check`, `/circle` |
| Real-time | **Socket.io** | Family pop-ups, live call risk, community alerts |
| API | **Node.js + Express** | Simple REST API |
| Database | **SQLite** (better-sqlite3) | A single file, no database server to install |
| Login | JWT + bcrypt | Secure passwords, stays logged in |
| AI | Ollama | Plain-language explanation in the user's language |
| Install on phone | PWA (manifest + service worker) | "Add to Home Screen", no app store needed |

---

## 1. Install the tools (once)

1. **Node.js 20, 22 or 24** — https://nodejs.org (pick "LTS"). Check: `node -v`
2. **VS Code** — https://code.visualstudio.com
3. **Git** (optional, for teamwork) — https://git-scm.com

Recommended VS Code extensions (VS Code will suggest them when you open the folder):
ES7+ React snippets, ESLint, Prettier, and **SQLite Viewer** (to look inside the database).

## 2. Open and set up the project

```bash
# unzip kakiguard.zip, then in VS Code: File → Open Folder → kakiguard
# open the terminal: View → Terminal  (or Ctrl + `)

npm run setup          # installs everything (root, server, client) — takes 1–2 minutes
```

Optional: copy `server/.env.example` to `server/.env` and fill it in (see section 6 for the AI key).

## 3. Run it

```bash
npm run dev
```

This starts two things at once:
- **api** (green) → the Node server on http://localhost:3001 (creates and seeds `server/kakiguard.db` on first run)
- **app** (blue) → the React app on **http://localhost:5173** ← open this

Tip: in Chrome press `F12` → the phone icon (device toolbar) → pick "iPhone 14" to see it like a phone.

### Demo accounts (password `demo123`)
Tap any face on the login screen.

| User | Role | Try |
|---|---|---|
| Jiliana | user, English | Check messages, Call Guard, Ask my family |
| Mum | user, 中文 | Receives family pop-ups in Chinese |
| Dad, Ethan | users | Family members |
| Moderator Mei (`mod`) | moderator | "Review" tab → verify reports |

Mum and Dad use **Simple mode**; Jiliana and Ethan use **Full mode**.

**See the real-time magic:** open Jiliana in a normal Chrome window and Mum in an **Incognito** window side by side.

## 4. Open it on a real phone

Phone and laptop must be on the **same Wi-Fi**.

1. `npm run dev` prints a line like `Network: http://192.168.1.23:5173` — open that on your phone.
2. Install it: Android Chrome → ⋮ → *Add to Home screen*. iPhone Safari → Share → *Add to Home Screen*.

**Microphone (Live Call Guard / Speak instead) needs HTTPS on phones.** Two options:

```bash
npm run dev:https        # self-signed https → on the phone tap "Advanced → Proceed"
```
or for the smoothest stage demo, build and tunnel:
```bash
npm run build && npm start            # one server on port 3001 serves app + API
npx cloudflared tunnel --url http://localhost:3001   # gives you a public https://….trycloudflare.com link
```
Speech recognition works best in **Chrome on Android/desktop**. On iPhone, use the **"Play a demo scam call"** button — it always works and is the safest choice on stage anyway.

## 5. Project structure

```
kakiguard/
├── package.json            ← `npm run setup / dev / build / start`
├── shared/
│   ├── scamEngine.js       ← THE BRAIN: red-flag rules, link checker, risk score, similarity
│   └── privacy.js          ← removes NRIC/card/OTP numbers; phone number helpers
├── server/                 ← Node + Express + Socket.io + SQLite
│   ├── index.js            ← starts the server, real-time rooms, serves built app
│   ├── schema.sql          ← all database tables (read this first!)
│   ├── db.js               ← opens kakiguard.db, creates tables, seeds on first run
│   ├── seed.js             ← demo users, family circle, reports, quiz cards
│   ├── auth.js             ← login tokens + "must be logged in / moderator" checks
│   ├── ai.js               ← optional Claude explanation
│   ├── presence.js         ← who's online (green dots)
│   ├── notify.js           ← who gets buzzed vs. who gets it quietly (quiet hours, mute, urgency)
│   ├── routes/
│   │   ├── auth.js         ← /api/auth/login, /register, /me
│   │   ├── check.js        ← /api/check  (scam checker)
│   │   ├── reports.js      ← /api/reports, comments, "I got this too", /stats
│   │   ├── circles.js      ← /api/circles, /api/kaki (ask family, SOS, replies)
│   │   ├── learn_mod.js    ← /api/quiz, /leaderboard, /api/mod/* (moderator)
│   │   ├── notifications.js← /api/notifications, /api/notify-settings
│   │   └── safety.js       ← /api/blocks (family block list), /api/verify (Is it really you?)
│   └── .env.example
└── client/                 ← React app (Vite)
    ├── index.html, vite.config.js
    ├── public/             ← manifest, icons, service worker (installable app)
    └── src/
        ├── main.jsx, App.jsx    ← entry + page routes
        ├── AppContext.jsx       ← logged-in user, socket, toasts, pop-ups
        ├── api.js               ← fetch helper for /api
        ├── styles.css           ← all styling (colours at the top)
        ├── i18n/                ← en.js, zh.js, ms.js, ta.js, notif.js (Notifications text) + index.jsx
        ├── components/ui.jsx    ← RiskDial, HighlightedText, TabBar, KakiPopup…
        └── pages/               ← Login, Home, Check, CallGuard, Sos, Circle,
                                   Community (list/detail/new report), Learn, ModProfile, Notifications
```

## 6. How the pieces work

### Real-time (Socket.io)
When a phone connects it joins rooms: `user:<id>`, `circle:<id>` for each family circle, and `mods` for moderators.
| Event | Sent when | Who receives |
|---|---|---|
| `kaki:new` | someone taps Ask my family / SOS / Call Guard reaches high | their circle |
| `kaki:reply` | a family member answers | the circle |
| `call:risk` | Call Guard risk level changes | the circle (red banner) |
| `mod:new` | a new report is submitted | moderators |
| `community:alert` | a moderator verifies a report | everyone |
| `presence` | someone opens/closes the app | their circle (green dots) |
| `notif:new` | any notification is created | that one person. `push: true` means buzz (pop-up/toast); `false` means it only goes in the inbox |

### Notification rules (`server/notify.js`)
Every notification is saved to the inbox. Whether it also *buzzes* depends on the receiver's settings:

| Level | Examples | Buzzes when… |
|---|---|---|
| urgent | SOS, risky live call | always, even in quiet hours |
| family | "is this a scam?" asks, replies | not in quiet hours, not "urgent only", sender not muted |
| info | community alerts, your report verified | only if the receiver picked "Everything" |

Asks go to your **main kaki** first. If nobody replies within `ESCALATE_SECONDS` (default 120, set it in `server/.env`, e.g. 20 for a demo), the rest of the circle is asked. Live Call Guard only shares with family after a 5-second cancellable countdown (or a tap, or never, depending on the caller's setting). Normal message checks never notify anyone; they're counted in the weekly summary.

### Database
`server/kakiguard.db` is created automatically. Open it in VS Code with the SQLite Viewer extension to show judges the tables. Tables: `users, circles, circle_members, reports, comments, seen_too, kaki_checks, kaki_replies, quiz_items, quiz_scores, notifications, notify_settings, checks, circle_blocks, verify_requests` — see `schema.sql`.

Start fresh any time: `npm run reset-db`.

## 7. API reference

All routes except login/register need the header `Authorization: Bearer <token>`.

| Method | Route | Body / notes |
|---|---|---|
| POST | /api/auth/login | `{ username, password }` → `{ token, user }` |
| POST | /api/auth/register | `{ name, username, password, lang }` |
| GET | /api/me | user + stats |
| POST | /api/check | `{ text, lang }` → score, level, flags, spans, actions, similar, ai |
| GET | /api/reports | `?type=job&q=dbs&mine=1` |
| GET / POST | /api/reports/:id, /api/reports | detail with comments / new report (goes to moderators) |
| POST | /api/reports/:id/seen, /comments | "I got this too", comment |
| GET | /api/stats | home screen numbers |
| GET / POST | /api/circles, /api/circles/join | my circles / join with `{ code, relation }` |
| GET / POST | /api/kaki | feed / `{ content, kind: 'ask' \| 'sos' \| 'call' }` |
| POST | /api/kaki/:id/reply | `{ verdict: 'scam' \| 'safe' \| 'unsure' \| 'calling' }` |
| GET / POST | /api/quiz, /api/quiz/score | game cards / save score |
| GET | /api/mod/queue | moderators: pending reports |
| GET | /api/notifications | inbox, unread count, weekly summary |
| POST | /api/notifications/read-all, /:id/read | mark as read |
| GET / POST / DELETE | /api/blocks, /api/blocks/:id | family block list `{ number, label }` |
| POST | /api/verify, /api/verify/:id/answer | "Is it really you?" `{ user_id }` / `{ answer: 'yes' \| 'no' }` |
| GET / DELETE | /api/me/export, /api/me | download my data / delete account `{ confirm: 'DELETE' }` |
| GET / PATCH | /api/notify-settings | `{ receive, quiet_on, quiet_start, quiet_end, ask_mode, main_kaki_id, call_alert, muted, weekly_summary }` |
| POST | /api/mod/reports/:id | `{ action: 'verify' \| 'reject' }` |


## Important
KakiGuard spots warning signs; it cannot be 100% sure. The app always points people to official help: the **24/7 ScamShield Helpline 1799**, their bank, and the police (999 in an emergency). 
