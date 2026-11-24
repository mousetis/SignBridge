// Máy khách của Web Worker suy luận. Kết quả được "ống dẫn" (pipelined): mỗi khung hình gửi đi một yêu cầu
// (nếu worker đang rảnh) và dùng kết quả gần nhất đã nhận về (trễ 1–2 khung hình), nên luồng giao diện không bao giờ phải chờ.
export class InferenceClient {
  constructor() {
    this.worker = null;
    this.seq = 0;
    this.pending = new Map();
    this.busyStatic = false;
    this.busyDynamic = false;
    this.lastStatic = null;
    this.lastDynamic = null; // { key, probs }
    this.info = { mode: 'worker', backend: null, bench: {}, list: [] };
    this.lastMs = 0;
  }

  static supported() {
    return typeof Worker !== 'undefined' && typeof window !== 'undefined';
  }

  _call(type, payload) {
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      this.pending.set(id, { resolve, reject, type });
      this.worker.postMessage({ id, type, payload });
    });
  }

  _onMsg(e) {
    const { id, type, result, error, ms } = e.data;
    const p = this.pending.get(id);
    if (!p) return;
    this.pending.delete(id);
    if (type === 'static') this.busyStatic = false;
    if (type === 'dynamic') this.busyDynamic = false;
    if (ms) this.lastMs = ms;
    if (error) p.reject(new Error(error));
    else p.resolve(result);
  }

  async init({ profileId = 'default', backend = 'auto', hint = '' } = {}) {
    if (!this.worker) {
      this.worker = new Worker(new URL('./inference.worker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => this._onMsg(e);
      this.worker.onerror = (e) => {
        for (const p of this.pending.values()) p.reject(new Error(e.message || 'Worker lỗi'));
        this.pending.clear();
      };
    }
    this.lastStatic = null;
    this.lastDynamic = null;
    const r = await this._call('init', { profileId, backend, hint });
    this.info = { mode: 'worker', ...r };
    return this.info;
  }

  /** Trả kết quả gần nhất (có thể null ở khung đầu) và gửi yêu cầu mới nếu worker rảnh. */
  predictStatic(feat) {
    if (!this.busyStatic) {
      this.busyStatic = true;
      this._call('static', { feat: Float32Array.from(feat) }).then((r) => { this.lastStatic = r; }).catch(() => {});
    }
    return this.lastStatic;
  }

  predictDynamic(seq, key) {
    if (!this.busyDynamic) {
      this.busyDynamic = true;
      this._call('dynamic', { seq: Float32Array.from(seq) }).then((r) => { if (r) this.lastDynamic = { key, probs: r }; }).catch(() => {});
    }
    return this.lastDynamic?.key === key ? this.lastDynamic.probs : null;
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}
