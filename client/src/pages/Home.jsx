import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScanSearch, PhoneCall, LifeBuoy, ChevronRight, ArrowRight, ShieldQuestion, Ban, MessageCircleQuestion } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { Avatar, ReportCard } from '../components/ui.jsx';
import { VerifySheet } from '../components/Verify.jsx';

function useHomeData() {
  const { onEvent } = useApp();
  const [circles, setCircles] = useState([]);
  const [feed, setFeed] = useState([]);
  const [blocks, setBlocks] = useState([]);
  useEffect(() => {
    api.get('/circles').then(setCircles).catch(() => {});
    api.get('/kaki').then(setFeed).catch(() => {});
    api.get('/blocks').then(setBlocks).catch(() => {});
    return onEvent((name, data) => {
      if (name === 'kaki:new') setFeed((f) => [data, ...f]);
      if (name === 'blocks:update') api.get('/blocks').then(setBlocks).catch(() => {});
      if (name === 'presence') {
        setCircles((cs) => cs.map((c) => ({ ...c, members: c.members.map((m) => (m.id === data.userId ? { ...m, online: data.online } : m)) })));
      }
    });
  }, [onEvent]);
  return { circles, feed, blocks };
}

// ---------- Simple mode: three giant buttons and the family ----------
function SimpleHome() {
  const { t } = useI18n();
  const { user } = useApp();
  const { circles } = useHomeData();
  const family = circles[0];
  return (
    <main className="page home simple-home">
      <h1>{t('home.hello', { name: user.name })}</h1>
      <Link to="/check" className="big-btn big-accent">
        <ScanSearch size={40} strokeWidth={2.2} />
        <span><strong>{t('simple.check')}</strong><small>{t('simple.checkSub')}</small></span>
      </Link>
      <Link to="/call" className="big-btn big-ink">
        <PhoneCall size={40} strokeWidth={2.2} />
        <span><strong>{t('simple.call')}</strong><small>{t('simple.callSub')}</small></span>
      </Link>
      <Link to="/sos" className="big-btn big-danger">
        <LifeBuoy size={40} strokeWidth={2.2} />
        <span><strong>{t('simple.help')}</strong><small>{t('simple.helpSub')}</small></span>
      </Link>
      {family && (
        <Link to="/circle" className="simple-family">
          <h2>{t('simple.family')}</h2>
          <span className="simple-family-row">
            {family.members.filter((m) => m.id !== user.id).map((m) => (
              <span key={m.id} className="fam">
                <Avatar name={m.name} color={m.color} size={64} online={m.online} />
                <span>{(family.owner_id === user.id && m.relation) || m.name}</span>
              </span>
            ))}
          </span>
        </Link>
      )}
    </main>
  );
}

// ---------- Full mode: Safety Circle first ----------
function FullHome() {
  const { t, timeAgo } = useI18n();
  const { user, onEvent } = useApp();
  const { circles, feed, blocks } = useHomeData();
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [verifyOpen, setVerifyOpen] = useState(false);

  useEffect(() => {
    api.get('/reports').then((r) => setAlerts(r.slice(0, 3))).catch(() => {});
    api.get('/stats').then(setStats).catch(() => {});
    return onEvent((name, data) => {
      if (name === 'community:alert') setAlerts((a) => [{ ...data, seen: 0, comment_count: 0 }, ...a].slice(0, 3));
    });
  }, [onEvent]);

  const family = circles[0];
  const last = feed[0];

  return (
    <main className="page home">
      <header className="home-head">
        <h1>{t('home.hello', { name: user.name })}</h1>
        <p className="lede">{t('home.question')}</p>
      </header>

      {family ? (
        <section className="circle-hero">
          <Link to="/circle" className="circle-hero-top">
            <span>
              <h2>{t('home.family')}</h2>
              <small>{family.name}</small>
            </span>
            <ChevronRight size={20} />
          </Link>
          <Link to="/circle" className="circle-hero-people">
            {family.members.map((m) => (
              <span key={m.id} className="fam">
                <Avatar name={m.name} color={m.color} size={50} online={m.online} />
                <span>{m.id === user.id ? t('circle.you') : ((family.owner_id === user.id && m.relation) || m.name)}</span>
              </span>
            ))}
          </Link>
          <p className="circle-hero-status">
            <MessageCircleQuestion size={16} />
            {last ? t('circle.lastAsk', { name: last.sender_id === user.id ? t('circle.you') : last.sender_name, when: timeAgo(last.created_at) }) : t('circle.allQuiet')}
          </p>
          <div className="circle-hero-actions">
            <button type="button" className="mini-action" onClick={() => setVerifyOpen(true)}><ShieldQuestion size={18} /> {t('verify.btn')}</button>
            <Link to="/circle#blocks" className="mini-action"><Ban size={18} /> {t('blocks.title')} <em>{blocks.length}</em></Link>
          </div>
        </section>
      ) : (
        <Link to="/circle" className="empty-cta">{t('home.familyEmpty')} <strong>{t('home.familyAdd')}</strong></Link>
      )}

      <Link to="/check" className="hero-check">
        <span className="hero-icon"><ScanSearch size={30} strokeWidth={2.2} /></span>
        <span className="hero-text">
          <strong>{t('home.checkBtn')}</strong>
          <small>{t('home.checkSub')}</small>
        </span>
        <span className="hero-go" aria-hidden="true"><ArrowRight size={22} /></span>
      </Link>

      <div className="twin">
        <Link to="/call" className="tile">
          <span className="tile-icon ic-ink"><PhoneCall size={22} /></span>
          <strong>{t('home.callBtn')}</strong>
          <small>{t('home.callSub')}</small>
        </Link>
        <Link to="/sos" className="tile tile-sos">
          <span className="tile-icon ic-danger"><LifeBuoy size={22} /></span>
          <strong>{t('home.sosBtn')}</strong>
          <small>{t('home.sosSub')}</small>
        </Link>
      </div>

      <section className="block">
        <div className="block-head">
          <h2>{t('home.alerts')}</h2>
          <Link to="/community" className="more">{t('home.seeAll')} <ChevronRight size={16} /></Link>
        </div>
        {stats && <p className="muted small">{t('home.stats', stats)}</p>}
        <ul className="list">
          {alerts.map((r) => <li key={r.id}><ReportCard r={r} /></li>)}
        </ul>
      </section>
      <VerifySheet open={verifyOpen} onClose={() => setVerifyOpen(false)} />
    </main>
  );
}

export default function Home() {
  const { user } = useApp();
  return user.ui_mode === 'simple' ? <SimpleHome /> : <FullHome />;
}
