// Lịch sử hội thoại (IndexedDB, theo hồ sơ). Mỗi phiên = một cuộc hội thoại với danh sách tin nhắn.
import { idb } from './idb.js';
import { activeId } from './profiles.js';

const key = () => `p.${activeId()}.history`;
const MAX_SESSIONS = 100;
const MAX_MSG = 500;

export const newSession = (mode = 'sign') => ({ id: 's' + Date.now().toString(36), at: Date.now(), mode, messages: [] });

export async function listSessions() {
  return ((await idb.get(key())) || []).sort((a, b) => b.at - a.at);
}
export async function saveSession(s) {
  if (!s.messages.length) return;
  const all = ((await idb.get(key())) || []).filter((x) => x.id !== s.id);
  all.push({ ...s, messages: s.messages.slice(-MAX_MSG), updated: Date.now() });
  await idb.set(key(), all.sort((a, b) => b.at - a.at).slice(0, MAX_SESSIONS));
}
export async function deleteSession(id) {
  await idb.set(key(), ((await idb.get(key())) || []).filter((x) => x.id !== id));
}
export async function clearHistory() {
  await idb.set(key(), []);
}
export async function exportHistory() {
  return { version: 1, kind: 'signbridge-history', at: Date.now(), sessions: await listSessions() };
}
export async function importHistory(obj) {
  if (!obj || obj.kind !== 'signbridge-history' || !Array.isArray(obj.sessions)) throw new Error('bad-format');
  const cur = (await idb.get(key())) || [];
  const ids = new Set(cur.map((s) => s.id));
  const add = obj.sessions.filter((s) => s && s.id && Array.isArray(s.messages) && !ids.has(s.id));
  await idb.set(key(), [...cur, ...add].sort((a, b) => b.at - a.at).slice(0, MAX_SESSIONS));
  return add.length;
}
export function sessionToText(s, names = { me: 'Tôi', other: 'Người đối diện' }) {
  return s.messages.map((m) => `[${new Date(m.at).toLocaleTimeString()}] ${names[m.who] || m.who}: ${m.text}`).join('\n');
}
