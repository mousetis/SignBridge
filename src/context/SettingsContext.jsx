import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { systemConfig } from '../config/systemConfig.js';
import { store } from '../lib/store.js';
import { GLOBAL_KEY, ensureProfiles, getState, pkey, PROFILES_KEY, addProfile, renameProfile, removeProfile, switchProfile } from '../lib/profiles.js';

const hw = systemConfig.esp32_ip_connection;
const GLOBAL_KEYS = ['lang', 'theme', 'fs', 'motion', 'cameraId', 'mirror', 'ip', 'port', 'path', 'autoConnect', 'devices', 'onboarded', 'scanHint', 'backend', 'useWorker', 'history', 'speakAuto', 'backendHint', 'bench'];

export const GLOBAL_DEFAULTS = {
  lang: null, // null = theo trình duyệt
  theme: 'system', // system | light | dark | hc
  fs: 'm', // s | m | l | xl
  motion: 'auto', // auto | reduce | full
  cameraId: '',
  mirror: true,
  ip: hw.default_ip,
  port: hw.websocket_port,
  path: hw.websocket_path,
  autoConnect: false,
  devices: [],
  onboarded: false,
  backend: 'auto', // auto | webgpu | webgl | cpu
  useWorker: true,
  history: true, // lưu lịch sử hội thoại
};

export const PROFILE_DEFAULTS = {
  joystick: {
    deadzone: hw.hardware_sensors.joystick_4_axis.deadzone,
    cursorSpeed: hw.hardware_sensors.joystick_4_axis.cursor_speed,
    invertX: false,
    invertY: false,
    cursorEnabled: true,
  },
  pressure: {
    puff: hw.hardware_sensors.pressure_sensor_MPXV7002DP.puff_left_click_kpa,
    sip: hw.hardware_sensors.pressure_sensor_MPXV7002DP.sip_right_click_kpa,
    doubleMs: hw.hardware_sensors.pressure_sensor_MPXV7002DP.double_puff_window_ms,
    holdMs: hw.hardware_sensors.pressure_sensor_MPXV7002DP.hold_drag_duration_ms,
  },
  speech: { lang: 'vi-VN', rate: 0.95 },
  recognition: { mode: 'auto', unit: 'letters' }, // unit: letters | words
  playbackSpeed: systemConfig.text_voice_to_3d_hand.hand_3d_renderer.default_speed,
  hand: { skin: 0, side: 'right', style: 'toon' },
  scan: { enabled: false, mode: 'auto', intervalMs: 1600 }, // chế độ quét cho người chỉ thao tác được 1–2 nút
};
export const DEFAULT_SETTINGS = { ...GLOBAL_DEFAULTS, ...PROFILE_DEFAULTS };

const GROUPS = Object.keys(PROFILE_DEFAULTS).filter((k) => typeof PROFILE_DEFAULTS[k] === 'object');
export function mergeSettings(global = {}, prof = {}) {
  const out = { ...GLOBAL_DEFAULTS, ...global, ...PROFILE_DEFAULTS };
  for (const k of Object.keys(PROFILE_DEFAULTS)) {
    out[k] = GROUPS.includes(k) ? { ...PROFILE_DEFAULTS[k], ...(prof[k] || {}) } : prof[k] ?? PROFILE_DEFAULTS[k];
  }
  return out;
}

const systemTheme = () => (typeof window !== 'undefined' && window.matchMedia?.('(prefers-contrast: more)').matches ? 'hc' : typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
export const resolveTheme = (t) => (t === 'system' ? systemTheme() : t);
export const defaultLang = () => (typeof navigator !== 'undefined' && /^vi/i.test(navigator.language || '') ? 'vi' : typeof navigator === 'undefined' ? 'vi' : 'en');

const Ctx = createContext(null);

export function SettingsProvider({ children }) {
  const [, force] = useReducer((x) => x + 1, 0);
  ensureProfiles();
  useEffect(() => store.subscribe(() => force()), []);

  const prof = getState();
  const g = store.read(GLOBAL_KEY, {});
  const p = store.read(pkey('settings'), {});
  const settings = useMemo(() => {
    const s = mergeSettings(g, p);
    s.lang = g.lang || defaultLang();
    return s;
  }, [g, p, prof.active]);

  const patch = useCallback((group, values) => {
    if (group) {
      store.update(pkey('settings'), {}, (cur) => ({ ...cur, [group]: { ...(cur[group] || {}), ...values } }));
      return;
    }
    const gv = {};
    const pv = {};
    for (const [k, v] of Object.entries(values)) (GLOBAL_KEYS.includes(k) ? gv : pv)[k] = v;
    if (Object.keys(gv).length) store.update(GLOBAL_KEY, {}, (cur) => ({ ...cur, ...gv }));
    if (Object.keys(pv).length) store.update(pkey('settings'), {}, (cur) => ({ ...cur, ...pv }));
  }, []);

  const reset = useCallback(() => {
    store.remove(pkey('settings'));
  }, []);

  // Áp dụng giao diện: chủ đề, cỡ chữ, chuyển động, ngôn ngữ
  useEffect(() => {
    const el = document.documentElement;
    const apply = () => {
      const theme = resolveTheme(settings.theme);
      el.dataset.theme = theme;
      el.dataset.fs = settings.fs;
      el.dataset.motion = settings.motion === 'full' ? 'full' : settings.motion;
      el.lang = settings.lang;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', theme === 'light' ? '#F3F5FC' : theme === 'dark' ? '#0B0E1C' : '#000000');
    };
    apply();
    if (settings.theme !== 'system') return undefined;
    const mqs = [window.matchMedia('(prefers-color-scheme: dark)'), window.matchMedia('(prefers-contrast: more)')];
    mqs.forEach((m) => m.addEventListener?.('change', apply));
    return () => mqs.forEach((m) => m.removeEventListener?.('change', apply));
  }, [settings.theme, settings.fs, settings.motion, settings.lang]);

  const profiles = useMemo(() => ({
    list: prof.list,
    active: prof.list.find((x) => x.id === prof.active) || prof.list[0],
    // Đổi hồ sơ = nạp lại trang để mô hình AI và mẫu của hồ sơ mới được nạp sạch
    add: (name, color) => { const p = addProfile(name, color); setTimeout(() => window.location.reload(), 60); return p; },
    rename: renameProfile,
    remove: (id) => { const wasActive = id === prof.active; const ok = removeProfile(id); if (ok && wasActive) setTimeout(() => window.location.reload(), 60); return ok; },
    switchTo: (id) => { if (id === prof.active) return; switchProfile(id); store.invalidate(); setTimeout(() => window.location.reload(), 60); },
  }), [prof]);

  const value = useMemo(() => ({ settings, patch, reset, profiles }), [settings, patch, reset, profiles]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSettings = () => useContext(Ctx);
export const useProfiles = () => useContext(Ctx).profiles;
export { PROFILES_KEY };
