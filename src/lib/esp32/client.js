// Máy khách WebSocket tới ESP32-S3: tự kết nối lại, đo tốc độ gói tin, gửi cấu hình qua WS hoặc HTTP.
import { systemConfig } from '../../config/systemConfig.js';
import { parseTelemetry, hostOf } from './protocol.js';

const cfg = systemConfig.esp32_ip_connection;

export class Esp32Client {
  constructor() {
    this.ws = null;
    this.url = null;
    this.state = 'disconnected'; // disconnected | connecting | connected
    this.want = false;
    this.stale = false;
    this.rate = 0;
    this.lastMsgAt = 0;
    this.error = null;
    this.reconnectIn = 0;
    this.listeners = {};
    this._count = 0;
    this._timer = null;
    this._tick = null;
  }

  on(evt, fn) {
    (this.listeners[evt] ||= new Set()).add(fn);
    return () => this.listeners[evt].delete(fn);
  }
  _emit(evt, payload) {
    this.listeners[evt]?.forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.error(e);
      }
    });
  }
  _setState(state, error = null) {
    this.state = state;
    this.error = error;
    this._emit('state', this.snapshot());
  }
  snapshot() {
    return { state: this.state, url: this.url, error: this.error, stale: this.stale, rate: this.rate, reconnectIn: this.reconnectIn };
  }

  connect(url) {
    this.url = url;
    this.want = true;
    this._open();
    if (!this._tick) this._tick = setInterval(() => this._watch(), 500);
  }

  disconnect() {
    this.want = false;
    clearTimeout(this._timer);
    this.reconnectIn = 0;
    if (this.ws) {
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {
        /* bỏ qua */
      }
      this.ws = null;
    }
    clearInterval(this._tick);
    this._tick = null;
    this.stale = false;
    this._setState('disconnected');
  }

  _open() {
    clearTimeout(this._timer);
    if (this.ws) {
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {
        /* bỏ qua */
      }
    }
    this._setState('connecting');
    let ws;
    try {
      ws = new WebSocket(this.url);
    } catch (e) {
      this._setState('disconnected', e.message);
      this._scheduleReconnect();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this._count = 0;
      this.lastMsgAt = performance.now();
      this._setState('connected');
      this._emit('open', null);
    };
    ws.onmessage = (ev) => {
      this._count++;
      this.lastMsgAt = performance.now();
      if (this.stale) {
        this.stale = false;
        this._emit('state', this.snapshot());
      }
      const t = parseTelemetry(ev.data);
      if (t) this._emit('telemetry', t);
    };
    ws.onerror = () => {
      this.error = 'Không kết nối được tới thiết bị';
    };
    ws.onclose = () => {
      this.ws = null;
      this._setState('disconnected', this.error);
      this._scheduleReconnect();
    };
  }

  _scheduleReconnect() {
    if (!this.want) return;
    this.reconnectIn = cfg.auto_reconnect_ms;
    this._emit('state', this.snapshot());
    this._timer = setTimeout(() => {
      this.reconnectIn = 0;
      if (this.want) this._open();
    }, cfg.auto_reconnect_ms);
  }

  _watch() {
    const now = performance.now();
    this.rate = Math.round((this._count * 1000) / 500);
    this._count = 0;
    const stale = this.state === 'connected' && now - this.lastMsgAt > 1500;
    if (stale !== this.stale || this.state === 'connected') {
      this.stale = stale;
      this._emit('state', this.snapshot());
    }
  }

  /** Gửi cấu hình xuống ESP32: ưu tiên WebSocket, dự phòng HTTP POST tới cổng cấu hình. */
  async sendConfig(config) {
    const payload = { type: 'config', ...config };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
      return { via: 'ws', ok: true };
    }
    if (!this.url) return { via: 'none', ok: false };
    try {
      const res = await fetch(`http://${hostOf(this.url)}:${cfg.http_config_port}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(2500),
      });
      return { via: 'http', ok: res.ok };
    } catch {
      return { via: 'http', ok: false };
    }
  }
}
