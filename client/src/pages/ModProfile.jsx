import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronRight, Lock, Download, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { Avatar, HighlightedText, PageHead, levelOf } from '../components/ui.jsx';
import { analyse } from '@shared/scamEngine.js';

export function Moderator() {
  const { t, timeAgo } = useI18n();
  const { onEvent } = useApp();
  const [data, setData] = useState(null);

  const load = () => api.get('/mod/queue').then(setData).catch(() => {});
  useEffect(() => {
    load();
    return onEvent((name, r) => {
      if (name === 'mod:new') setData((d) => d && ({ ...d, pending: [r, ...d.pending], counts: { ...d.counts, pending: d.counts.pending + 1 } }));
    });
  }, [onEvent]);

  const decide = async (id, action) => {
    await api.post(`/mod/reports/${id}`, { action });
    load();
  };
  const hide = async (id) => { await api.del(`/mod/comments/${id}`); load(); };

  if (!data) return <main className="page"><p className="muted">{t('common.loading')}</p></main>;

  return (
    <main className="page">
      <PageHead title={t('mod.title')} sub={t('mod.sub')} />
      <div className="mod-counts">
        <div><strong>{data.counts.pending || 0}</strong><span>{t('mod.pending')}</span></div>
        <div><strong>{data.counts.verified || 0}</strong><span>{t('mod.verified')}</span></div>
        <div><strong>{data.counts.rejected || 0}</strong><span>{t('mod.rejected')}</span></div>
      </div>

      {data.pending.length === 0 && <p className="panel muted">{t('mod.empty')}</p>}
      <div className="stack">
        {data.pending.map((r) => (
          <article key={r.id} className="panel mod-item">
            <div className="report-meta">
              <span className={`ai-score s-${levelOf(r.risk_score)}`}>{t('mod.aiScore', { n: r.risk_score })}</span>
              <span className="muted">{r.author}, {timeAgo(r.created_at)}</span>
            </div>
            <h3>{r.title}</h3>
            <HighlightedText text={r.content} spans={analyse(r.content).spans} />
            <div className="chips">
              <span className="chip">{t(`type.${r.scam_type}`)}</span>
              <span className="chip">{t(`platform.${r.platform}`)}</span>
              {r.ai_flags.map((f) => <span key={f} className="chip warn">{t(`flag.${f}.t`)}</span>)}
            </div>
            <div className="choice-row">
              <button type="button" className="btn btn-primary" onClick={() => decide(r.id, 'verify')}>{t('mod.verify')}</button>
              <button type="button" className="btn btn-ghost" onClick={() => decide(r.id, 'reject')}>{t('mod.reject')}</button>
            </div>
          </article>
        ))}
      </div>

      <section className="block">
        <h2>{t('mod.comments')}</h2>
        {data.comments.map((c) => (
          <div key={c.id} className="comment mod-comment">
            <div><strong>{c.name}</strong> <span className="muted small">{c.report_title}</span><p>{c.content}</p></div>
            <button type="button" className="chip" onClick={() => hide(c.id)}>{t('mod.hide')}</button>
          </div>
        ))}
      </section>
    </main>
  );
}

function ModeSwitch() {
  const { t } = useI18n();
  const { user, setUser } = useApp();
  const pick = async (m) => {
    setUser({ ...user, ui_mode: m });
    api.patch('/me', { ui_mode: m }).catch(() => {});
  };
  return (
    <section className="block">
      <h2>{t('mode.change')}</h2>
      <div className="segmented">
        {['simple', 'full'].map((m) => (
          <button key={m} type="button" className={user.ui_mode === m ? 'on' : ''} aria-pressed={user.ui_mode === m} onClick={() => pick(m)}>{t(`mode.${m}`)}</button>
        ))}
      </div>
      <p className="muted small">{t(`mode.${user.ui_mode}D`)}</p>
    </section>
  );
}

// PDPA tools: see what we hold (download) and withdraw consent (delete)
function PrivacyTools() {
  const { t } = useI18n();
  const { logout, toast } = useApp();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const download = async () => {
    const data = await api.get('/me/export').catch(() => null);
    if (!data) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'kakiguard-my-data.json' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const del = async () => {
    await api.del('/me', { confirm: 'DELETE' });
    toast({ text: t('privacy.deleted') });
    logout();
  };
  return (
    <section className="block">
      <h2><Lock size={18} /> {t('privacy.title')}</h2>
      <div className="card">
        <Link to="/privacy" className="link-row flat"><span>{t('privacy.notice')}</span> <ChevronRight size={18} /></Link>
        <button type="button" className="link-row flat" onClick={download}><span>{t('privacy.download')}</span> <Download size={18} /></button>
        <button type="button" className="link-row flat danger" onClick={() => setConfirming(!confirming)}><span>{t('privacy.delete')}</span> <Trash2 size={18} /></button>
      </div>
      {confirming && (
        <div className="panel danger-panel">
          <p>{t('privacy.deleteWarn')}</p>
          <label className="field">{t('privacy.typeDelete')}<input id="confirm-delete" value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" /></label>
          <button type="button" className="btn btn-danger" disabled={typed !== 'DELETE'} onClick={del}>{t('privacy.deleteBtn')}</button>
        </div>
      )}
    </section>
  );
}

export function Profile() {
  const { t } = useI18n();
  const { user, logout, bigText, setBigText } = useApp();
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get('/me').then((d) => setStats(d.stats)).catch(() => {}); }, []);

  const badges = stats ? [
    ['rookie', true],
    ['spotter', stats.quiz_correct >= 10],
    ['guardian', stats.reports > 0],
    ['kaki', stats.kaki_helps > 0],
  ] : [];

  return (
    <main className="page">
      <div className="profile-head">
        <Avatar name={user.name} color={user.color} size={84} />
        <h1>{user.name}</h1>
        <p className="points">{t('common.points', { n: user.points })}</p>
      </div>
      {stats && (
        <>
          <section className="block">
            <h2>{t('profile.stats')}</h2>
            <div className="mod-counts four">
              <div><strong>{stats.reports}</strong><span>{t('profile.reports')}</span></div>
              <div><strong>{stats.comments}</strong><span>{t('profile.comments')}</span></div>
              <div><strong>{stats.games}</strong><span>{t('profile.games')}</span></div>
              <div><strong>{stats.kaki_helps}</strong><span>{t('profile.helps')}</span></div>
            </div>
          </section>
          <section className="block">
            <h2>{t('learn.badges')}</h2>
            <div className="badges">
              {badges.map(([b, got]) => (
                <div key={b} className={`badge ${got ? 'got' : ''}`}>
                  <span className="badge-icon">{{ rookie: '🌱', spotter: '🔍', guardian: '🛡️', kaki: '🤝' }[b]}</span>
                  <strong>{t(`badge.${b}`)}</strong>
                  <small>{t(`badge.${b}D`)}</small>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
      <Link to="/notifications/settings" className="link-row"><Bell size={20} /> <span>{t('notif.title')}</span> <ChevronRight size={18} /></Link>
      <ModeSwitch />
      <label className="toggle">
        <input type="checkbox" checked={bigText} onChange={(e) => setBigText(e.target.checked)} /> {t('common.bigText')}
      </label>
      <PrivacyTools />
      <button type="button" className="btn btn-ghost btn-xl" onClick={logout}>{t('common.logout')}</button>
    </main>
  );
}
