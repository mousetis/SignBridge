// Kho khoá-giá trị trên IndexedDB cho dữ liệu lớn (mẫu từ ký hiệu, lịch sử hội thoại).
// Nếu IndexedDB không có (Node / bị chặn) thì dùng Map trong bộ nhớ.
const DB = 'signbridge-kv';
const STORE = 'kv';
const mem = new Map();
let dbp = null;
const listeners = new Set();

function open() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (!dbp) {
    dbp = new Promise((resolve) => {
      try {
        const rq = indexedDB.open(DB, 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
        rq.onsuccess = () => resolve(rq.result);
        rq.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbp;
}
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const idb = {
  async get(key, def = undefined) {
    const db = await open();
    if (!db) return mem.has(key) ? mem.get(key) : def;
    try {
      const v = await req(db.transaction(STORE).objectStore(STORE).get(key));
      return v === undefined ? def : v;
    } catch {
      return def;
    }
  },
  async set(key, val) {
    const db = await open();
    if (!db) mem.set(key, val);
    else {
      try {
        await req(db.transaction(STORE, 'readwrite').objectStore(STORE).put(val, key));
      } catch {
        mem.set(key, val);
      }
    }
    listeners.forEach((f) => f(key));
  },
  async del(key) {
    const db = await open();
    mem.delete(key);
    if (db) {
      try {
        await req(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key));
      } catch {
        /* bỏ qua */
      }
    }
    listeners.forEach((f) => f(key));
  },
  async keys(prefix = '') {
    const db = await open();
    if (!db) return [...mem.keys()].filter((k) => k.startsWith(prefix));
    try {
      const all = await req(db.transaction(STORE).objectStore(STORE).getAllKeys());
      return all.filter((k) => String(k).startsWith(prefix));
    } catch {
      return [];
    }
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
