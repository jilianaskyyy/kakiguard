// =============================================================
// Privacy helpers (shared by server and app)
//  - redact(): removes NRIC/FIN, card numbers, bank account numbers and OTP codes
//    BEFORE anything is saved, so the database never holds them (PDPA "protection" +
//    PDPC's NRIC guidelines). Scammers' phone numbers are kept on purpose: they help others.
//  - phone number helpers for the family block list.
// =============================================================

const NRIC = /\b[STFGM]\d{7}[A-Z]\b/gi;
const CARD = /\b\d(?:[ -]?\d){12,18}\b/g;
const BANK_ACC = /\b\d{3}-\d{5,6}-\d{1,3}\b/g;
const OTP = /\b(otp|one[- ]time (?:password|pin|code)|verification code|pin|code)(\D{0,15})(\d{4,8})\b/gi;

export function redact(text = '') {
  return String(text)
    .replace(NRIC, '[NRIC removed]')
    .replace(BANK_ACC, '[account no. removed]')
    .replace(CARD, (m) => (m.replace(/\D/g, '').length >= 13 ? '[card no. removed]' : m))
    .replace(OTP, (_, word, gap) => `${word}${gap}[code removed]`);
}

// Singapore numbers: keep the last 8 digits (drops +65 / 65 prefixes and spaces)
export function normalizeNumber(raw = '') {
  const d = String(raw).replace(/\D/g, '');
  if (d.length < 6) return null;
  if (d.length === 10 && d.startsWith('65')) return d.slice(2);
  return d.length > 8 && d.startsWith('65') ? d.slice(2) : d;
}

// Finds phone-number-looking strings: "+65 8123 4567", "81234567", "6123-4567"
const PHONE = /(?:\+?65[\s-]?)?\b[3689]\d{3}[\s-]?\d{4}\b/g;
export function findNumbers(text = '') {
  const out = [];
  let m;
  PHONE.lastIndex = 0;
  while ((m = PHONE.exec(text))) out.push({ start: m.index, end: m.index + m[0].length, raw: m[0], norm: normalizeNumber(m[0]) });
  return out;
}

export function prettyNumber(n = '') {
  return n.length === 8 ? `${n.slice(0, 4)} ${n.slice(4)}` : n;
}
