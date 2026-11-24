// Nhận diện TỪ / CỤM TỪ bằng DTW (Dynamic Time Warping) trên chuỗi đặc trưng của một hoặc hai bàn tay.
// Không cần huấn luyện: chỉ cần 3–10 mẫu do chính người dùng ghi cho mỗi từ. Dữ liệu ký hiệu tiếng Việt (VSL) có sẵn KHÔNG được đóng gói.
export const N_FRAMES = 32; // mỗi mẫu được co giãn về 32 khung để so sánh nhanh
const SLOT = 45; // 21×2 hình dạng (x,y so với cổ tay) + vị trí cổ tay (x,y) + cờ có tay
export const DIM = SLOT * 2;

/** Đặc trưng một khung hình: tối đa 2 bàn tay (đã sắp trái→phải theo vị trí cổ tay). hands = [[21 điểm]…] toạ độ chuẩn hoá 0..1. */
export function frameFeature(hands, W = 640, H = 480) {
  const out = new Float32Array(DIM);
  const list = [...(hands || [])].sort((a, b) => a[0].x - b[0].x).slice(0, 2);
  // Nếu chỉ có 1 tay: đặt vào ô theo vị trí (nửa trái/phải ảnh) để từ một tay luôn rơi vào cùng một ô
  list.forEach((lm, i) => {
    const slot = list.length === 1 ? (lm[0].x < 0.5 ? 0 : 1) : i;
    const o = slot * SLOT;
    const w = lm[0];
    const scale = Math.hypot((lm[9].x - w.x) * W, (lm[9].y - w.y) * H) || 1;
    for (let k = 0; k < 21; k++) {
      out[o + k * 2] = ((lm[k].x - w.x) * W) / scale;
      out[o + k * 2 + 1] = ((lm[k].y - w.y) * H) / scale;
    }
    out[o + 42] = (w.x - 0.5) * 8; // vị trí tuyệt đối của cổ tay quan trọng với nhiều ký hiệu (chạm trán, ngực…)
    out[o + 43] = (w.y - 0.5) * 8;
    out[o + 44] = 1;
  });
  return out;
}

/** Co giãn chuỗi (n×DIM) về N_FRAMES khung bằng nội suy tuyến tính. */
export function resample(frames, n = N_FRAMES) {
  const T = frames.length;
  const out = new Float32Array(n * DIM);
  if (!T) return out;
  for (let i = 0; i < n; i++) {
    const p = (i * (T - 1)) / (n - 1);
    const a = Math.floor(p);
    const b = Math.min(T - 1, a + 1);
    const f = p - a;
    const fa = frames[a];
    const fb = frames[b];
    for (let d = 0; d < DIM; d++) out[i * DIM + d] = fa[d] * (1 - f) + fb[d] * f;
  }
  return out;
}

const dist = (a, ia, b, ib) => {
  let s = 0;
  for (let d = 0; d < DIM; d++) {
    const x = a[ia * DIM + d] - b[ib * DIM + d];
    s += x * x;
  }
  return Math.sqrt(s);
};

/** DTW với dải Sakoe–Chiba (band khung hình). Trả về khoảng cách trung bình theo độ dài đường đi. */
export function dtw(a, b, band = 8, n = N_FRAMES) {
  const INF = 1e9;
  let prev = new Float32Array(n + 1).fill(INF);
  let cur = new Float32Array(n + 1).fill(INF);
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    cur.fill(INF);
    const lo = Math.max(1, i - band);
    const hi = Math.min(n, i + band);
    for (let j = lo; j <= hi; j++) {
      const c = dist(a, i - 1, b, j - 1);
      cur[j] = c + Math.min(prev[j], prev[j - 1], cur[j - 1]);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n] / (2 * n);
}

/** Mẫu của một từ: danh sách chuỗi đã resample. Ngưỡng riêng theo độ phân tán giữa các mẫu. */
export class WordMatcher {
  constructor() {
    this.words = new Map(); // key -> { display, samples: Float32Array[], thr }
  }

  static fromStore(data) {
    const m = new WordMatcher();
    for (const [key, w] of Object.entries(data || {})) m.set(key, w.display || key, (w.samples || []).map((s) => Float32Array.from(s)));
    return m;
  }

  set(key, display, samples) {
    this.words.set(key, { display, samples, thr: WordMatcher.threshold(samples) });
  }

  /** Ngưỡng chấp nhận = 1,6 × khoảng cách lớn nhất giữa các mẫu cùng từ (tối thiểu 0,55; chỉ 1–2 mẫu thì dùng mặc định rộng hơn). */
  static threshold(samples) {
    if (samples.length < 3) return 1.1;
    let mx = 0;
    for (let i = 0; i < samples.length; i++) for (let j = i + 1; j < samples.length; j++) mx = Math.max(mx, dtw(samples[i], samples[j]));
    return Math.max(0.55, mx * 1.6);
  }

  get size() {
    return this.words.size;
  }

  /** @returns {{key,display,dist,conf}[]} xếp theo khoảng cách tăng dần */
  rank(seq) {
    const out = [];
    for (const [key, w] of this.words) {
      if (!w.samples.length) continue;
      let best = Infinity;
      for (const s of w.samples) best = Math.min(best, dtw(seq, s));
      out.push({ key, display: w.display, dist: best, conf: Math.max(0, Math.min(1, 1 - best / (w.thr * 1.25))) , thr: w.thr });
    }
    return out.sort((a, b) => a.dist - b.dist);
  }

  /** Kết quả tốt nhất nếu đạt ngưỡng và hơn từ thứ hai rõ rệt. */
  match(seq) {
    const r = this.rank(seq);
    if (!r.length) return null;
    const [a, b] = r;
    if (a.dist > a.thr) return null;
    if (b && b.dist < a.dist * 1.12 && b.dist <= b.thr) return { ...a, ambiguous: true, alt: b.display };
    return a;
  }
}

/**
 * Cắt chuỗi khung hình thành "một ký hiệu": bắt đầu khi tay xuất hiện và chuyển động; kết thúc khi tay rời khỏi khung
 * hoặc đứng yên đủ lâu. Trả về chuỗi khung hình (mảng Float32Array DIM) khi một ký hiệu hoàn tất.
 */
export class WordSegmenter {
  constructor({ minFrames = 10, maxFrames = 150, endMissing = 8, endStill = 14, moveThr = 0.05, startThr = 0.08, lag = 4 } = {}) {
    Object.assign(this, { minFrames, maxFrames, endMissing, endStill, moveThr, startThr, lag });
    this.reset();
  }
  reset() {
    this.frames = [];
    this.active = false;
    this.missing = 0;
    this.still = 0;
    this.prev = null;
    this.win = [];
  }
  /** @returns {{state:'idle'|'collecting', done:Float32Array[]|null, n:number}} */
  push(feat, present) {
    if (!present) {
      this.missing++;
      if (this.active && this.missing >= this.endMissing) return this._finish();
      return { state: this.active ? 'collecting' : 'idle', done: null, n: this.frames.length };
    }
    this.missing = 0;
    // chuyển động = độ lệch RMS so với khung hình cách đây `lag` khung (giảm ảnh hưởng của nhiễu từng khung)
    this.win.push(feat);
    if (this.win.length > this.lag + 1) this.win.shift();
    let motion = 0;
    if (this.win.length > this.lag) {
      const ref = this.win[0];
      for (let d = 0; d < DIM; d++) {
        const x = feat[d] - ref[d];
        motion += x * x;
      }
      motion = Math.sqrt(motion / DIM);
    }
    if (!this.active) {
      if (motion > this.startThr) {
        this.active = true;
        this.frames = [feat];
        this.still = 0;
      }
      return { state: this.active ? 'collecting' : 'idle', done: null, n: this.frames.length };
    }
    this.frames.push(feat);
    this.still = motion < this.moveThr ? this.still + 1 : 0;
    if (this.frames.length >= this.maxFrames || this.still >= this.endStill) return this._finish();
    return { state: 'collecting', done: null, n: this.frames.length };
  }
  _finish() {
    // bỏ phần đuôi đứng yên
    let frames = this.frames;
    if (this.still > 0) frames = frames.slice(0, Math.max(this.minFrames, frames.length - this.still + 3));
    const ok = frames.length >= this.minFrames;
    const done = ok ? frames : null;
    this.frames = [];
    this.active = false;
    this.still = 0;
    this.win = [];
    return { state: 'idle', done, n: 0 };
  }
}

/** Cắt bỏ phần đầu/đuôi đứng yên của một chuỗi khung hình đã ghi (giữ lại ít nhất `min` khung). */
export function trimStill(frames, { thr = 0.05, lag = 3, min = 10, pad = 2 } = {}) {
  const n = frames.length;
  if (n <= min + 2 * lag) return frames;
  const mot = (i) => {
    let s = 0;
    for (let d = 0; d < DIM; d++) {
      const x = frames[i][d] - frames[Math.max(0, i - lag)][d];
      s += x * x;
    }
    return Math.sqrt(s / DIM);
  };
  let a = 0;
  while (a < n - 1 && mot(a) <= thr) a++;
  let b = n - 1;
  while (b > a && mot(b) <= thr) b--;
  a = Math.max(0, a - lag - pad);
  b = Math.min(n - 1, b + pad);
  return b - a + 1 >= min ? frames.slice(a, b + 1) : frames;
}
