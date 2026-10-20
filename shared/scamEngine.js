// =============================================================
// KakiGuard Scam Engine (shared by the server AND the phone app)
// -------------------------------------------------------------
// A fast, explainable, offline rule engine. It never says
// "this IS a scam" — it finds red flags, highlights WHERE they
// are in the message, and gives a risk score from 0 to 100.
//
// The AI layer (server/ai.js) adds a plain-language explanation
// on top of this when an API key is configured. Without a key,
// this engine alone still powers the whole demo.
// =============================================================

// Each rule: a flag key (translated in client/src/i18n), a weight,
// and patterns. Patterns cover English, Singlish, Chinese and Malay.
export const RULES = [
  {
    flag: 'urgency', weight: 15,
    patterns: [/\burgent(ly)?\b/i, /\bimmediately\b/i, /\bwithin (24|48|\d+) ?(hours|hrs|minutes|mins)\b/i,
      /\btoday only\b/i, /\bact now\b/i, /\blast (chance|warning|reminder)\b/i, /\bexpire[sd]?\b/i,
      /\bsuspend(ed)?\b/i, /\bfinal notice\b/i, /\bby (today|tonight|tomorrow|end of (the )?day)\b/i, /\bright now\b/i, /立即|马上|紧急|即将过期/, /\bsegera\b/i],
  },
  {
    flag: 'otp_request', weight: 35,
    patterns: [/\botp\b/i, /one[- ]time (password|pin|code)/i, /\bverification code\b/i, /\b6[- ]digit code\b/i,
      /\bsingpass (password|code)\b/i, /验证码/, /\bkod pengesahan\b/i],
  },
  {
    flag: 'money_transfer', weight: 30,
    patterns: [/\btransfer\b.{0,30}\b(money|funds|\$|sgd|amount|account)/i, /\bpaynow\b/i, /\bsafe(ty)? account\b/i,
      /\bpay (a )?(small )?(fee|deposit|admin fee)\b/i, /\bupfront\b/i, /\bwire\b/i, /\b(want|need|give|send|pay|bring|prepare)\b.{0,20}(\$ ?\d|\d[\d,]* ?(dollars|sgd|k)\b)/i, /转账|汇款/, /\bpindah(kan)? wang\b/i],
  },
  {
    flag: 'gift_crypto', weight: 30,
    patterns: [/\bgift ?cards?\b/i, /\bgoogle play cards?\b/i, /\bitunes cards?\b/i, /\bcrypto\b/i, /\busdt\b/i,
      /\bbitcoin\b/i, /\bbtc\b/i],
  },
  {
    flag: 'gov_impersonation', weight: 25,
    patterns: [/\b(MOH|MOM|ICA|IRAS|CPF|SPF|MAS)\b/, /\bsingpass\b/i, /\bpolice (officer|investigation)\b/i,
      /\bcourt\b/i, /\bwarrant\b/i, /\bimmigration\b/i, /\bministry of\b/i, /\bgovernment official\b/i,
      /警察|移民局|法院/],
  },
  {
    flag: 'bank_impersonation', weight: 20,
    patterns: [/\b(DBS|POSB|OCBC|UOB|Citibank|HSBC|Standard Chartered|Maybank)\b/i, /\bbank account\b/i,
      /\bcard (has been|was) (blocked|locked|frozen)\b/i, /\bunusual (activity|transaction|login)\b/i, /银行/],
  },
  {
    flag: 'prize', weight: 20,
    patterns: [/\bcongratulations\b/i, /\byou('ve| have)? won\b/i, /\bwinner\b/i, /\blucky draw\b/i, /\bfree (iphone|gift|voucher)\b/i,
      /\bclaim (your|now)\b/i, /\bvoucher\b/i, /中奖|恭喜/],
  },
  {
    flag: 'easy_money', weight: 25,
    patterns: [/\bearn \$?\d+/i, /\b\$\d{2,4} ?(\/|per|a) ?(day|hour)\b/i, /\bwork from home\b/i, /\bno experience\b/i,
      /\bpart[- ]time\b.{0,40}\b(like|review|task)/i, /\b(like|rate) (videos|products|hotels)\b/i,
      /\bguaranteed (returns?|profit)\b/i, /\bhigh returns?\b/i, /\binvestment (group|opportunity)\b/i, /轻松赚钱|兼职/],
  },
  {
    flag: 'secrecy', weight: 30,
    patterns: [/\bdon'?t tell\b/i, /\bdo not tell\b/i, /\bkeep (this|it) (a )?(secret|confidential)\b/i,
      /\bdon'?t (hang up|end the call)\b/i, /\bstay on the line\b/i, /\bconfidential investigation\b/i, /不要告诉|保密/],
  },
  {
    flag: 'remote_access', weight: 35,
    patterns: [/\b(anydesk|teamviewer|quicksupport)\b/i, /\bdownload (this|the|our) app\b/i, /\binstall (this|the) (app|apk)\b/i,
      /\.apk\b/i, /\bscreen ?shar(e|ing)\b/i],
  },
  {
    flag: 'threat', weight: 25,
    patterns: [/\barrest(ed)?\b/i, /\blegal action\b/i, /\bjail\b/i, /\bmoney laundering\b/i, /\bwill be (charged|blocked|terminated)\b/i,
      /\bfine of\b/i, /\bor (else|not)\b.{0,20}\b(i('m| am| will)|we('re| are| will)|you('ll| will))\b/i, /\bor else\b/i, /洗钱|逮捕/],
  },
  {
    flag: 'personal_info', weight: 20,
    patterns: [/\bnric\b/i, /\bfull name and\b/i, /\bdate of birth\b/i, /\bcard (number|details)\b/i, /\bcvv\b/i,
      /\bpassword\b/i, /\bbank (login|details)\b/i, /\bupdate your (details|particulars)\b/i, /身份证/],
  },
  {
    flag: 'delivery_fee', weight: 20,
    patterns: [/\b(parcel|package|delivery)\b.{0,60}\b(fee|failed|pending|held|unable|reschedule)/i,
      /\bredelivery\b/i, /\bcustoms (fee|charge)\b/i, /\bsingpost\b.{0,40}\b(fee|address)\b/i],
  },
  {
    flag: 'move_platform', weight: 15,
    patterns: [/\b(add|contact|message) (me|us) on (whatsapp|telegram|wechat)\b/i, /\bt\.me\//i, /\bwa\.me\//i,
      /\bcontinue (on|via) (whatsapp|telegram)\b/i],
  },
];

// Official domains. A link mentioning a brand but NOT on one of these is a lookalike.
export const OFFICIAL_DOMAINS = [
  'gov.sg', 'dbs.com.sg', 'dbs.com', 'posb.com.sg', 'ocbc.com', 'uob.com.sg', 'singpost.com', 'cpf.gov.sg',
  'singpass.gov.sg', 'iras.gov.sg', 'ica.gov.sg', 'mom.gov.sg', 'police.gov.sg', 'scamshield.gov.sg',
  'shopee.sg', 'lazada.sg', 'carousell.sg', 'grab.com',
];
const BRANDS = ['dbs', 'posb', 'ocbc', 'uob', 'singpost', 'singpass', 'cpf', 'iras', 'ica', 'gov', 'police',
  'shopee', 'lazada', 'carousell', 'grab', 'paynow', 'mom'];
const SHORTENERS = ['bit.ly', 'tinyurl.com', 'cutt.ly', 'is.gd', 'rb.gy', 'shorturl.at', 't.ly', 'ow.ly', 'tiny.cc'];
const RISKY_TLDS = ['.xyz', '.top', '.icu', '.click', '.vip', '.cc', '.shop', '.live', '.buzz', '.online', '.site', '.info'];

const URL_RE = /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?)/gi;

function hostOf(raw) {
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `http://${raw}`);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch { return null; }
}
const isOfficial = (host) => OFFICIAL_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));

export function analyseLinks(text) {
  const links = [];
  const spans = [];
  let m;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text))) {
    const raw = m[1].replace(/[.,!?)]+$/, '');
    const host = hostOf(raw);
    // ignore things like "3.30pm" or "S$5.00"
    if (!host || !/[a-z]/.test(host.split('.').pop()) || host.split('.').pop().length < 2) continue;
    let flag = null;
    if (isOfficial(host)) flag = null;
    else if (SHORTENERS.includes(host)) flag = 'link_shortened';
    else if (BRANDS.some((b) => host.includes(b))) flag = 'link_lookalike';
    else if (RISKY_TLDS.some((t) => host.endsWith(t)) || /\d{3,}/.test(host)) flag = 'link_risky';
    else flag = 'link_unknown';
    links.push({ url: raw, host, official: isOfficial(host), flag });
    if (flag) spans.push({ start: m.index, end: m.index + raw.length, flag });
  }
  return { links, spans };
}

const LINK_WEIGHTS = { link_lookalike: 40, link_shortened: 25, link_risky: 30, link_unknown: 10 };

/**
 * analyse(text) -> { score, level, flags:[{flag, matches}], spans:[{start,end,flag}], links }
 * level: 'low' | 'medium' | 'high'
 */
export function analyse(text = '') {
  const flagMap = new Map();
  const spans = [];

  for (const rule of RULES) {
    for (const re of rule.patterns) {
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
      let m;
      while ((m = g.exec(text))) {
        if (!m[0]) { g.lastIndex++; continue; }
        spans.push({ start: m.index, end: m.index + m[0].length, flag: rule.flag });
        if (!flagMap.has(rule.flag)) flagMap.set(rule.flag, { flag: rule.flag, weight: rule.weight, matches: [] });
        const entry = flagMap.get(rule.flag);
        if (!entry.matches.includes(m[0]) && entry.matches.length < 4) entry.matches.push(m[0]);
      }
    }
  }

  const { links, spans: linkSpans } = analyseLinks(text);
  for (const s of linkSpans) {
    spans.push(s);
    if (!flagMap.has(s.flag)) flagMap.set(s.flag, { flag: s.flag, weight: LINK_WEIGHTS[s.flag], matches: [] });
    flagMap.get(s.flag).matches.push(text.slice(s.start, s.end));
  }

  const flags = [...flagMap.values()].sort((a, b) => b.weight - a.weight);
  let score = flags.reduce((sum, f) => sum + f.weight, 0);
  // Combinations that scammers love get a boost
  const has = (k) => flagMap.has(k);
  if ((has('urgency') || has('threat')) && (has('link_lookalike') || has('link_risky') || has('link_shortened'))) score += 15;
  if (has('gov_impersonation') && (has('money_transfer') || has('secrecy'))) score += 20;
  score = Math.min(100, score);

  const level = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
  return { score, level, flags, spans: mergeSpans(spans), links };
}

// Remove overlapping highlight spans (keep the earliest/longest)
function mergeSpans(spans) {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start < last.end) continue;
    out.push(s);
  }
  return out;
}

// Which next steps to show for a result (keys are translated in the app)
export function recommendedActions(result) {
  const f = new Set(result.flags.map((x) => x.flag));
  const actions = [];
  if ([...f].some((k) => k.startsWith('link_'))) actions.push('act_no_click');
  if (f.has('otp_request') || f.has('personal_info')) actions.push('act_no_otp');
  if (f.has('money_transfer') || f.has('gift_crypto') || f.has('delivery_fee')) actions.push('act_no_pay');
  if (f.has('remote_access')) actions.push('act_no_install');
  if (f.has('gov_impersonation') || f.has('bank_impersonation')) actions.push('act_verify_official');
  if (f.has('secrecy') || f.has('threat')) actions.push('act_hang_up');
  if (result.level !== 'low') actions.push('act_ask_kaki', 'act_call_1799');
  if (actions.length === 0) actions.push('act_still_careful');
  return [...new Set(actions)];
}

// ---------- Similarity: "N people reported something like this" ----------
const STOP = new Set('the a an to of and or is are you your for in on at this that with be has have it we our from will by please'.split(' '));
export function tokens(text = '') {
  return new Set(
    text.toLowerCase().replace(/https?:\/\/\S+/g, ' ').replace(/[^a-z0-9一-鿿\s]/g, ' ')
      .split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)),
  );
}
export function similarity(a, b) {
  const A = tokens(a); const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}