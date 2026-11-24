// Hồ sơ nhiều người dùng. Mỗi hồ sơ có cài đặt riêng, mẫu ký hiệu riêng, tiến độ học, lịch sử…
// Khoá lưu: signbridge.p.<id>.<tên>. Hồ sơ đầu tiên có id "default" để giữ tương thích với dữ liệu bản 1.
import { store } from './store.js';

export const GLOBAL_KEY = 'signbridge.global.v2';
export const PROFILES_KEY = 'signbridge.profiles.v2';
export const COLORS = ['#3A3FCF', '#0A6872', '#A01A30', '#7A4600', '#12663E', '#7A2E9B'];
const LEGACY = { settings: 'signbridge.settings.v1', samples: 'signbridge.samples.v1', learn: 'signbridge.learn.v1', wordfreq: 'signbridge.wordfreq' };

export const newId = () => 'u' + Math.random().toString(36).slice(2, 8);

export function ensureProfiles(defaultName = 'Tôi') {
  const cur = store.read(PROFILES_KEY, null);
  if (cur && cur.list?.length) return cur;
  const first = { id: 'default', name: defaultName, color: COLORS[0], createdAt: Date.now() };
  const state = { list: [first], active: 'default' };
  // Chuyển dữ liệu bản 1 sang hồ sơ đầu tiên
  const old = store.read(LEGACY.settings, null);
  if (old) {
    const { ip, port, path, autoConnect, ...rest } = old;
    store.write(pkey('settings', 'default'), rest);
    store.write('signbridge.global.v2', { ip, port, path, autoConnect });
  }
  for (const k of ['samples', 'learn', 'wordfreq']) {
    const v = store.read(LEGACY[k], null);
    if (v) store.write(pkey(k, 'default'), v);
  }
  store.write(PROFILES_KEY, state);
  return state;
}

export const getState = () => store.read(PROFILES_KEY, null) || ensureProfiles();
export const activeId = () => getState().active;
export const pkey = (name, id = null) => `signbridge.p.${id || activeId()}.${name}`;

export function addProfile(name, color) {
  const s = getState();
  const p = { id: newId(), name: name.trim() || 'Người dùng', color: color || COLORS[s.list.length % COLORS.length], createdAt: Date.now() };
  store.write(PROFILES_KEY, { ...s, list: [...s.list, p], active: p.id });
  return p;
}
export function renameProfile(id, name, color) {
  const s = getState();
  store.write(PROFILES_KEY, { ...s, list: s.list.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name, color: color || p.color } : p)) });
}
export function switchProfile(id) {
  const s = getState();
  if (s.list.some((p) => p.id === id)) store.write(PROFILES_KEY, { ...s, active: id });
}
export const PROFILE_FIELDS = ['settings', 'samples', 'learn', 'wordfreq', 'learn2', 'quickPhrases', 'assignments', 'reports', 'predict'];
export function removeProfile(id) {
  const s = getState();
  if (s.list.length <= 1) return false;
  const list = s.list.filter((p) => p.id !== id);
  for (const f of PROFILE_FIELDS) store.remove(pkey(f, id));
  store.write(PROFILES_KEY, { list, active: s.active === id ? list[0].id : s.active });
  return true;
}

/** Khoá IndexedDB của mô hình TF.js đã tinh chỉnh theo từng hồ sơ. */
export const modelKey = (kind, id = null) => {
  const base = `indexeddb://signbridge-${kind}`;
  const pid = id || activeId();
  return pid === 'default' ? base : `${base}-${pid}`;
};
