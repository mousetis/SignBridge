// Xuất / nhập toàn bộ dữ liệu của hồ sơ đang dùng (cài đặt, mẫu ký hiệu, tiến độ học, từ đã ghi, lịch sử hội thoại) ra một tệp JSON.
import { store } from './store.js';
import { idb } from './idb.js';
import { activeId, getState, pkey } from './profiles.js';

const LS_FIELDS = ['settings', 'samples', 'learn2', 'wordfreq', 'quickPhrases', 'assignments', 'reports', 'predict'];
const IDB_FIELDS = ['words', 'history'];

export async function exportProfile() {
  const id = activeId();
  const prof = getState().list.find((p) => p.id === id);
  const data = { ls: {}, idb: {} };
  for (const f of LS_FIELDS) {
    const v = store.read(pkey(f), undefined);
    if (v !== undefined) data.ls[f] = v;
  }
  for (const f of IDB_FIELDS) {
    const v = await idb.get(`p.${id}.${f}`);
    if (v !== undefined) data.idb[f] = v;
  }
  return { version: 1, kind: 'signbridge-profile', at: Date.now(), profile: { name: prof?.name, color: prof?.color }, data };
}

export const validBackup = (o) => !!(o && o.kind === 'signbridge-profile' && o.data && typeof o.data === 'object');

/** Nhập vào hồ sơ ĐANG DÙNG (ghi đè các phần có trong tệp). Cần tải lại trang sau khi nhập. */
export async function importProfile(o) {
  if (!validBackup(o)) throw new Error('bad-format');
  const id = activeId();
  let n = 0;
  for (const [f, v] of Object.entries(o.data.ls || {})) if (LS_FIELDS.includes(f)) { store.write(pkey(f), v); n++; }
  for (const [f, v] of Object.entries(o.data.idb || {})) if (IDB_FIELDS.includes(f)) { await idb.set(`p.${id}.${f}`, v); n++; }
  return n;
}

export function downloadJson(obj, name) {
  const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
  downloadBlob(blob, name);
}
export function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
export function pickJson() {
  return new Promise((resolve, reject) => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = '.json,application/json';
    i.onchange = async () => {
      try {
        resolve(JSON.parse(await i.files[0].text()));
      } catch (e) {
        reject(e);
      }
    };
    i.click();
  });
}
