-- =============================================================
-- KakiGuard database schema (SQLite)
-- The file kakiguard.db is created automatically on first run.
-- Delete it (or run `npm run reset-db`) to start fresh.
-- =============================================================

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',      -- 'user' | 'moderator'
  lang          TEXT NOT NULL DEFAULT 'en',        -- 'en' | 'zh' | 'ms' | 'ta'
  points        INTEGER NOT NULL DEFAULT 0,
  color         TEXT NOT NULL DEFAULT '#2F6BFF',
  ui_mode       TEXT NOT NULL DEFAULT 'full',      -- 'simple' (seniors) | 'full'
  consent_at    TEXT,                              -- when they agreed to the privacy notice
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A Safety Circle ("kaki" = buddy) — family, friends or community group
CREATE TABLE IF NOT EXISTS circles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  owner_id    INTEGER NOT NULL REFERENCES users(id),
  invite_code TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS circle_members (
  circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  relation  TEXT,                                   -- e.g. 'Mum', 'Brother'
  PRIMARY KEY (circle_id, user_id)
);

-- Community scam reports. Only 'verified' ones appear as Community Alerts.
CREATE TABLE IF NOT EXISTS reports (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,                       -- the suspicious message / what happened
  platform     TEXT NOT NULL,                       -- sms | whatsapp | telegram | call | email | social | website | other
  scam_type    TEXT NOT NULL,                       -- job | investment | ecommerce | phishing | bank | gov | delivery | romance | other
  asked_to     TEXT,                                -- JSON array e.g. ["click_link","give_otp"]
  lost_money   TEXT NOT NULL DEFAULT 'no',          -- no | yes | skip
  risk_score   INTEGER NOT NULL DEFAULT 0,          -- AI pre-screen score 0..100
  ai_flags     TEXT,                                -- JSON array of flag keys
  status       TEXT NOT NULL DEFAULT 'pending',     -- pending | verified | rejected
  reviewed_by  INTEGER REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id  INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  content    TEXT NOT NULL,
  hidden     INTEGER NOT NULL DEFAULT 0,            -- moderators can hide
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- "I got this too" button — powers the "N people saw this" counter
CREATE TABLE IF NOT EXISTS seen_too (
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  PRIMARY KEY (report_id, user_id)
);

-- "Ask my Kaki": send a suspicious message to your circle for a human second opinion
CREATE TABLE IF NOT EXISTS kaki_checks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id  INTEGER NOT NULL REFERENCES users(id),
  circle_id  INTEGER NOT NULL REFERENCES circles(id),
  content    TEXT NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0,
  ai_flags   TEXT,
  kind       TEXT NOT NULL DEFAULT 'ask',           -- ask | sos | call
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kaki_replies (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  check_id   INTEGER NOT NULL REFERENCES kaki_checks(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  verdict    TEXT NOT NULL,                         -- scam | safe | unsure | calling
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- "Scam or Safe?" game cards. Message text stays as scammers write it (mostly English in SG);
-- the explanation is built from translated flag keys, so it works in every language.
CREATE TABLE IF NOT EXISTS quiz_items (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  sender   TEXT NOT NULL,
  channel  TEXT NOT NULL,                           -- sms | whatsapp | telegram | email | call
  message  TEXT NOT NULL,
  is_scam  INTEGER NOT NULL,
  flags    TEXT NOT NULL DEFAULT '[]',              -- JSON array of flag keys (why it's a scam)
  safe_why TEXT                                     -- translation key (why it's safe)
);

CREATE TABLE IF NOT EXISTS quiz_scores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  correct    INTEGER NOT NULL,
  total      INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Notifications ----------
-- level: 'urgent' (SOS, risky live call) | 'family' (asks, replies) | 'info' (community, report status)
-- pushed: 1 if it buzzed the phone, 0 if it went quietly into the inbox (settings, quiet hours, mute)
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,                         -- ask | sos | call | reply | community | report | escalated
  level      TEXT NOT NULL,
  actor_id   INTEGER REFERENCES users(id),
  ref_id     INTEGER,                               -- kaki_checks.id or reports.id
  body       TEXT,
  pushed     INTEGER NOT NULL DEFAULT 1,
  read       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- "Don't disturb my family" settings, one row per user (created on first use)
CREATE TABLE IF NOT EXISTS notify_settings (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  receive        TEXT NOT NULL DEFAULT 'family',    -- all | family | urgent : what is allowed to buzz me
  quiet_on       INTEGER NOT NULL DEFAULT 1,
  quiet_start    TEXT NOT NULL DEFAULT '22:00',
  quiet_end      TEXT NOT NULL DEFAULT '07:00',
  muted          TEXT NOT NULL DEFAULT '[]',        -- JSON array of user ids whose non-urgent asks stay quiet
  ask_mode       TEXT NOT NULL DEFAULT 'main_first',-- circle | main_first : who my asks go to
  main_kaki_id   INTEGER REFERENCES users(id),
  call_alert     TEXT NOT NULL DEFAULT 'auto',      -- auto | ask | off : risky live calls
  weekly_summary INTEGER NOT NULL DEFAULT 1
);

-- Every message check, so families get a quiet weekly summary instead of pings
CREATE TABLE IF NOT EXISTS checks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score      INTEGER NOT NULL,
  level      TEXT NOT NULL,
  top_flag   TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Safety Circle: shared block list ----------
-- Block a number once, and everyone in your circle is warned about it.
CREATE TABLE IF NOT EXISTS circle_blocks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  circle_id  INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  number     TEXT NOT NULL,                         -- normalised, e.g. 81234567
  label      TEXT,                                  -- "Fake DBS caller"
  added_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (circle_id, number)
);

-- ---------- "Is it really you?" ----------
-- Someone on the phone claims to be your son. The app asks the REAL son's account.
CREATE TABLE IF NOT EXISTS verify_requests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending',      -- pending | yes | no
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  answered_at TEXT
);
