import { useState } from 'react';
import { Phone, Users, CheckCircle2 } from 'lucide-react';
import { api } from '../api.js';
import { useI18n } from '../i18n/index.jsx';
import { PageHead } from '../components/ui.jsx';

export default function Sos() {
  const { t } = useI18n();
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  const alertFamily = async () => {
    try { await api.post('/kaki', { kind: 'sos', content: note }); setSent(true); } catch { setErr(t('common.error')); }
  };

  return (
    <main className="page sos">
      <PageHead title={t('sos.title')} sub={t('sos.sub')} back />
      <ol className="sos-steps">
        {['step1', 'step2', 'step3', 'step4'].map((s) => <li key={s}>{t(`sos.${s}`)}</li>)}
      </ol>
      <a className="btn btn-danger btn-xl" href="tel:1799"><Phone /> {t('sos.call1799')}</a>
      <label className="field">{t('sos.note')}<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      {sent ? (
        <p className="success"><CheckCircle2 /> {t('sos.alerted')}</p>
      ) : (
        <button type="button" className="btn btn-kaki btn-xl" onClick={alertFamily}><Users /> {t('sos.alert')}</button>
      )}
      {err && <p className="error">{err}</p>}
    </main>
  );
}
