// Safety Circle — KakiGuard's core: your people, your shared block list, and identity checks.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PhoneCall, ShieldQuestion, KeyRound, Ban, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { Avatar, PageHead, levelOf } from '../components/ui.jsx';
import { VerifySheet } from '../components/Verify.jsx';
import { prettyNumber } from '@shared/privacy.js';

const cleanNumber = (v) => v.replace(/\D/g, '').slice(0, 8);
const isValidNumber = (v) => /^\d{8}$/.test(v);

function KakiItem({ k, me, onReply }) {
  const { t, timeAgo } = useI18n();
  const mine = k.sender_id === me;
  const myReply = k.replies.find((r) => r.user_id === me)?.verdict;
  const title = k.kind === 'sos' ? 'circle.sos' : k.kind === 'call' ? 'circle.onCall' : 'circle.asks';
  return (
    <article className={`kaki-item kind-${k.kind}`}>
      <header>
        <Avatar name={k.sender_name} color={k.sender_color} size={40} />
        <div>
          <strong>{t(title, { name: mine ? t('circle.you') : k.sender_name })}</strong>
          <span className="muted small">{timeAgo(k.created_at)}{k.kind !== 'sos' && `, ${t('circle.risk', { n: k.risk_score })}`}</span>
        </div>
      </header>
      {k.content && <blockquote className={`quote q-${levelOf(k.risk_score)}`}>{k.content}</blockquote>}
      {k.replies.length > 0 && (
        <ul className="replies">
          {k.replies.map((r) => (
            <li key={r.user_id} className={`v-${r.verdict}`}><Avatar name={r.name} color={r.color} size={26} /> {r.name} {t(`circle.verdict.${r.verdict}`)}</li>
          ))}
        </ul>
      )}
      {!mine && (
        <div className="reply-row">
          {(k.kind === 'sos' ? ['calling'] : ['scam', 'safe', 'unsure']).map((v) => (
            <button type="button" key={v} className={`chip ${myReply === v ? 'on' : ''}`} onClick={() => onReply(k.id, v)}>
              {t({ scam: 'circle.replyScam', safe: 'circle.replySafe', unsure: 'circle.replyUnsure', calling: 'circle.replyCalling' }[v])}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function BlockList({ circleId }) {
  const { t, timeAgo } = useI18n();
  const { onEvent, user } = useApp();
  const [list, setList] = useState([]);
  const [num, setNum] = useState('');
  const [label, setLabel] = useState('');
  const [err, setErr] = useState('');
  const digits = cleanNumber(num);
  const valid = isValidNumber(digits);

  useEffect(() => {
    api.get('/blocks').then(setList).catch(() => {});
    return onEvent((name) => { if (name === 'blocks:update') api.get('/blocks').then(setList).catch(() => {}); });
  }, [onEvent]);

  const add = async (e) => {
    e.preventDefault(); setErr('');
    if(!valid) { setErr(t('blocks.bad')); return; }
    try {
      setList(await api.post('/blocks', { number: digits, label, circle_id: circleId }));
      setNum(''); setLabel('');
    } catch { setErr(t('blocks.bad')); }
  };
 
  const remove = async (id) => setList(await api.del(`/blocks/${id}`).catch(() => list));
  const simple = user.ui_mode === 'simple';

  return (
    <section className="block" id="blocks">
      <h2><Ban size={20} /> {t('blocks.title')}</h2>
      <p className="muted small">{t('blocks.sub')}</p>
      {list.length === 0 ? <p className="empty">{t('blocks.empty')}</p> : (
        <ul className="list">
          {list.map((b) => (
            <li key={b.id} className="block-row">
              <span className="block-num">{prettyNumber(b.number)}</span>
              <span className="block-info">
                {b.label && <strong>{b.label}</strong>}
                <span className="muted small">{t('blocks.addedBy', { name: b.added_by_name || '?' })}, {timeAgo(b.created_at)}</span>
              </span>
              {!simple && <button type="button" className="icon-ghost" onClick={() => remove(b.id)} aria-label={t('blocks.remove')}><Trash2 size={18} /></button>}
            </li>
          ))}
        </ul>
      )}
      <form className="panel block-form" onSubmit={add}>
        <label className="field">{t('blocks.number')}
          <input
            id="block-number"
            type="tel"
            inputMode="numeric"
            maxLength={9}
            placeHolder="81234567"
            value={num}
            onChange={(e) => {
              const d = cleanNumber(e.target.value);
              setNum(d.length > 4 ? `${d.slice(0, 4)} ${d.slice(4)}` : d);
            }}
          />
        </label>
        {!simple && <label className="field">{t('blocks.label')}<input id="block=label" value={label} onChange={(e) => setLabel(e.target.value)} /></label>}
        {err && <p className="error">{err}</p>}
        <button type="submit" className="btn btn-primary" disabled={!valid}><Ban size={18} /> {t('blocks.add')}</button>
      </form>
      <p className="muted small">{t('blocks.note')}</p>
    </section>
  );
}

export default function Circle() {
  const { t } = useI18n();
  const { user, onEvent, socket, liveCall } = useApp();
  const { hash } = useLocation();
  const [circles, setCircles] = useState(null);
  const [feed, setFeed] = useState([]);
  const [copied, setCopied] = useState(false);
  const [newName, setNewName] = useState('');
  const [code, setCode] = useState('');
  const [relation, setRelation] = useState('');
  const [err, setErr] = useState('');
  const [verifyFor, setVerifyFor] = useState(undefined); // undefined = closed, null/id = open
  const simple = user.ui_mode === 'simple';

  const load = () => {
    api.get('/circles').then(setCircles).catch(() => setCircles([]));
    api.get('/kaki').then(setFeed).catch(() => {});
  };
  useEffect(() => {
    load();
    return onEvent((name, data) => {
      if (name === 'kaki:new') setFeed((f) => [data, ...f.filter((x) => x.id !== data.id)]);
      if (name === 'kaki:reply') setFeed((f) => f.map((x) => (x.id === data.check.id ? data.check : x)));
      if (name === 'circle:update') setCircles((cs) => cs?.map((c) => (c.id === data.id ? data : c)));
      if (name === 'presence') setCircles((cs) => cs?.map((c) => ({ ...c, members: c.members.map((m) => (m.id === data.userId ? { ...m, online: data.online } : m)) })));
    });
  }, [onEvent]);
  useEffect(() => { if (hash === '#blocks' && circles) setTimeout(() => document.getElementById('blocks')?.scrollIntoView({ behavior: 'smooth' }), 100); }, [hash, circles]);

  const reply = async (id, verdict) => {
    const updated = await api.post(`/kaki/${id}/reply`, { verdict }).catch(() => null);
    if (updated) setFeed((f) => f.map((x) => (x.id === id ? updated : x)));
  };
  const create = async () => { await api.post('/circles', { name: newName }); setNewName(''); socket?.emit('rejoin'); load(); };
  const join = async () => {
    setErr('');
    try { await api.post('/circles/join', { code, relation }); setCode(''); socket?.emit('rejoin'); load(); } catch { setErr(t('common.error')); }
  };
  const copy = (c) => { navigator.clipboard?.writeText(c).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <main className="page">
      <PageHead title={t('circle.title')} sub={t('circle.sub')} />

      {liveCall && liveCall.score >= 30 && (
        <div className={`live-card live-${levelOf(liveCall.score)}`}>
          <PhoneCall /> <div><strong>{t('circle.onCall', { name: liveCall.name })}</strong><br />{t('circle.liveRisk', { n: liveCall.score })}</div>
        </div>
      )}

      {circles?.map((c) => (
        <section key={c.id} className="circle-card">
          <h2>{c.name}</h2>
          <ul className="member-list">
            {c.members.map((m) => (
              <li key={m.id}>
                <Avatar name={m.name} color={m.color} size={48} online={m.online} />
                <span className="member-name">
                  <strong>{m.id === user.id ? t('circle.you') : m.name}</strong>
                  {c.owner_id === user.id && m.relation && m.id !== user.id && <span className="muted small">{m.relation}</span>}
                </span>
                {m.id !== user.id && (
                  <button type="button" className="mini-action" onClick={() => setVerifyFor(m.id)}>
                    <ShieldQuestion size={18} /> <span>{t('verify.btn')}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
          {!simple && (
            <div className="invite">
              <div><span className="muted small">{t('circle.invite')}</span><code>{c.invite_code}</code></div>
              <button type="button" className="chip" onClick={() => copy(c.invite_code)}>{t(copied ? 'circle.copied' : 'circle.copy')}</button>
            </div>
          )}
        </section>
      ))}

      <section className="code-card">
        <KeyRound size={26} />
        <div><h2>{t('code.title')}</h2><p>{t('code.body')}</p></div>
      </section>

      <BlockList circleId={circles?.[0]?.id} />

      <section className="block">
        <h2>{t('circle.activity')}</h2>
        {feed.length === 0 && <p className="muted">{t('circle.none')}</p>}
        <div className="stack">{feed.map((k) => <KakiItem key={k.id} k={k} me={user.id} onReply={reply} />)}</div>
      </section>

      <section className="block two-forms">
        <div className="panel">
          <h3>{t('circle.join')}</h3>
          <input id="join-code" placeholder={t('circle.joinCode')} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <input id="join-relation" placeholder={t('circle.relation')} value={relation} onChange={(e) => setRelation(e.target.value)} />
          <button type="button" className="btn btn-primary" disabled={!code} onClick={join}>{t('circle.join')}</button>
          {err && <p className="error">{err}</p>}
        </div>
        {!simple && (
          <div className="panel">
            <h3>{t('circle.create')}</h3>
            <input id="new-circle" placeholder={t('circle.createName')} value={newName} onChange={(e) => setNewName(e.target.value)} />
            <button type="button" className="btn btn-ghost" onClick={create}>{t('circle.create')}</button>
          </div>
        )}
      </section>

      <VerifySheet open={verifyFor !== undefined} presetId={verifyFor ?? null} onClose={() => setVerifyFor(undefined)} />
    </main>
  );
}
