// Camera (getUserMedia) CHỈ hoạt động ở "ngữ cảnh an toàn": http://localhost hoặc https.
// Nếu người dùng mở bằng địa chỉ mạng (vd. http://192.168.1.5:5173) thì trình duyệt ẩn camera.
// Hàm này tự chuyển sang http://localhost:<cổng> khi máy đang mở trang cũng chính là máy chạy server.

export const isLocalhost = () => ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

export const localhostUrl = () => `http://localhost:${location.port || 80}${location.pathname}${location.search}${location.hash}`;

export async function redirectToLocalhostIfNeeded() {
  if (window.isSecureContext || location.protocol === 'file:') return false;
  if (!/^(\d+\.){3}\d+$/.test(location.hostname) && !location.hostname.endsWith('.local')) return false;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1500);
    await fetch(`http://localhost:${location.port || 80}/`, { mode: 'no-cors', signal: ctl.signal });
    clearTimeout(t);
    location.replace(localhostUrl());
    return true;
  } catch {
    return false; // đang xem từ thiết bị khác: giữ nguyên, trang sẽ giải thích
  }
}
