// Notifications: an inbox + "don't disturb my family" settings.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BellOff, Moon, Megaphone, ShieldCheck, Siren, PhoneCall, MessageCircleQuestion, CheckCheck } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { Avatar, PageHead } from '../components/ui.jsx';

const TYPE_ICON = { community: Megaphone, report: ShieldCheck, sos: Siren, call: PhoneCall, ask: MessageCircleQuestion, escalated: MessageCircleQuestion };

export default function Notifications() {
  const { tab = 'inbox' } = useParams();
  const nav = useNavigate();
  const { t } = useI18n();
  return (
    <main className="page">
      <PageHead title={t('notif.title')} />
      <div className="segmented" role="tablist">
        {['inbox', 'settings'].map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''}
            onClick={() => nav(k === 'inbox' ? '/notifications' : '/notifications/settings', { replace: true })}>
            {t(`notif.${k}`)}
          </button>
        ))}
      </div>
      {tab === 'settings' ? <NotifySettings /> : <Inbox />}
    </main>
  );
}

function Inbox() {
  const { t, timeAgo } = useI18n();
  const { onEvent, setUnread } = useApp();
  const nav = useNavigate();
  const [data, setData] = useState(null);

  const load = useCallback(() => api.get('/notifications').then(setData).catch(() => setData({ items: [] })), []);
  useEffect(() => {
    load();
    return onEvent((name, n) => { if (name === 'notif:new') setData((d) => d && ({ ...d, items: [n, ...d.items] })); });
  }, [load, onEvent]);

  const markAll = async () => {
    await api.post('/notifications/read-all');
    setUnread(0);
    setData((d) => ({ ...d, items: d.items.map((n) => ({ ...n, read: 1 })) }));
  };
  const open = (n) => {
    if (!n.read) { api.post(`/notifications/${n.id}/read`).catch(() => {}); setUnread((u) => Math.max(0, u - 1)); }
    nav(['community', 'report'].includes(n.type) ? `/community/${n.ref_id}` : '/circle');
  };
  const text = (n) => (n.type === 'reply'
    ? t('notif.type.reply', { name: n.actor_name, verdict: t(`circle.verdict.${n.body}`) })
    : t(`notif.type.${n.type}`, { name: n.actor_name }));

  if (!data) return <p className="muted">{t('common.loading')}</p>;
  const s = data.summary;

  return (
    <>
      {data.quietNow && <p className="notice"><Moon size={18} /> {t('notif.quietNow')}</p>}

      {s && (
        <section className="summary">
          <h2>{t('notif.summaryTitle', { circle: s.circle })}</h2>
          <ul>
            {s.people.map((p) => (
              <li key={p.id}>
                <Avatar name={p.name} color={p.color} size={36} />
                <div>
                  <strong>{p.name}</strong>
                  <span>{p.checks ? t('notif.summaryLine', { n: p.checks, h: p.high }) : t('notif.summaryNone')}</span>
                  {p.top_flag && <span className="muted">{t('notif.summaryTop', { flag: t(`flag.${p.top_flag}.t`) })}</span>}
                </div>
              </li>
            ))}
          </ul>
          {s.quiet > 0 && <p className="summary-quiet"><BellOff size={16} /> {t('notif.summaryQuiet', { n: s.quiet })}</p>}
        </section>
      )}

      {data.items.length === 0 ? (
        <p className="empty">{t('notif.empty')}</p>
      ) : (
        <>
          <div className="row-between">
            <span />
            <button type="button" className="text-btn" onClick={markAll}><CheckCheck size={18} /> {t('notif.markAll')}</button>
          </div>
          <ul className="list notif-list">
            {data.items.map((n) => {
              const Icon = TYPE_ICON[n.type];
              return (
                <li key={n.id}>
                  <button type="button" className={`notif ${n.read ? '' : 'unread'} lvl-${n.level}`} onClick={() => open(n)}>
                    {n.actor_name && !['community', 'report'].includes(n.type)
                      ? <Avatar name={n.actor_name} color={n.actor_color} size={42} />
                      : <span className="notif-icon">{Icon && <Icon size={20} />}</span>}
                    <span className="notif-body">
                      <strong>{text(n)}</strong>
                      {n.body && !['reply'].includes(n.type) && <span className="clip1">{n.body}</span>}
                      <span className="notif-meta">
                        {timeAgo(n.created_at)}
                        {n.level === 'urgent' && <em className="pill pill-danger">{t('notif.urgent')}</em>}
                        {!n.pushed && <em className="pill"><Moon size={12} /> {t('notif.silent')}</em>}
                      </span>
                    </span>
                    {!n.read && <i className="unread-dot" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}

function Option({ name, value, current, title, desc, onPick }) {
  return (
    <label className={`option ${current === value ? 'on' : ''}`}>
      <input type="radio" name={name} value={value} checked={current === value} onChange={() => onPick(value)} />
      <span><strong>{title}</strong>{desc && <small>{desc}</small>}</span>
    </label>
  );
}

function Switch({ checked, onChange, label, desc, id }) {
  return (
    <label className="switch-row" htmlFor={id}>
      <span><strong>{label}</strong>{desc && <small>{desc}</small>}</span>
      <input id={id} type="checkbox" role="switch" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function NotifySettings() {
  const { t } = useI18n();
  const { bigText, setBigText } = useApp();
  const [s, setS] = useState(null);
  const [people, setPeople] = useState([]);
  const [saved, setSaved] = useState(false);
  const timer = useRef(null);

  useEffect(() => { api.get('/notify-settings').then((d) => { setS(d.settings); setPeople(d.people); }).catch(() => {}); }, []);

  const save = (patch) => {
    setS((cur) => ({ ...cur, ...patch }));
    api.patch('/notify-settings', patch).then(() => {
      setSaved(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 1500);
    }).catch(() => {});
  };

  if (!s) return <p className="muted">{t('common.loading')}</p>;
  const toggleMute = (id) => save({ muted: s.muted.includes(id) ? s.muted.filter((x) => x !== id) : [...s.muted, id] });

  return (
    <div className="settings">
      <p className="lede">{t('notif.s.intro')}</p>
      <p className={`saved ${saved ? 'show' : ''}`} aria-live="polite">{saved ? `✓ ${t('notif.s.saved')}` : ''}</p>

      <section className="set-group">
        <h2>{t('notif.s.buzz')}</h2>
        <div className="options">
          <Option name="receive" value="all" current={s.receive} onPick={(v) => save({ receive: v })} title={t('notif.s.buzzAll')} desc={t('notif.s.buzzAllD')} />
          <Option name="receive" value="family" current={s.receive} onPick={(v) => save({ receive: v })} title={t('notif.s.buzzFamily')} desc={t('notif.s.buzzFamilyD')} />
          <Option name="receive" value="urgent" current={s.receive} onPick={(v) => save({ receive: v })} title={t('notif.s.buzzUrgent')} desc={t('notif.s.buzzUrgentD')} />
        </div>
        <p className="note"><Siren size={16} /> {t('notif.s.urgentNote')}</p>
      </section>

      <section className="set-group">
        <div className="card">
          <Switch id="quiet" checked={s.quiet_on} onChange={(v) => save({ quiet_on: v })} label={t('notif.s.quiet')} desc={t('notif.s.quietD')} />
          {s.quiet_on && (
            <div className="time-row">
              <label htmlFor="qs">{t('notif.s.from')}<input id="qs" type="time" value={s.quiet_start} onChange={(e) => save({ quiet_start: e.target.value })} /></label>
              <label htmlFor="qe">{t('notif.s.to')}<input id="qe" type="time" value={s.quiet_end} onChange={(e) => save({ quiet_end: e.target.value })} /></label>
            </div>
          )}
        </div>
      </section>

      <section className="set-group">
        <h2>{t('notif.s.asks')}</h2>
        <div className="options">
          <Option name="ask" value="main_first" current={s.ask_mode} onPick={(v) => save({ ask_mode: v })} title={t('notif.s.askMain')} desc={t('notif.s.askMainD')} />
          <Option name="ask" value="circle" current={s.ask_mode} onPick={(v) => save({ ask_mode: v })} title={t('notif.s.askCircle')} desc={t('notif.s.askCircleD')} />
        </div>
        {s.ask_mode === 'main_first' && people.length > 0 && (
          <>
            <h3 className="sub">{t('notif.s.mainKaki')}</h3>
            <div className="people-pick">
              {people.map((p) => (
                <button key={p.id} type="button" className={`person ${s.main_kaki_id === p.id ? 'on' : ''}`} aria-pressed={s.main_kaki_id === p.id} onClick={() => save({ main_kaki_id: p.id })}>
                  <Avatar name={p.name} color={p.color} size={48} />
                  <span>{p.relation || p.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="set-group">
        <h2>{t('notif.s.calls')}</h2>
        <div className="options">
          <Option name="call" value="auto" current={s.call_alert} onPick={(v) => save({ call_alert: v })} title={t('notif.s.callAuto')} desc={t('notif.s.callAutoD')} />
          <Option name="call" value="ask" current={s.call_alert} onPick={(v) => save({ call_alert: v })} title={t('notif.s.callAsk')} desc={t('notif.s.callAskD')} />
          <Option name="call" value="off" current={s.call_alert} onPick={(v) => save({ call_alert: v })} title={t('notif.s.callOff')} />
        </div>
        {s.call_alert === 'off' && <p className="note warn">{t('notif.s.callOffD')}</p>}
      </section>

      {people.length > 0 && (
        <section className="set-group">
          <h2>{t('notif.s.mute')}</h2>
          <p className="muted small">{t('notif.s.muteD')}</p>
          <div className="card">
            {people.map((p) => (
              <Switch key={p.id} id={`mute-${p.id}`} checked={s.muted.includes(p.id)} onChange={() => toggleMute(p.id)}
                label={<span className="inline-person"><Avatar name={p.name} color={p.color} size={30} /> {p.name}</span>} />
            ))}
          </div>
        </section>
      )}

      <section className="set-group">
        <div className="card">
          <Switch id="weekly" checked={s.weekly_summary} onChange={(v) => save({ weekly_summary: v })} label={t('notif.s.weekly')} desc={t('notif.s.weeklyD')} />
        </div>
      </section>

      <section className="set-group">
        <h2>{t('notif.s.display')}</h2>
        <div className="card">
          <Switch id="big" checked={bigText} onChange={setBigText} label={t('common.bigText')} />
        </div>
      </section>
    </div>
  );
}
