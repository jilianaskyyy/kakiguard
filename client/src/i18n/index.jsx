// Tiny i18n system: no library needed.
//   const { t, lang, setLang } = useI18n();
//   t('home.hello', { name: 'Mum' })
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import en from './en.js';
import zh from './zh.js';
import ms from './ms.js';
import ta from './ta.js';
import extra from './notif.js';
import circle from './circle.js';

// Deep-merge extra feature text (notif.js) into each language
const merge = (a, b) => {
  const out = { ...a };
  Object.entries(b || {}).forEach(([k, v]) => {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a?.[k] || {}, v) : v;
  });
  return out;
};
const build = (base, k) => merge(merge(base, extra[k]), circle[k]);
export const LANGS = { en: build(en, 'en'), zh: build(zh, 'zh'), ms: build(ms, 'ms'), ta: build(ta, 'ta') };
export const SPEECH_LANG = { en: 'en-SG', zh: 'zh-CN', ms: 'ms-MY', ta: 'ta-IN' };

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
const I18nCtx = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('kg_lang') || 'en');

  useEffect(() => {
    localStorage.setItem('kg_lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => {
    const t = (key, vars = {}) => {
      let s = get(LANGS[lang], key);
      if (s == null) s = get(LANGS.en, key); // fall back to English if a key is missing
      if (typeof s !== 'string') return s ?? key;
      return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
    };
    const timeAgo = (iso) => {
      const then = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`).getTime();
      const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
      if (mins < 1) return t('common.justNow');
      if (mins < 60) return t('common.minAgo', { n: mins });
      if (mins < 60 * 24) return t('common.hrAgo', { n: Math.round(mins / 60) });
      return t('common.dayAgo', { n: Math.round(mins / 1440) });
    };
    return { lang, setLang: setLangState, t, timeAgo };
  }, [lang]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);
