// Opens the SQLite database, creates tables, and seeds demo data on first run.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seed } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'kakiguard.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

// Small migrations, so an older kakiguard.db keeps working after you update the code
const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!cols.includes('ui_mode')) db.exec("ALTER TABLE users ADD COLUMN ui_mode TEXT NOT NULL DEFAULT 'full'");
if (!cols.includes('consent_at')) db.exec('ALTER TABLE users ADD COLUMN consent_at TEXT');

const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
if (n === 0) {
  seed(db);
  console.log('🌱 Database created and seeded with demo data');
}

// Small helpers to keep the routes readable
export const one = (sql, ...p) => db.prepare(sql).get(...p);
export const all = (sql, ...p) => db.prepare(sql).all(...p);
export const run = (sql, ...p) => db.prepare(sql).run(...p);
export const json = (v, fallback = []) => { try { return v ? JSON.parse(v) : fallback; } catch { return fallback; } };

// ---------- Retention: keep data only as long as it's useful (PDPA retention limitation) ----------
const KEEP_ASKS = Number(process.env.KEEP_ASK_DAYS) || 30;       // family asks: message text wiped after 30 days
const KEEP_NOTIFS = Number(process.env.KEEP_NOTIF_DAYS) || 90;   // notifications deleted after 90 days
const KEEP_CHECKS = Number(process.env.KEEP_CHECK_DAYS) || 90;   // check scores (no text) deleted after 90 days
export function runRetention() {
  const a = run(`UPDATE kaki_checks SET content = '' WHERE content != '' AND created_at < datetime('now', ?)`, `-${KEEP_ASKS} days`).changes;
  const b = run(`DELETE FROM notifications WHERE created_at < datetime('now', ?)`, `-${KEEP_NOTIFS} days`).changes;
  const c = run(`DELETE FROM checks WHERE created_at < datetime('now', ?)`, `-${KEEP_CHECKS} days`).changes;
  run(`DELETE FROM verify_requests WHERE created_at < datetime('now', '-7 days')`);
  if (a + b + c) console.log(`🧹 Retention: wiped ${a} old asks, ${b} notifications, ${c} check records`);
}
runRetention();
setInterval(runRetention, 12 * 60 * 60 * 1000).unref();
