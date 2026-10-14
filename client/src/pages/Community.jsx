import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Plus, Search, Send, CheckCircle2 } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { Avatar, HighlightedText, PageHead, ReportCard } from '../components/ui.jsx';
import { analyse } from '@shared/scamEngine.js';

const TYPES = ['job', 'investment', 'ecommerce', 'phishing', 'bank', 'gov', 'delivery', 'romance', 'other'];
const PLATFORMS = ['sms', 'whatsapp', 'telegram', 'call', 'email', 'social', 'website', 'other'];
const ASKED = ['click_link', 'give_otp', 'give_info', 'pay', 'transfer_money', 'install_app', 'keep_secret', 'move_platform'];

export function Community() {
  const { t } = useI18n();
  const { onEvent } = useApp();
  const [list, setList] = useState([]);
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [mine, setMine] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams();
    if (type) p.set('type', type);
    if (q) p.set('q', q);
    if (mine) p.set('mine', '1');
    const id = setTimeout(() => api.get(`/reports?${p}`).then(setList).catch(() => {}), 200);
    return () => clearTimeout(id);
  }, [type, q, mine]);

  useEffect(() => onEvent((name, data) => {
    if (name === 'community:alert' && !mine) setList((l) => [{ ...data, seen: 0, comment_count: 0 }, ...l.filter((x) => x.id !== data.id)]);
  }), [onEvent, mine]);

  return (
    <main className="page">
      <PageHead title={t('community.title')} sub={t('community.sub')} />
      <Link to="/report/new" className="btn btn-primary btn-xl"><Plus /> {t('community.newReport')}</Link>
      <label className="search"><Search size={20} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('community.search')} /></label>
      <div className="chips scroll">
        <button type="button" className={`chip ${!type && !mine ? 'on' : ''}`} onClick={() => { setType(''); setMine(false); }}>{t('community.all')}</button>
        <button type="button" className={`chip ${mine ? 'on' : ''}`} onClick={() => setMine(!mine)}>{t('community.mine')}</button>
        {TYPES.map((x) => (
          <button type="button" key={x} className={`chip ${type === x ? 'on' : ''}`} onClick={() => setType(type === x ? '' : x)}>{t(`type.${x}`)}</button>
        ))}
      </div>
      <ul className="list">
        {list.map((r) => (
          <li key={r.id}>
            {mine && <span className={`status s-${r.status}`}>{t(`community.${r.status}`)}</span>}
            <ReportCard r={r} />
          </li>
        ))}
      </ul>
    </main>
  );
}

export function ReportDetail() {
  const { id } = useParams();
  const { t, timeAgo } = useI18n();
  const [r, setR] = useState(null);
  const [comment, setComment] = useState('');

  useEffect(() => { api.get(`/reports/${id}`).then(setR).catch(() => {}); }, [id]);
  if (!r) return <main className="page"><p className="muted">{t('common.loading')}</p></main>;

  const toggleSeen = async () => { const s = await api.post(`/reports/${id}/seen`); setR({ ...r, ...s }); };
  const send = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    const c = await api.post(`/reports/${id}/comments`, { content: comment });
    setR({ ...r, comments: [...r.comments, c] }); setComment('');
  };

  return (
    <main className="page">
      <PageHead title={r.title} back />
      <div className="report-meta">
        <span className={`type-tag type-${r.scam_type}`}>{t(`type.${r.scam_type}`)}</span>
        <span className="muted">{t(`platform.${r.platform}`)}, {timeAgo(r.created_at)}</span>
      </div>
      <div className="panel">
        <HighlightedText text={r.content} spans={analyse(r.content).spans} />
      </div>
      <button type="button" className={`btn ${r.seen_by_me ? 'btn-kaki' : 'btn-ghost'} btn-xl`} onClick={toggleSeen}>
        {r.seen_by_me ? '✓ ' : ''}{t('community.seenToo')} · {r.seen}
      </button>

      <section className="block">
        <h2>{t('community.comments', { n: r.comments.length })}</h2>
        <div className="comments">
          {r.comments.map((c) => (
            <div key={c.id} className="comment">
              <Avatar name={c.name} color={c.color} size={34} />
              <div><strong>{c.name}</strong> <span className="muted small">{timeAgo(c.created_at)}</span><p>{c.content}</p></div>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="comment-form">
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('community.addComment')} />
          <button type="submit" className="btn btn-primary" aria-label={t('common.send')}><Send size={18} /></button>
        </form>
      </section>
    </main>
  );
}

export function ReportNew() {
  const { t } = useI18n();
  const nav = useNavigate();
  const { state } = useLocation();
  const [f, setF] = useState({ title: '', content: state?.content || '', platform: 'sms', scam_type: 'phishing', asked_to: [], lost_money: 'no' });
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setF({ ...f, [k]: v });
  const toggleAsk = (a) => set('asked_to', f.asked_to.includes(a) ? f.asked_to.filter((x) => x !== a) : [...f.asked_to, a]);

  const submit = async (e) => {
    e.preventDefault();
    try { await api.post('/reports', f); setDone(true); } catch { setErr(t('common.error')); }
  };

  if (done) {
    return (
      <main className="page center-page">
        <CheckCircle2 size={72} className="ok-icon" />
        <h1>{t('report.thanks')}</h1>
        <p className="lede">{t('report.thanksSub')}</p>
        <button type="button" className="btn btn-primary btn-xl" onClick={() => nav('/community')}>{t('nav.community')}</button>
      </main>
    );
  }

  return (
    <main className="page">
      <PageHead title={t('report.title')} sub={t('report.sub')} back />
      <form className="stack" onSubmit={submit}>
        <label className="field">{t('report.what')}<textarea rows={5} value={f.content} onChange={(e) => set('content', e.target.value)} required /></label>
        <label className="field">{t('report.titleLabel')}<input value={f.title} onChange={(e) => set('title', e.target.value)} /></label>
        <fieldset><legend>{t('report.where')}</legend>
          <div className="chips">{PLATFORMS.map((p) => <button type="button" key={p} className={`chip ${f.platform === p ? 'on' : ''}`} onClick={() => set('platform', p)}>{t(`platform.${p}`)}</button>)}</div>
        </fieldset>
        <fieldset><legend>{t('report.type')}</legend>
          <div className="chips">{TYPES.map((p) => <button type="button" key={p} className={`chip ${f.scam_type === p ? 'on' : ''}`} onClick={() => set('scam_type', p)}>{t(`type.${p}`)}</button>)}</div>
        </fieldset>
        <fieldset><legend>{t('report.asked')}</legend>
          <div className="chips">{ASKED.map((a) => <button type="button" key={a} className={`chip ${f.asked_to.includes(a) ? 'on' : ''}`} onClick={() => toggleAsk(a)}>{t(`report.asked_opts.${a}`)}</button>)}</div>
        </fieldset>
        <fieldset><legend>{t('report.lost')}</legend>
          <div className="chips">{[['no', 'lostNo'], ['yes', 'lostYes'], ['skip', 'lostSkip']].map(([v, k]) => <button type="button" key={v} className={`chip ${f.lost_money === v ? 'on' : ''}`} onClick={() => set('lost_money', v)}>{t(`report.${k}`)}</button>)}</div>
        </fieldset>
        {f.lost_money === 'yes' && <Link to="/sos" className="sos-inline">{t('home.sosBtn')}. {t('sos.sub')}</Link>}
        {err && <p className="error">{err}</p>}
        <button type="submit" className="btn btn-primary btn-xl">{t('report.submit')}</button>
      </form>
    </main>
  );
}
