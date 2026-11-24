// SignBridge service worker: tải trước khung ứng dụng (build điền danh sách), còn mô hình AI / MediaPipe / phông
// được lưu khi dùng lần đầu rồi chạy ngoại tuyến. Chiến lược: cache-first cho tài nguyên có mã băm, network-first cho trang.
const VERSION = '__VERSION__';
const PRECACHE = /*__PRECACHE__*/[];
const CORE = `sb-core-${VERSION}`;
const RUNTIME = 'sb-runtime-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CORE).then((c) => c.addAll(['/', ...PRECACHE]).catch(() => {})));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('sb-core-') && k !== CORE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ESP32 / ngoài: không can thiệp
  if (req.headers.has('range')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(CORE).then((c) => c.put('/', cp)); return r; }).catch(() => caches.match('/')));
    return;
  }
  const hashed = url.pathname.startsWith('/assets/');
  const heavy = /^\/(models|mediapipe|icons)\//.test(url.pathname);
  if (hashed || heavy) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r.ok) { const cp = r.clone(); caches.open(hashed ? CORE : RUNTIME).then((c) => c.put(req, cp)); }
      return r;
    })));
  }
});
