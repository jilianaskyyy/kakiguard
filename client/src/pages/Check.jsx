import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardPaste, Mic, Sparkles, Users, Flag, RotateCcw, Check as CheckIcon } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { useI18n, SPEECH_LANG } from '../i18n/index.jsx';
import { Avatar, HighlightedText, PageHead, RiskDial } from '../components/ui.jsx';

const EXAMPLES = [
  'This is Inspector Tan from ICA. Your passport was used in a crime. Call me back at 8765 0001 immediately.',
  'DBS: Your account has been suspended due to unusual activity. Verify immediately at dbs-sg-secure.com/verify to avoid permanent closure.',
  'Hi Mum, I dropped my phone, this is my new number. Can you help me PayNow $800 urgently? Don\'t tell Dad first ok',
  'Part-time job! Earn $300 per day just like videos. No experience needed. Add me on Telegram t.me/hr_sg_jobs',
  'Your GrabFood order is on the way. Your rider will arrive in 10 minutes.',
];

export default function Check() {
  const { t, lang } = useI18n();
  const { onEvent } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [text, setText] = useState(params.get('text') || params.get('url') || '');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [kaki, setKaki] = useState(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const exampleIdx = useRef(0);
  const resultRef = useRef(null);

  // Live replies from family to my "Ask my family" request
  useEffect(() => onEvent((name, data) => {
    if (name === 'kaki:reply') setKaki((k) => (k && data.check.id === k.id ? data.check : k));
  }), [onEvent]);

  const analyse = async (value = text) => {
    if (!value.trim()) return;
    setBusy(true); setErr(''); setKaki(null);
    try {
      const r = await api.post('/check', { text: value, lang });
      setRes({ ...r, text: value });
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch { setErr(t('common.error')); }
    setBusy(false);
  };

  // Shared from another app (Android share sheet) → check straight away
  useEffect(() => { if (params.get('text') || params.get('url')) analyse(); }, []); // eslint-disable-line

  const paste = async () => {
    try { const v = await navigator.clipboard.readText(); if (v) setText(v); } catch { /* permission denied */ }
  };
  const example = () => { setText(EXAMPLES[exampleIdx.current++ % EXAMPLES.length]); setRes(null); };

  const speak = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setErr(t('call.micBlocked')); return; }
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = SPEECH_LANG[lang]; rec.interimResults = true; rec.continuous = true;
    const base = text ? `${text} ` : '';
    rec.onresult = (e) => setText(base + [...e.results].map((r) => r[0].transcript).join(' '));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start(); recRef.current = rec; setListening(true);
  };

  const askFamily = async () => {
    try { setKaki(await api.post('/kaki', { content: res.text, kind: 'ask' })); } catch { setErr(t('common.error')); }
  };

  return (
    <main className="page">
      <PageHead title={t('check.title')} />
      <div className="composer">
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t('check.placeholder')} rows={5} />
        <div className="composer-tools">
          <button type="button" className="tool" onClick={paste}><ClipboardPaste size={18} /> {t('check.paste')}</button>
          <button type="button" className={`tool ${listening ? 'rec' : ''}`} onClick={speak}><Mic size={18} /> {t(listening ? 'check.listening' : 'check.listen')}</button>
          <button type="button" className="tool" onClick={example}><Sparkles size={18} /> {t('check.tryExample')}</button>
        </div>
      </div>
      <button type="button" className="btn btn-primary btn-xl" disabled={busy || !text.trim()} onClick={() => analyse()}>
        {t(busy ? 'check.analysing' : 'check.analyse')}
      </button>
      {err && <p className="error">{err}</p>}

      {res && (
        <section ref={resultRef} className={`result result-${res.level}`} key={res.text}>
          <div className="verdict">
            <RiskDial score={res.score} />
            <h2>{t(`check.risk.${res.level}`)}</h2>
            <p>{t(`check.riskSub.${res.level}`)}</p>
          </div>

          {res.spans.length > 0 && (
            <div className="panel">
              <h3>{t('check.whyTitle')}</h3>
              <p className="muted small">{t('check.whyTap')}</p>
              <HighlightedText text={res.text} spans={res.spans} first={res.flags[0]?.flag} />
              <ul className="flag-list">
                {res.flags.map((f) => <li key={f.flag}>{t(`flag.${f.flag}.t`)}</li>)}
              </ul>
            </div>
          )}

          <div className="panel panel-community">
            <h3><Users size={20} /> {t('check.communityTitle')}</h3>
            {res.similar.people > 0 ? (
              <>
                <p className="big-line">{t('check.communityLine', { n: res.similar.people })}</p>
                {res.similar.reports.map((r) => (
                  <button type="button" key={r.id} className="similar" onClick={() => nav(`/community/${r.id}`)}>
                    {r.title} <span className="muted">· {r.sim}%</span>
                  </button>
                ))}
              </>
            ) : <p>{t('check.communityNone')}</p>}
          </div>

          <div className="panel">
            <h3>{t('check.actionsTitle')}</h3>
            <ol className="actions">
              {res.actions.map((a) => <li key={a}>{t(`act.${a}`)}</li>)}
            </ol>
          </div>

          <div className="panel panel-ai">
            <h3><Sparkles size={18} /> {t('check.aiTitle')}</h3>
            {res.ai ? (
              <>
                <p>{res.ai.summary}</p>
                {res.ai.extra_red_flags?.length > 0 && <ul>{res.ai.extra_red_flags.map((f) => <li key={f}>{f}</li>)}</ul>}
                {res.ai.next_step && <p><strong>{res.ai.next_step}</strong></p>}
              </>
            ) : <p className="muted small">{t('check.aiOff')}</p>}
          </div>

          <div className="stack">
            {!kaki ? (
              <button type="button" className="btn btn-kaki btn-xl" onClick={askFamily}><Users /> {t('check.askKaki')}</button>
            ) : (
              <div className="panel kaki-wait">
                <p><CheckIcon size={18} /> {t('check.askKakiSent')}</p>
                {kaki.replies.map((r) => (
                  <div key={r.user_id} className={`kaki-reply v-${r.verdict}`}>
                    <Avatar name={r.name} color={r.color} size={34} /> <strong>{r.name}</strong> {t(`circle.verdict.${r.verdict}`)}
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => nav('/report/new', { state: { content: res.text } })}><Flag size={18} /> {t('check.report')}</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setRes(null); setText(''); window.scrollTo(0, 0); }}><RotateCcw size={18} /> {t('check.again')}</button>
          </div>
          <p className="disclaimer">{t('check.disclaimer')}</p>
        </section>
      )}
    </main>
  );
}
