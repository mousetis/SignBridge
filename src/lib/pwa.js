// Đăng ký service worker (chỉ bản build). Khi có phiên bản mới → phát sự kiện để hiện thanh "Tải lại".
export function registerSW() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      const announce = () => { if (reg.waiting && navigator.serviceWorker.controller) window.dispatchEvent(new CustomEvent('sb-sw-update', { detail: reg })); };
      announce();
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => { if (w.state === 'installed') announce(); });
      });
    }).catch(() => {});
    // Chỉ tải lại khi một phiên bản MỚI thay thế phiên bản cũ (người dùng bấm “Tải lại”), không tải lại ở lần cài đặt đầu tiên.
    let reloaded = false;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; window.location.reload(); } });
  });
}
