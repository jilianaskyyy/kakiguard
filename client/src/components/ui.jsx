// Small shared UI pieces.
import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Home, ScanSearch, HeartHandshake, Megaphone, Gamepad2, Gavel, X, PhoneCall, Bell, MessageCircle, Languages, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { useI18n, LANGS } from '../i18n/index.jsx';
import { useApp } from '../AppContext.jsx';
import { api } from '../api.js';

export const levelOf = (score) => (score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low');

export function Avatar({ name = '?', color = '#0B7A5B', size = 40, online }) {
  return (
    <span className="avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}>
      {name.trim()[0]?.toUpperCase()}
      {online !== undefined && <i className={`dot ${online ? 'on' : ''}`} />}
    </span>
  );
}

// Big semicircle gauge. The needle swings to the score on first render.
export function RiskDial({ score }) {
  const level = levelOf(score);
  const angle = -90 + (score / 100) * 180;
  return (
    <svg className={`dial dial-${level}`} viewBox="0 0 200 118" role="img" aria-label={`Risk ${score} of 100`}>
      <path d="M20 105 A80 80 0 0 1 180 105" className="dial-track" />
      <path d="M20 105 A80 80 0 0 1 180 105" className="dial-fill" pathLength="100" style={{ strokeDasharray: `${score} 100` }} />
      <g className="dial-needle" style={{ transform: `rotate(${angle}deg)` }}>
        <line x1="100" y1="105" x2="100" y2="38" />
        <circle cx="100" cy="105" r="9" />
      </g>
      <text x="100" y="92" textAnchor="middle" className="dial-num">{score}</text>
    </svg>
  );
}

// The message with red flags highlighted like a marker pen. Tap a mark to see why.
export function HighlightedText({ text, spans = [], first }) {
  const { t } = useI18n();
  // Open on the most important red flag (e.g. "Blocked by your family") if it's in the text
  const [picked, setPicked] = useState((first && spans.some((s) => s.flag === first) ? first : spans[0]?.flag) || null);
  const parts = [];
  let i = 0;
  spans.forEach((s, n) => {
    if (s.start > i) parts.push(<span key={`t${n}`}>{text.slice(i, s.start)}</span>);
    parts.push(
      <button type="button" key={`h${n}`} className={`mark ${picked === s.flag ? 'picked' : ''}`} onClick={() => setPicked(s.flag)}>
        {text.slice(s.start, s.end)}
      </button>,
    );
    i = s.end;
  });
  if (i < text.length) parts.push(<span key="end">{text.slice(i)}</span>);
  return (
    <div>
      <p className="evidence">{parts}</p>
      {picked && (
        <div className="why-pop">
          <strong>{t(`flag.${picked}.t`)}</strong>
          <span>{t(`flag.${picked}.d`)}</span>
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const { t, lang, setLang } = useI18n();
  const { user, unread } = useApp();
  const change = (l) => { setLang(l); if (user) api.patch('/me', { lang: l }).catch(() => {}); };
  return (
    <header className="topbar">
      <Link to="/" className="brand" aria-label="KakiGuard home">
        <Logo size={28} /> <span>KakiGuard</span>
      </Link>
      <div className="topbar-tools">
        <label className="lang-pill" title={t('common.language')}>
          <Languages size={18} aria-hidden="true" />
          <select value={lang} onChange={(e) => change(e.target.value)} aria-label={t('common.language')}>
            {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v.langName}</option>)}
          </select>
        </label>
        {user && (
          <Link to="/notifications" className="icon-btn" aria-label={`${t('nav.notif')}${unread ? ` (${unread})` : ''}`}>
            <Bell size={22} />
            {unread > 0 && <span className="badge-count">{unread > 9 ? '9+' : unread}</span>}
          </Link>
        )}
        {user && <Link to="/profile" aria-label="Profile"><Avatar name={user.name} color={user.color} size={34} /></Link>}
      </div>
    </header>
  );
}

export function Logo({ size = 30 }) {
  // Two overlapping shields = "you + your kaki"
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M15 4 L27 8 V18 C27 26 21 31 15 34 C9 31 3 26 3 18 V8 Z" fill="#8FD3FF" />
      <path d="M24 7 L37 11 V21 C37 29 31 34 24 37 C17 34 11 29 11 21 V11 Z" fill="var(--accent)" stroke="var(--bg)" strokeWidth="2" />
      <path d="M18 21 l4 4 l8 -9" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TabBar() {
  const { t } = useI18n();
  const { user } = useApp();
  const simple = user?.ui_mode === 'simple';
  // Simple mode keeps just the three things seniors need
  const tabs = simple ? [
    ['/', Home, 'nav.home'],
    ['/check', ScanSearch, 'nav.check'],
    ['/circle', HeartHandshake, 'nav.circle'],
  ] : [
    ['/', Home, 'nav.home'],
    ['/check', ScanSearch, 'nav.check'],
    ['/circle', HeartHandshake, 'nav.circle'],
    ['/community', Megaphone, 'nav.community'],
    user?.role === 'moderator' ? ['/mod', Gavel, 'nav.mod'] : ['/learn', Gamepad2, 'nav.learn'],
  ];
  return (
    <nav className={`tabbar ${simple ? 'tabbar-3' : ''}`}>
      {tabs.map(([to, Icon, key]) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
          <span className="tab-icon"><Icon size={22} strokeWidth={2.2} /></span>
          <span>{t(key)}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function Toasts() {
  const { toasts } = useApp();
  const { t } = useI18n();
  const nav = useNavigate();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((x) => (
        <button type="button" key={x.id} className={`toast toast-${x.kind || 'info'}`} onClick={() => x.link && nav(x.link)}>
          <Bell size={20} />
          <span><strong>{x.text || t(x.title)}</strong>{x.body && <><br />{x.body}</>}</span>
        </button>
      ))}
    </div>
  );
}

// Pops up on family phones when someone asks "is this a scam?" or hits SOS
export function KakiPopup() {
  const { kakiPopup: k, setKakiPopup } = useApp();
  const { t } = useI18n();
  const [sent, setSent] = useState(null);
  if (!k) return null;
  const reply = async (verdict) => {
    setSent(verdict);
    await api.post(`/kaki/${k.id}/reply`, { verdict }).catch(() => {});
    setTimeout(() => { setKakiPopup(null); setSent(null); }, 900);
  };
  const title = k.kind === 'sos' ? 'circle.sos' : k.kind === 'call' ? 'circle.onCall' : 'circle.asks';
  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true">
      <div className={`sheet ${k.kind === 'sos' ? 'sheet-sos' : ''}`}>
        <button type="button" className="sheet-x" onClick={() => setKakiPopup(null)} aria-label={t('common.close')}><X /></button>
        <div className="sheet-head">
          <Avatar name={k.sender_name} color={k.sender_color} size={52} />
          <h2>{t(title, { name: k.sender_name })}</h2>
        </div>
        {k.content && <blockquote className="quote">{k.content}</blockquote>}
        {k.kind !== 'sos' && <p className="muted">{t('circle.risk', { n: k.risk_score })} · {t(`check.risk.${levelOf(k.risk_score)}`)}</p>}
        <div className="reply-grid">
          {k.kind === 'sos' ? (
            <button type="button" className="btn btn-danger btn-xl" onClick={() => reply('calling')}><PhoneCall /> {t('circle.replyCalling')}</button>
          ) : (
            <>
              <button type="button" className="btn btn-danger" onClick={() => reply('scam')}>{t('circle.replyScam')}</button>
              <button type="button" className="btn btn-safe" onClick={() => reply('safe')}>{t('circle.replySafe')}</button>
              <button type="button" className="btn btn-ghost" onClick={() => reply('unsure')}>{t('circle.replyUnsure')}</button>
              <button type="button" className="btn btn-ghost" onClick={() => reply('calling')}><PhoneCall size={18} /> {t('circle.replyCalling')}</button>
            </>
          )}
        </div>
        {sent && <p className="sent-note">✓ {t(`circle.verdict.${sent}`)}</p>}
      </div>
    </div>
  );
}

// Strip shown on family phones while a member's Call Guard detects danger
export function LiveCallBanner() {
  const { liveCall } = useApp();
  const { t } = useI18n();
  if (!liveCall || liveCall.score < 30) return null;
  return (
    <Link to="/circle" className={`live-banner live-${levelOf(liveCall.score)}`}>
      <PhoneCall size={20} />
      <span><strong>{t('circle.onCall', { name: liveCall.name })}</strong> · {t('circle.liveRisk', { n: liveCall.score })}</span>
    </Link>
  );
}

// One community alert as a row. Wrap several in <ul className="list">.
export function ReportCard({ r }) {
  const { t, timeAgo } = useI18n();
  return (
    <Link to={`/community/${r.id}`} className="report-row">
      <span className="report-main">
        <span className="report-meta">
          <span className={`type-tag type-${r.scam_type}`}>{t(`type.${r.scam_type}`)}</span>
          <span className="muted">{t(`platform.${r.platform}`)}, {timeAgo(r.created_at)}</span>
        </span>
        <strong className="report-title">{r.title}</strong>
        <span className="report-foot">
          <span className="seen-pill"><Users size={14} /> {t('community.seenCount', { n: r.seen })}</span>
          <span className="muted icon-count"><MessageCircle size={14} /> {r.comment_count}</span>
        </span>
      </span>
      <ChevronRight size={20} className="chev" aria-hidden="true" />
    </Link>
  );
}

export function PageHead({ title, sub, back }) {
  const nav = useNavigate();
  const { t } = useI18n();
  return (
    <div className="page-head">
      {back && <button type="button" className="back" onClick={() => nav(-1)}><ChevronLeft size={20} /> {t('common.back')}</button>}
      <h1>{title}</h1>
      {sub && <p className="lede">{sub}</p>}
    </div>
  );
}
