// "Is it really you?" — beats AI voice cloning.
// A voice can be faked; a family member's own logged-in phone can't. So instead of trusting the
// voice, KakiGuard asks the real person's KakiGuard account: "Are you calling Mum right now?"
import { useEffect, useRef, useState } from 'react';
import { X, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { Avatar } from './ui.jsx';

const WAIT_SECONDS = 60;

// The sheet the person ON the call uses (e.g. Mum)
export function VerifySheet({ open, onClose, presetId = null }) {
  const { t } = useI18n();
  const { user, onEvent } = useApp();
  const [people, setPeople] = useState([]);
  const [pick, setPick] = useState(presetId);
  const [req, setReq] = useState(null);   // the request we sent
  const [left, setLeft] = useState(WAIT_SECONDS);
  const timer = useRef(null);

  useEffect(() => {
    if (!open) return;
    setPick(presetId); setReq(null); setLeft(WAIT_SECONDS);
    api.get('/circles').then((cs) => {
      const seen = new Map();
      cs.forEach((c) => c.members.forEach((m) => { if (m.id !== user.id) seen.set(m.id, m); }));
      setPeople([...seen.values()]);
    }).catch(() => {});
  }, [open, presetId, user.id]);

  // Answer arrives in real time
  useEffect(() => onEvent((name, v) => { if (name === 'verify:answer') setReq((r) => (r && r.id === v.id ? v : r)); }), [onEvent]);

  // Countdown while waiting
  useEffect(() => {
    clearInterval(timer.current);
    if (req?.status === 'pending') timer.current = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer.current);
  }, [req?.status, req?.id]);

  if (!open) return null;
  const person = people.find((p) => p.id === pick);
  const send = async () => { setLeft(WAIT_SECONDS); setReq(await api.post('/verify', { user_id: pick }).catch(() => null)); };

  let result = null;
  if (req?.status === 'yes') result = <div className="verify-result ok"><ShieldCheck size={36} /><strong>{t('verify.yes', { name: req.to_name })}</strong></div>;
  else if (req?.status === 'no') result = <div className="verify-result bad"><ShieldAlert size={36} /><strong>{t('verify.no', { name: req.to_name })}</strong></div>;
  else if (req && left === 0) result = <div className="verify-result warn"><Clock size={36} /><strong>{t('verify.noAnswer', { name: req.to_name })}</strong></div>;

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="verify-title">
      <div className="sheet">
        <button type="button" className="sheet-x" onClick={onClose} aria-label={t('common.close')}><X /></button>
        <h2 id="verify-title" className="sheet-title">{t('verify.title')}</h2>
        <p className="muted">{t('verify.intro')}</p>

        {!req && (
          <>
            <h3>{t('verify.pick')}</h3>
            <div className="people-pick">
              {people.map((p) => (
                <button key={p.id} type="button" className={`person ${pick === p.id ? 'on' : ''}`} aria-pressed={pick === p.id} onClick={() => setPick(p.id)}>
                  <Avatar name={p.name} color={p.color} size={52} />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-primary btn-xl" disabled={!pick} onClick={send}>
              {t('verify.send', { name: person?.name || '' })}
            </button>
          </>
        )}

        {req && !result && (
          <div className="verify-wait">
            <Avatar name={req.to_name} color={req.to_color} size={64} />
            <span className="ping" aria-hidden="true" />
            <strong>{t('verify.waiting', { name: req.to_name })}</strong>
            <span className="muted">{left}s</span>
          </div>
        )}
        {result}
        {result && <button type="button" className="btn btn-ghost btn-xl" onClick={onClose}>{t('common.close')}</button>}
      </div>
    </div>
  );
}

// The pop-up on the REAL family member's phone (e.g. Ethan)
export function VerifyPopup() {
  const { verifyPopup: v, setVerifyPopup } = useApp();
  const { t } = useI18n();
  const [sent, setSent] = useState(false);
  if (!v) return null;
  const answer = async (a) => {
    await api.post(`/verify/${v.id}/answer`, { answer: a }).catch(() => {});
    setSent(true);
    setTimeout(() => { setVerifyPopup(null); setSent(false); }, 1200);
  };
  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true">
      <div className="sheet sheet-verify">
        <button type="button" className="sheet-x" onClick={() => setVerifyPopup(null)} aria-label={t('common.close')}><X /></button>
        <div className="sheet-head">
          <Avatar name={v.from_name} color={v.from_color} size={56} />
          <h2>{t('verify.askTitle', { name: v.from_name })}</h2>
        </div>
        <p className="muted">{t('verify.askSub')}</p>
        {sent ? <p className="sent-note">✓ {t('verify.sent')}</p> : (
          <div className="reply-grid">
            <button type="button" className="btn btn-safe btn-xl" onClick={() => answer('yes')}>{t('verify.yesBtn')}</button>
            <button type="button" className="btn btn-danger btn-xl" onClick={() => answer('no')}>{t('verify.noBtn')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
