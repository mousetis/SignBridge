// Dò mạch ESP32-S3 trong mạng nội bộ. Trình duyệt không hỗ trợ mDNS/ping nên ta thử mở WebSocket tới:
//   (1) thiết bị đã lưu, (2) tên máy thường gặp (esp32.local… – hệ điều hành tự phân giải mDNS),
//   (3) địa chỉ AP mặc định 192.168.4.1, (4) cả dải /24 của địa chỉ gợi ý (và 192.168.1.x, 192.168.0.x).
import { parseTelemetry } from './protocol.js';

export const COMMON_NAMES = ['esp32.local', 'esp32s3.local', 'esp32-s3.local', 'signbridge.local'];
const isIp = (s) => /^(\d{1,3}\.){3}\d{1,3}$/.test(s);
export const prefixOf = (ip) => (isIp(ip) ? ip.split('.').slice(0, 3).join('.') : null);

export function candidateHosts({ hint = '', saved = [], pageHost = '', extraPrefixes = ['192.168.1', '192.168.0'] } = {}) {
  const out = [];
  const add = (h) => h && !out.includes(h) && out.push(h);
  saved.forEach(add);
  COMMON_NAMES.forEach(add);
  add('192.168.4.1');
  const prefixes = [];
  for (const p of [prefixOf(hint), prefixOf(pageHost), ...extraPrefixes]) if (p && !prefixes.includes(p)) prefixes.push(p);
  for (const p of prefixes) for (let i = 1; i <= 254; i++) add(`${p}.${i}`);
  return out;
}

export function probe(host, { port = 81, path = '/ws', timeoutMs = 1000, WS = globalThis.WebSocket } = {}) {
  return new Promise((resolve) => {
    let ws;
    const t0 = Date.now();
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws?.close(); } catch { /* bỏ qua */ }
      resolve(v);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    try {
      ws = new WS(`ws://${host}:${port}${path}`);
    } catch {
      finish(null);
      return;
    }
    let opened = false;
    ws.onopen = () => {
      opened = true;
      clearTimeout(timer);
      setTimeout(() => finish({ host, port, path, telemetry: false, ms: Date.now() - t0 }), 700); // không thấy gói tin -> vẫn báo là máy chủ WebSocket
    };
    ws.onmessage = (ev) => {
      const t = parseTelemetry(ev.data);
      if (t && (t.x !== null || t.kpa !== null)) finish({ host, port, path, telemetry: true, ms: Date.now() - t0 });
    };
    ws.onerror = () => { if (!opened) finish(null); };
    ws.onclose = () => { if (!opened) finish(null); };
  });
}

/** Quét song song có giới hạn. Trả về danh sách thiết bị tìm thấy (ưu tiên thiết bị có gói telemetry). */
export async function scan({ hosts, port = 81, path = '/ws', timeoutMs = 1000, concurrency = 24, onFound, onProgress, signal, WS } = {}) {
  const found = [];
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < hosts.length && !signal?.aborted) {
      const h = hosts[next++];
      const r = await probe(h, { port, path, timeoutMs, WS });
      done++;
      onProgress?.(done, hosts.length, h);
      if (r) {
        found.push(r);
        onFound?.(r);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, hosts.length) }, worker));
  return found.sort((a, b) => Number(b.telemetry) - Number(a.telemetry) || a.ms - b.ms);
}
