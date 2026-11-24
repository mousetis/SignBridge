import { createContext, useCallback, useContext, useMemo } from 'react';
import { useSettings } from '../context/SettingsContext.jsx';
import { AREAS } from './areas.js';

/** Từ điển hợp nhất: { vi: {khoá: chuỗi}, en: {…} }. Mỗi "area" khai báo cả hai ngôn ngữ cạnh nhau. */
export const DICT = { vi: {}, en: {} };
for (const a of AREAS) {
  Object.assign(DICT.vi, a.vi);
  Object.assign(DICT.en, a.en);
}

export function translate(lang, key, vars) {
  let s = DICT[lang]?.[key] ?? DICT.vi[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
  return s;
}

const Ctx = createContext({ t: (k) => k, lang: 'vi' });

export function I18nProvider({ children }) {
  const { settings } = useSettings();
  const lang = settings.lang === 'en' ? 'en' : 'vi';
  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);
  const value = useMemo(() => ({ t, lang }), [t, lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useT = () => useContext(Ctx);
