import { useCallback, useEffect, useRef, useState } from 'react';
import { restoreDiacritics } from '../data/vocabulary.js';
import { normalizeForSign } from '../lib/text.js';

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/** Nhập giọng nói (Web Speech API): trả về văn bản đã bỏ dấu, tách thành A–Z / 0–9. */
export function useSpeechRecognition({ lang = 'vi-VN', onFinal, onError }) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [interimRaw, setInterimRaw] = useState('');
  const recRef = useRef(null);
  const want = useRef(false);
  const cbFinal = useRef(onFinal);
  const cbError = useRef(onError);
  cbFinal.current = onFinal;
  cbError.current = onError;

  const stop = useCallback(() => {
    want.current = false;
    recRef.current?.stop();
    setListening(false);
    setInterim('');
    setInterimRaw('');
  }, []);

  const start = useCallback(() => {
    if (!SR) return;
    want.current = true;
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let tmp = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) cbFinal.current?.(normalizeForSign(r[0].transcript).trim(), r[0].transcript.trim());
        else tmp += r[0].transcript;
      }
      setInterim(normalizeForSign(tmp));
      setInterimRaw(tmp);
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      want.current = false;
      setListening(false);
      cbError.current?.(e.error === 'not-allowed' ? 'mic-denied' : e.error);
    };
    rec.onend = () => {
      if (want.current) {
        try {
          rec.start(); // Chrome tự dừng sau khoảng lặng -> khởi động lại để nghe liên tục
        } catch {
          setListening(false);
        }
      } else setListening(false);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (e) {
      cbError.current?.(e.message);
    }
  }, [lang]);

  useEffect(() => () => { want.current = false; recRef.current?.abort?.(); }, []);
  return { supported: !!SR, listening, interim, interimRaw, start, stop, toggle: () => (listening ? stop() : start()) };
}

/** Đọc thành tiếng (Text-to-Speech). Tự khôi phục dấu tiếng Việt cho các từ có trong từ điển. */
export function useTTS({ lang = 'vi-VN', rate = 0.95 } = {}) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback((text) => {
    if (!supported || !text?.trim()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(lang.startsWith('vi') ? restoreDiacritics(text) : text.toLowerCase());
    u.lang = lang;
    u.rate = rate;
    const v = window.speechSynthesis.getVoices().find((x) => x.lang?.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
    if (v) u.voice = v;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [supported, lang, rate]);

  const cancel = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);
  return { supported, speaking, speak, cancel };
}
