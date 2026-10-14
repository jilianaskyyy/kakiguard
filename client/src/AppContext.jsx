// Global app state: logged-in user, real-time socket, notifications, pop-ups and toasts.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, getToken, setToken } from './api.js';
import { useI18n } from './i18n/index.jsx';

const Ctx = createContext(null);
const POPUP_TYPES = ['ask', 'escalated', 'sos', 'call'];

export function AppProvider({ children }) {
  const { setLang, t } = useI18n();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [socket, setSocket] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [unread, setUnread] = useState(0);
  const [kakiPopup, setKakiPopup] = useState(null);     // an incoming family ask / SOS
  const [verifyPopup, setVerifyPopup] = useState(null); // "are you calling Mum right now?"
  const [liveCall, setLiveCall] = useState(null);       // family member on a risky call right now
  const [bigText, setBigText] = useState(() => localStorage.getItem('kg_big') === '1');
  const listeners = useRef(new Set());
  const tRef = useRef(t);
  tRef.current = t;

  // Simple mode (seniors): bigger everything, fewer screens
  useEffect(() => {
    document.documentElement.classList.toggle('simple', user?.ui_mode === 'simple');
  }, [user?.ui_mode]);

  useEffect(() => {
    document.documentElement.classList.toggle('big', bigText);
    localStorage.setItem('kg_big', bigText ? '1' : '0');
  }, [bigText]);

  // toast({ title: 'translation.key' }) or toast({ text: 'already translated' })
  const toast = useCallback((x) => {
    const id = Math.random();
    setToasts((all) => [...all, { id, ...x }]);
    setTimeout(() => setToasts((all) => all.filter((y) => y.id !== id)), x.ms || 5000);
  }, []);

  // Pages can subscribe to socket events: const off = onEvent((name, data) => …)
  const onEvent = useCallback((fn) => { listeners.current.add(fn); return () => listeners.current.delete(fn); }, []);

  const login = (token, u) => { setToken(token); setUser(u); setLang(u.lang); };
  const logout = () => { setToken(null); setUser(null); setUnread(0); };
  const refreshMe = useCallback(async () => {
    const { user: u } = await api.get('/me'); setUser(u); return u;
  }, []);
  const refreshUnread = useCallback(() => api.get('/notifications/unread').then((d) => setUnread(d.unread)).catch(() => {}), []);

  // Restore session on load
  useEffect(() => {
    if (!getToken()) { setReady(true); return; }
    api.get('/me').then(({ user: u }) => setUser(u)).catch(() => setToken(null)).finally(() => setReady(true));
  }, []);

  // Connect real-time once logged in
  useEffect(() => {
    if (!user) return undefined;
    refreshUnread();
    const s = io(import.meta.env.VITE_API_URL || '/', { auth: { token: getToken() } });
    const emit = (name, data) => listeners.current.forEach((fn) => fn(name, data));

    // Feed updates (no buzzing). Buzzing is decided by the server, per person, in 'notif:new'.
    ['kaki:new', 'kaki:reply', 'community:alert', 'mod:new', 'presence', 'circle:update', 'verify:answer', 'blocks:update'].forEach((ev) => s.on(ev, (d) => emit(ev, d)));

    s.on('notif:new', ({ notification: n, push, extra }) => {
      setUnread((u) => u + 1);
      emit('notif:new', n);
      if (!push) return; // arrived quietly: only the bell badge changes
      if (n.type === 'verify' && extra) { setVerifyPopup(extra); return; }
      if (POPUP_TYPES.includes(n.type) && extra) { setKakiPopup(extra); return; }
      const tt = tRef.current;
      if (n.type === 'reply') toast({ kind: 'info', text: tt('notif.type.reply', { name: n.actor_name, verdict: tt(`circle.verdict.${n.body}`) }), link: '/circle' });
      else if (n.type === 'community') toast({ kind: 'alert', title: 'community.newAlert', body: n.body, link: `/community/${n.ref_id}` });
      else if (n.type === 'report') toast({ kind: 'info', title: 'notif.type.report', body: n.body, link: `/community/${n.ref_id}` });
    });
    s.on('call:risk', (c) => setLiveCall(c.ended ? null : c));
    setSocket(s);
    return () => s.disconnect();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Ctx.Provider value={{
      user, setUser, ready, login, logout, refreshMe, verifyPopup, setVerifyPopup, socket, toast, toasts, onEvent, unread, setUnread, refreshUnread,
      kakiPopup, setKakiPopup, liveCall, setLiveCall, bigText, setBigText,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);
