// "Scam or Safe?" — swipe left for Scam, right for Safe (or tap the buttons).
import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Phone, Mail, Send } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { Avatar, PageHead } from '../components/ui.jsx';

const CH_ICON = { sms: MessageSquare, whatsapp: MessageSquare, telegram: Send, email: Mail, call: Phone };

export default function Learn() {
  const { t } = useI18n();
  const { refreshMe } = useApp();
  const [deck, setDeck] = useState(null);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState(null); // 'scam' | 'safe'
  const [correct, setCorrect] = useState(0);
  const [board, setBoard] = useState([]);
  const [drag, setDrag] = useState(0);
  const start = useRef(null);

  useEffect(() => { api.get('/leaderboard').then(setBoard).catch(() => {}); }, []);
  const play = async () => { setDeck(await api.get('/quiz')); setI(0); setCorrect(0); setAnswer(null); };

  const card = deck?.[i];
  const finished = deck && i >= deck.length;

  const choose = (pick) => {
    if (answer || !card) return;
    setAnswer(pick); setDrag(0);
    if ((pick === 'scam') === card.is_scam) setCorrect((c) => c + 1);
  };
  const next = async () => {
    setAnswer(null);
    const n = i + 1; setI(n);
    if (n >= deck.length) {
      await api.post('/quiz/score', { correct, total: deck.length }).catch(() => {});
      refreshMe().catch(() => {});
      api.get('/leaderboard').then(setBoard).catch(() => {});
    }
  };

  // Touch / mouse swipe
  const down = (e) => { if (!answer) start.current = e.clientX; };
  const move = (e) => { if (start.current != null) setDrag(e.clientX - start.current); };
  const up = () => {
    if (start.current == null) return;
    start.current = null;
    if (drag < -90) choose('scam'); else if (drag > 90) choose('safe'); else setDrag(0);
  };

  const right = answer && (answer === 'scam') === card?.is_scam;
  const Icon = card ? (CH_ICON[card.channel] || MessageSquare) : MessageSquare;

  return (
    <main className="page learn">
      <PageHead title={t('learn.title')} sub={t('learn.sub')} />

      {!deck && <button type="button" className="btn btn-primary btn-xl" onClick={play}>{t('learn.start')}</button>}

      {card && (
        <>
          <div className="progress"><i style={{ width: `${(i / deck.length) * 100}%` }} /></div>
          <div
            className={`swipe-card ${answer ? (right ? 'is-right' : 'is-wrong') : ''}`}
            style={{ transform: `translateX(${drag}px) rotate(${drag / 18}deg)` }}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          >
            <div className="msg-head"><Icon size={18} /> {t(`platform.${card.channel}`)} · {t('learn.from', { s: card.sender })}</div>
            <div className={`bubble ${card.channel}`}>{card.message}</div>
            {drag < -30 && <span className="stamp stamp-scam">{t('learn.scam')}</span>}
            {drag > 30 && <span className="stamp stamp-safe">{t('learn.safe')}</span>}
          </div>

          {!answer ? (
            <div className="choice-row">
              <button type="button" className="btn btn-danger btn-xl" onClick={() => choose('scam')}>{t('learn.scam')}</button>
              <button type="button" className="btn btn-safe btn-xl" onClick={() => choose('safe')}>{t('learn.safe')}</button>
            </div>
          ) : (
            <div className={`feedback ${right ? 'ok' : 'no'}`}>
              <h2>{t(right ? 'learn.correct' : 'learn.wrong')} {card.is_scam ? t('learn.scam') : t('learn.safe')}</h2>
              {card.is_scam ? (
                <>
                  <p>{t('learn.because')}</p>
                  <ul>{card.flags.map((f) => <li key={f}><strong>{t(`flag.${f}.t`)}</strong>: {t(`flag.${f}.d`)}</li>)}</ul>
                </>
              ) : <p>{t(`learn.${card.safe_why}`)}</p>}
              <button type="button" className="btn btn-primary btn-xl" onClick={next}>{t('learn.next')}</button>
            </div>
          )}
        </>
      )}

      {finished && (
        <div className="panel center">
          <h2 className="score">{t('learn.done', { c: correct, t: deck.length })}</h2>
          <p className="earned">{t('learn.earned', { p: correct * 5 })}</p>
          <button type="button" className="btn btn-primary btn-xl" onClick={play}>{t('learn.again')}</button>
        </div>
      )}

      <section className="block">
        <h2>{t('learn.board')}</h2>
        <ol className="board">
          {board.map((u) => (
            <li key={u.id}><Avatar name={u.name} color={u.color} size={34} /> <span>{u.name}</span> <strong>{u.points}</strong></li>
          ))}
        </ol>
      </section>
    </main>
  );
}
