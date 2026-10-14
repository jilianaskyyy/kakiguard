import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { useI18n, LANGS } from '../i18n/index.jsx';
import { Avatar, Logo } from '../components/ui.jsx';

// Little drawings of each style, so people pick by looking, not reading
function ModePreview({ mode }) {
  return mode === 'simple' ? (
    <svg viewBox="0 0 80 100" className="mode-art" aria-hidden="true">
      <rect x="1" y="1" width="78" height="98" rx="12" className="ma-frame" />
      <rect x="9" y="12" width="62" height="22" rx="7" className="ma-accent" />
      <rect x="9" y="40" width="62" height="22" rx="7" className="ma-ink" />
      <rect x="9" y="68" width="62" height="22" rx="7" className="ma-danger" />
    </svg>
  ) : (
    <svg viewBox="0 0 80 100" className="mode-art" aria-hidden="true">
      <rect x="1" y="1" width="78" height="98" rx="12" className="ma-frame" />
      <rect x="9" y="10" width="62" height="14" rx="5" className="ma-accent" />
      <rect x="9" y="29" width="29" height="16" rx="5" className="ma-soft" />
      <rect x="42" y="29" width="29" height="16" rx="5" className="ma-soft" />
      <rect x="9" y="50" width="62" height="7" rx="3" className="ma-soft" />
      <rect x="9" y="61" width="62" height="7" rx="3" className="ma-soft" />
      <rect x="9" y="72" width="62" height="7" rx="3" className="ma-soft" />
      <rect x="9" y="86" width="62" height="7" rx="3" className="ma-ink" />
    </svg>
  );
}

export default function Login() {
  const { t, lang, setLang } = useI18n();
  const { login } = useApp();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', username: '', password: '', ui_mode: 'simple', consent: false });
  const [err, setErr] = useState('');
  const [demo, setDemo] = useState([]);

  useEffect(() => { api.get('/auth/demo-accounts').then(setDemo).catch(() => {}); }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e, creds) => {
    e?.preventDefault();
    setErr('');
    if (!creds && mode === 'signup' && !form.consent) { setErr(t('login.needConsent')); return; }
    try {
      const body = creds || (mode === 'login' ? { username: form.username, password: form.password } : { ...form, lang });
      const { token, user } = await api.post(mode === 'login' || creds ? '/auth/login' : '/auth/register', body);
      login(token, user);
    } catch (ex) {
      setErr(t({ wrong_login: 'login.wrong', invalid_signup: 'login.invalid', username_taken: 'login.taken', need_consent: 'login.needConsent' }[ex.code] || 'common.error'));
    }
  };

  return (
    <main className="login">
      <div className="login-langs">
        {Object.entries(LANGS).map(([k, v]) => (
          <button type="button" key={k} className={`chip ${lang === k ? 'on' : ''}`} onClick={() => setLang(k)}>{v.langName}</button>
        ))}
      </div>
      <Logo size={60} />
      <h1>{t('login.title')}</h1>
      <p className="lede">{t('login.sub')}</p>

      <form onSubmit={submit} className="stack">
        {mode === 'signup' && (
          <label className="field">{t('login.name')}<input id="name" value={form.name} onChange={set('name')} autoComplete="name" /></label>
        )}
        <label className="field">{t('login.username')}<input id="username" value={form.username} onChange={set('username')} autoCapitalize="none" autoComplete="username" /></label>
        <label className="field">{t('login.password')}<input id="password" type="password" value={form.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>

        {mode === 'signup' && (
          <>
            <fieldset>
              <legend>{t('mode.title')}</legend>
              <div className="mode-pick">
                {['simple', 'full'].map((m) => (
                  <label key={m} className={`mode-card ${form.ui_mode === m ? 'on' : ''}`}>
                    <input type="radio" name="ui_mode" value={m} checked={form.ui_mode === m} onChange={() => setForm({ ...form, ui_mode: m })} />
                    <ModePreview mode={m} />
                    <strong>{t(`mode.${m}`)}</strong>
                    <small>{t(`mode.${m}D`)}</small>
                  </label>
                ))}
              </div>
              <p className="muted small">{t('mode.changeD')}</p>
            </fieldset>
            <label className="consent">
              <input id="consent" type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
              <span>{t('login.consent')}. <Link to="/privacy">{t('login.privacyLink')}</Link></span>
            </label>
            <p className="muted small">{t('login.under13')}</p>
          </>
        )}

        {err && <p className="error">{err}</p>}
        <button className="btn btn-primary btn-xl" type="submit">{t(mode === 'login' ? 'login.login' : 'login.signup')}</button>
        <button className="link-btn" type="button" onClick={() => { setErr(''); setMode(mode === 'login' ? 'signup' : 'login'); }}>
          {t(mode === 'login' ? 'login.noAccount' : 'login.haveAccount')}
        </button>
      </form>

      {mode === 'login' && demo.length > 0 && (
        <section className="demo-box">
          <h2>{t('login.demo')}</h2>
          <div className="demo-list">
            {demo.map((d) => (
              <button type="button" key={d.username} className="demo-user" onClick={() => submit(null, { username: d.username, password: 'demo123' })}>
                <Avatar name={d.name} color={d.color} size={44} />
                <span>{d.name.split(' ')[0]}</span>
                <small>{t(`mode.${d.ui_mode}`)}</small>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
