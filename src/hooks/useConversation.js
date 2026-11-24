import { useCallback, useEffect, useRef, useState } from 'react';
import { newSession, saveSession } from '../lib/history.js';
import { useSettings } from '../context/SettingsContext.jsx';
import { bumpFreq } from '../lib/smart.js';

/** Một cuộc hội thoại: danh sách tin nhắn { id, who:'me'|'other', text, at, src } + tự lưu vào lịch sử (nếu bật). */
export function useConversation(mode = 'sign') {
  const { settings } = useSettings();
  const [session, setSession] = useState(() => newSession(mode));
  const timer = useRef(null);
  const histOn = settings.history;

  useEffect(() => {
    if (!histOn || !session.messages.length) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => saveSession(session), 600);
    return () => clearTimeout(timer.current);
  }, [session, histOn]);
  // lưu nốt khi rời trang
  useEffect(() => () => { clearTimeout(timer.current); }, []);

  const send = useCallback((who, text, src = 'sign') => {
    const t = text.trim();
    if (!t) return null;
    const m = { id: 'm' + Math.random().toString(36).slice(2, 9), who, text: t, at: Date.now(), src };
    setSession((s) => ({ ...s, messages: [...s.messages, m] }));
    if (who === 'me') bumpFreq(t);
    return m;
  }, []);
  const reset = useCallback(() => { if (histOn) saveSession(session); setSession(newSession(mode)); }, [session, histOn, mode]);
  const remove = useCallback((id) => setSession((s) => ({ ...s, messages: s.messages.filter((m) => m.id !== id) })), []);
  return { session, messages: session.messages, send, reset, remove };
}
