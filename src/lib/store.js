// Kho lưu trữ nhỏ bọc localStorage: có bộ nhớ đệm, phát tín hiệu khi đổi (dùng với useSyncExternalStore),
// an toàn khi chạy trong Node (kiểm thử) và khi localStorage bị chặn / đầy.
const mem = new Map(); // dự phòng khi không có localStorage
const cache = new Map();
const subs = new Set();
let ls = null;
try {
  ls = typeof localStorage !== 'undefined' ? localStorage : null;
} catch {
  ls = null;
}

export const store = {
  lastError: null,
  read(key, def) {
    if (cache.has(key)) return cache.get(key);
    let v = def;
    try {
      const raw = ls ? ls.getItem(key) : mem.get(key);
      if (raw != null) v = JSON.parse(raw);
    } catch {
      /* hỏng dữ liệu -> dùng mặc định */
    }
    cache.set(key, v);
    return v;
  },
  write(key, val) {
    cache.set(key, val);
    try {
      const raw = JSON.stringify(val);
      if (ls) ls.setItem(key, raw);
      else mem.set(key, raw);
      store.lastError = null;
    } catch (e) {
      store.lastError = e; // vượt dung lượng
    }
    subs.forEach((f) => f(key));
    return !store.lastError;
  },
  update(key, def, fn) {
    return store.write(key, fn(store.read(key, def)));
  },
  remove(key) {
    cache.delete(key);
    try {
      if (ls) ls.removeItem(key);
      else mem.delete(key);
    } catch {
      /* bỏ qua */
    }
    subs.forEach((f) => f(key));
  },
  keys(prefix = '') {
    const out = [];
    try {
      if (ls) for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && k.startsWith(prefix)) out.push(k); }
      else for (const k of mem.keys()) if (k.startsWith(prefix)) out.push(k);
    } catch {
      /* bỏ qua */
    }
    return out;
  },
  /** Xoá bộ nhớ đệm (dùng khi nhập dữ liệu hoặc đổi hồ sơ). */
  invalidate() {
    cache.clear();
    subs.forEach((f) => f('*'));
  },
  subscribe(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  },
  usage() {
    let n = 0;
    try {
      if (ls) for (let i = 0; i < ls.length; i++) { const k = ls.key(i); n += k.length + (ls.getItem(k) || '').length; }
    } catch {
      /* bỏ qua */
    }
    return n * 2; // UTF-16
  },
};

if (typeof window !== 'undefined') window.addEventListener('storage', () => store.invalidate());
