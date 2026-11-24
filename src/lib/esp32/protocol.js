// Giao thức WebSocket giữa ESP32-S3 và Web (xem README – mục "Giao thức ESP32").
// Mỗi 20 ms ESP32 gửi một gói JSON, ví dụ:
//   {"x":-0.35,"y":0.80,"kpa":0.12,"event":null}
//   {"x":0,"y":0,"kpa":0.61,"event":"PUFF_CLICK"}
// Trình phân tích bên dưới chấp nhận nhiều cách đặt tên khoá để dễ khớp với firmware.
import { systemConfig } from '../../config/systemConfig.js';

const cfg = systemConfig.esp32_ip_connection;

/** Chấp nhận "192.168.1.100", "192.168.1.100:81", "ws://192.168.1.100:81/ws"… -> URL đầy đủ. */
export function normalizeWsUrl(input, { port = cfg.websocket_port, path = cfg.websocket_path } = {}) {
  let s = String(input || '').trim();
  if (!s) s = cfg.default_ip;
  const m = s.match(/^(wss?:\/\/)?([^/:\s]+)(?::(\d+))?(\/\S*)?$/i);
  if (!m) return null;
  const scheme = (m[1] || 'ws://').toLowerCase();
  return `${scheme}${m[2]}:${m[3] || port}${m[4] && m[4] !== '/' ? m[4] : path}`;
}

export function hostOf(url) {
  const m = String(url).match(/^wss?:\/\/([^/:]+)/i);
  return m ? m[1] : cfg.default_ip;
}

const EVENT_MAP = {
  LEFT_CLICK: 'LEFT_CLICK', PUFF_CLICK: 'LEFT_CLICK', CLICK: 'LEFT_CLICK', PUFF: 'LEFT_CLICK',
  DOUBLE_CLICK: 'DOUBLE_CLICK', DOUBLE_PUFF: 'DOUBLE_CLICK', PUFF_DOUBLE_CLICK: 'DOUBLE_CLICK',
  RIGHT_CLICK: 'RIGHT_CLICK', SIP_RIGHT_CLICK: 'RIGHT_CLICK', SIP_CLICK: 'RIGHT_CLICK', SIP: 'RIGHT_CLICK',
  DRAG_START: 'DRAG_START', HOLD_DRAG: 'HOLD_DRAG', DRAG: 'HOLD_DRAG',
  DRAG_END: 'DRAG_END', DRAG_STOP: 'DRAG_END', RELEASE: 'DRAG_END',
};

const num = (v) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
// Nếu firmware gửi giá trị ADC thô 0..4095 thì chuẩn hoá về -1..1
const axis = (v) => {
  const n = num(v);
  if (n === null) return null;
  return Math.abs(n) > 1.5 ? Math.max(-1, Math.min(1, (n - 2048) / 2048)) : Math.max(-1, Math.min(1, n));
};

/** @returns {{x:number|null,y:number|null,kpa:number|null,event:string|null,hasEventField:boolean,raw:object}|null} */
export function parseTelemetry(data) {
  let o;
  try {
    o = typeof data === 'string' ? JSON.parse(data) : data;
  } catch {
    return null;
  }
  if (!o || typeof o !== 'object') return null;
  const j = o.joystick || o.joy || o;
  const evKey = ['event', 'evt', 'cmd', 'command', 'action'].find((k) => k in o);
  const rawEv = evKey ? o[evKey] : null;
  const event = rawEv ? EVENT_MAP[String(rawEv).toUpperCase()] || null : null;
  return {
    x: axis(j.x ?? j.X ?? o.jx),
    y: axis(j.y ?? j.Y ?? o.jy),
    kpa: num(o.kpa ?? o.p ?? o.pressure ?? o.press),
    event,
    hasEventField: !!evKey,
    raw: o,
  };
}
