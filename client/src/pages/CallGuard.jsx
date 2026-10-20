// Live Call Guard — listens to a speaker-phone call and warns the moment it sounds like a scam.
// Works two ways:
//   1. Real mic (Chrome / Android over https or localhost) via the Web Speech API
//   2. "Play a demo scam call" — a scripted scammer voice, perfect for the hackathon stage
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Square, Play, PhoneOff, Users, ShieldQuestion, Sparkles, X } from 'lucide-react';
import { analyse } from '@shared/scamEngine.js';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { useI18n, SPEECH_LANG } from '../i18n/index.jsx';
import { PageHead, levelOf } from '../components/ui.jsx';
import { VerifySheet } from '../components/Verify.jsx';

const DEMO_CALL = [
  'Hello, good afternoon. Am I speaking to the account holder?',
  'I am calling from the Immigration and Checkpoints Authority, ICA.',
  'Your passport was used in a money laundering case in Malaysia.',
  'I will transfer you to police officer Inspector Tan now.',
  'This is a confidential investigation. Do not tell anyone, not even your family.',
  'To clear your name, you must transfer your savings to a safe account immediately.',
  'Please stay on the line and read me the OTP you just received.',
];

function MarkedLine({ text }) {
  const { spans } = analyse(text);
  const out = []; let i = 0;
  spans.forEach((s, n) => {
    out.push(text.slice(i, s.start));
    out.push(<mark key={n}>{text.slice(s.start, s.end)}</mark>);
    i = s.end;
  });
  out.push(text.slice(i));
  return <p>{out}</p>;
}

// PDPA notice: shown before the microphone turns on (notification + consent)
const CONSENT_KEY = 'kg_call_notice_ok';
function ListenNotice({ onAgree, onCancel }) {
  const { t } = useI18n();
  const [dontShow, setDontShow] = useState(false);
  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="listen-title">
      <div className="sheet">
        <button type="button" className="sheet-x" onClick={onCancel} aria-label={t('common.close')}><X /></button>
        <h2 id="listen-title" className="sheet-title"><Mic size={22} /> {t('listen.title')}</h2>
        <ul className="listen-points">
          {['p1', 'p2', 'p3', 'p4', 'p5'].map((k) => <li key={k}>{t(`listen.${k}`)}</li>)}
        </ul>
        <label className="consent">
          <input id="listen-dont-show" type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
          <span>{t('listen.dontShow')}</span>
        </label>
        <button type="button" className="btn btn-primary btn-xl" onClick={() => onAgree(dontShow)}>{t('listen.agree')}</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>{t('listen.cancel')}</button>
      </div>
    </div>
  );
}

export default function CallGuard() {
  const [aiResult, setAiResult] = useState(null);
  const { t, lang } = useI18n();
  const { socket } = useApp();
  const nav = useNavigate();
  const [lines, setLines] = useState([]);
  const [interim, setInterim] = useState('');
  const [mode, setMode] = useState(null); // 'mic' | 'demo' | null
  const [dismissed, setDismissed] = useState(false);
  const [familyTold, setFamilyTold] = useState(false);
  const [err, setErr] = useState('');
  const recRef = useRef(null);
  const timers = useRef([]);
  const lastLevel = useRef('low');

  const full = [...lines, interim].join(' ');
  const result = analyse(full);
  
  // Combine rule engine results with AI results
  const effectiveScore = aiResult?.score ?? result.score;
  const effectiveSummary = aiResult?.summary;
  const level = levelOf(effectiveScore); 


  // Family alert rules come from Notification settings: auto (5s countdown) | ask | off
  const [callMode, setCallMode] = useState('auto');
  const [shared, setShared] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const sharedRef = useRef(false);
  useEffect(() => { api.get('/notify-settings').then((d) => setCallMode(d.settings.call_alert)).catch(() => {}); }, []);

  const shareWithFamily = () => {
    setCountdown(null);
    if (familyTold) return;
    setFamilyTold(true); setShared(true); sharedRef.current = true;
    socket?.emit('call:risk', { score: result.score, level, shared: true });
    api.post('/kaki', { content: lines.slice(-3).join(' '), kind: 'call' }).catch(() => {});
  };

  // Automatically send transcript to Gemini AI backend when new lines arrive
  useEffect(() => {
    if (!full.trim()) {
      setAiResult(null);
      return;
    }
    const timer = setTimeout(() => {
      api.post('/check', { text: full, lang })
        .then((data) => setAiResult(data))
        .catch(() => setAiResult(null));
    }, 400); // 400ms debounce so it doesn't spam the API on every single character
    return () => clearTimeout(timer);
  }, [full, lang]);

  // Phone buzzes when the level rises
  useEffect(() => {
    if (!mode || level === lastLevel.current) return;
    lastLevel.current = level;
    if (navigator.vibrate && level !== 'low') navigator.vibrate(level === 'high' ? [400, 150, 400, 150, 400] : 200);
    if (level === 'high' && !familyTold && callMode === 'auto' && countdown === null) setCountdown(5);
  }, [level, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep family's live banner updated, only once shared
  useEffect(() => { if (shared && mode) socket?.emit('call:risk', { score: result.score, level, shared: true }); }, [result.score, shared]); // eslint-disable-line react-hooks/exhaustive-deps

  // 5-second countdown, cancellable
  useEffect(() => {
    if (countdown === null) return undefined;
    if (countdown <= 0) { shareWithFamily(); return undefined; }
    const id = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(id);
  }, [countdown]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = () => {
    recRef.current?.stop(); recRef.current = null;
    timers.current.forEach(clearTimeout); timers.current = [];
    window.speechSynthesis?.cancel();
    setMode(null); setInterim('');
    if (sharedRef.current) socket?.emit('call:risk', { score: 0, level: 'low', ended: true, shared: true });
  };
  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => { setLines([]); setInterim(''); setDismissed(false); setFamilyTold(false); setShared(false); sharedRef.current = false; setCountdown(null); lastLevel.current = 'low'; setErr(''); };

  // Show the notice first, unless the person ticked "don't show again" on this device
  const askToListen = () => {
    let ok = false;
    try { ok = localStorage.getItem(CONSENT_KEY) === '1'; } catch { /* storage blocked */ }
    if (ok) startMic(); else setNoticeOpen(true);
  };
  const agreeToListen = (dontShow) => {
    if (dontShow) { try { localStorage.setItem(CONSENT_KEY, '1'); } catch { /* storage blocked */ } }
    setNoticeOpen(false);
    startMic();
  };

  const startMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setErr(t('call.micBlocked')); return; }
    reset();
    const rec = new SR();
    rec.lang = SPEECH_LANG[lang]; rec.continuous = true; rec.interimResults = true;
    rec.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) setLines((l) => [...l, r[0].transcript.trim()]); else live += r[0].transcript;
      }
      setInterim(live);
    };
    rec.onerror = (e) => { if (e.error === 'not-allowed') setErr(t('call.micBlocked')); };
    rec.onend = () => { if (recRef.current === rec) rec.start(); }; // keep listening until Stop
    rec.start(); recRef.current = rec; setMode('mic');
  };

  const startDemo = () => {
    reset(); setMode('demo');
    const synth = window.speechSynthesis;
    let delay = 600;
    DEMO_CALL.forEach((line, i) => {
      timers.current.push(setTimeout(() => {
        setLines((l) => [...l, line]);
        if (synth) {
          const u = new SpeechSynthesisUtterance(line);
          u.lang = 'en-SG'; u.rate = 1.02; u.pitch = 0.8;
          synth.speak(u);
        }
        if (i === DEMO_CALL.length - 1) timers.current.push(setTimeout(() => setMode(null), 3500));
      }, delay));
      delay += 1200 + line.length * 55;
    });
  };

  const statusKey = level === 'high' ? 'call.danger' : level === 'medium' ? 'call.careful' : 'call.safe';

  return (
    <main className="page callguard">
      <PageHead title={t('call.title')} sub={t('call.intro')} back />

      {/* <div className={`call-meter cm-${level} ${mode ? 'live' : ''}`}>
        <div className="cm-ring"><span>{result.score}</span></div>
        <strong>{mode || lines.length ? t(statusKey) : t('call.title')}</strong>
        <div className="cm-bar"><i style={{ width: `${result.score}%` }} /></div>
        {result.flags.length > 0 && (
          <div className="chips">{result.flags.slice(0, 5).map((f) => <span key={f.flag} className="chip warn">{t(`flag.${f.flag}.t`)}</span>)}</div>
        )}
      </div> */}

      <div className={`call-meter cm-${level} ${mode ? 'live' : ''}`}>
        {mode === 'mic' && <span className="listening-badge" role="status"><i aria-hidden="true" /> {t('listen.badge')}</span>}
        <div className="cm-ring"><span>{effectiveScore}</span></div>
        <strong>{mode || lines.length ? (effectiveSummary || t(statusKey)) : t('call.title')}</strong>
        <div className="cm-bar"><i style={{ width: `${effectiveScore}%` }} /></div>
        {result.flags.length > 0 && (
          <div className="chips">
            {result.flags.slice(0, 5).map((f) => (
              <span key={f.flag} className="chip warn">{t(`flag.${f.flag}.t`)}</span>
            ))}
          </div>
        )}
      </div>
      

      <div className="call-controls">
        {mode ? (
          <button type="button" className="btn btn-dark btn-xl" onClick={stop}><Square /> {t('call.stop')}</button>
        ) : (
          <>
            <button type="button" className="btn btn-primary btn-xl" onClick={askToListen}><Mic /> {t('call.start')}</button>
            <button type="button" className="btn btn-ghost" onClick={startDemo}><Play size={18} /> {t('call.demo')}</button>
          </>
        )}
        {/* AI can clone a family member's voice. Check with their real phone instead. */}
        <button type="button" className="btn btn-ghost verify-cta" onClick={() => setVerifyOpen(true)}><ShieldQuestion size={18} /> {t('verify.callerSays')}</button>
      </div>
      {err && <p className="error">{err}</p>}

      {(lines.length > 0 || interim) && (
        <section className="panel transcript">
          <h3>{t('call.transcript')}</h3>
          {lines.map((l, i) => <MarkedLine key={i} text={l} />)}
          {interim && <p className="muted">{interim}…</p>}
        </section>
      )}

      {level === 'high' && !dismissed && (
        <div className="hangup" role="alertdialog" aria-live="assertive">
          <PhoneOff size={72} strokeWidth={2.4} />
          <h2>{t('call.danger')}</h2>
          <p>{t('call.dangerSub')}</p>
          <div className="chips center">{result.flags.slice(0, 4).map((f) => <span key={f.flag} className="chip">{t(`flag.${f.flag}.t`)}</span>)}</div>
          {familyTold && <p className="told"><Users size={18} /> {t('call.familyTold')}</p>}
          {!familyTold && countdown !== null && (
            <div className="countdown">
              <p className="told"><Users size={18} /> {t('call.countdown', { n: countdown })}</p>
              <button type="button" className="btn btn-outline-white" onClick={() => setCountdown(null)}>{t('call.cancelTell')}</button>
            </div>
          )}
          {!familyTold && countdown === null && callMode !== 'off' && (
            <button type="button" className="btn btn-outline-white" onClick={shareWithFamily}><Users size={18} /> {t('call.tellFamily')}</button>
          )}
          <button type="button" className="btn btn-white btn-xl" onClick={() => { stop(); setDismissed(true); }}>{t('call.hungUp')}</button>
          <button type="button" className="btn btn-outline-white" onClick={() => setVerifyOpen(true)}><ShieldQuestion size={18} /> {t('verify.callerSays')}</button>
          <button type="button" className="btn btn-outline-white" onClick={() => { stop(); nav('/sos'); }}>{t('home.sosBtn')}</button>
        </div>
      )}
      {noticeOpen && <ListenNotice onAgree={agreeToListen} onCancel={() => setNoticeOpen(false)} />}
      <VerifySheet open={verifyOpen} onClose={() => setVerifyOpen(false)} />
    </main>
  );
}
