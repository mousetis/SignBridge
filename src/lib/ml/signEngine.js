// Động cơ nhận diện: nhận 21 landmark mỗi khung hình -> xác suất 34 ký tự tĩnh + phát hiện J/Z (LSTM) + điểm chấm.
import { tf, loadStatic, loadDynamic, KNN_URL, META_URL } from './models.js';
import { KnnIndex } from './knn.js';
import { STATIC_CLASSES, systemConfig, LETTERS, DIGITS } from '../../config/systemConfig.js';
import { toPixelSpace, normalizeLandmarks, fingerCurls, poseDescriptor, comparePose, palmScale } from './features.js';
import { SEQ_LEN, DYN_CLASSES } from './synthetic.js';
import { poseLandmarks } from '../hand/poseLibrary.js';
import { InferenceClient } from './inferenceClient.js';
import { chooseBackend } from './runtime.js';
import { store } from '../store.js';
import { activeId, pkey, GLOBAL_KEY } from '../profiles.js';

const USER_W = 0.75;
const DYN_BASE = { J: 'I', Z: 'D' };
const refCache = new WeakMap();
const REF_FULL = 0.85; // so khớp hình học ≥ 85% với mẫu thật = đủ điểm
const MODEL_FULL = 0.75; // xác suất mô hình ≥ 75% = đủ điểm
const EMA_ALPHA = 0.6; // phản ứng nhanh hơn một chút (v2); độ chắc chắn được kiểm bằng trung bình khi chốt chữ
const dynCfg = systemConfig.ai_sign_to_text_engine.recognition_models.dynamic_motion_classifier;
const STRIDE = 2; // lấy mẫu mỗi 2 khung hình => 20 mẫu trải ~1.3 giây ở 30 FPS (xem README)
const HISTORY = SEQ_LEN * STRIDE;

// Chữ số GIỐNG HỆT chữ cái (0=O, 2=V, 6=W, 9=F) -> chế độ "auto" ưu tiên chữ cái.
const AUTO_DROP = new Set(['0', '2', '6', '9']);
const MASKS = {
  letters: STATIC_CLASSES.map((c) => LETTERS.includes(c)),
  digits: STATIC_CLASSES.map((c) => DIGITS.includes(c)),
  auto: STATIC_CLASSES.map((c) => !AUTO_DROP.has(c)),
};

// Các cặp giống hệt (O/0, V/2, W/6, F/9): gộp khối lượng xác suất của hai lớp rồi để chế độ Chữ/Số quyết định.
const PAIR_IDX = [['O', '0'], ['V', '2'], ['W', '6'], ['F', '9']].map(([l, d]) => [STATIC_CLASSES.indexOf(l), STATIC_CLASSES.indexOf(d)]);

export function maskProbs(raw0, mode = 'auto') {
  const mask = MASKS[mode] || MASKS.auto;
  const raw = Float32Array.from(raw0);
  for (const [l, d] of PAIR_IDX) {
    const tot = raw[l] + raw[d];
    raw[l] = tot;
    raw[d] = tot;
  }
  const out = new Float32Array(raw.length);
  let sum = 0;
  for (let i = 0; i < raw.length; i++) {
    out[i] = mask[i] ? raw[i] : 0;
    sum += out[i];
  }
  if (sum > 0) for (let i = 0; i < out.length; i++) out[i] /= sum;
  return out;
}

const descCache = new Map();
export function targetDescriptor(ch) {
  if (!descCache.has(ch)) descCache.set(ch, poseDescriptor(poseLandmarks(ch, { orient: false })));
  return descCache.get(ch);
}

export function modeForChar(ch) {
  return DIGITS.includes(ch) ? 'digits' : 'letters';
}

export class SignEngine {
  constructor() {
    this.staticModel = null; // chế độ chạy trong luồng chính (và khi kiểm thử)
    this.dynamicModel = null;
    this.inf = null; // InferenceClient khi chạy bằng Web Worker
    this.knn = null; // kNN (mẫu thật đóng gói sẵn + mẫu của người dùng)
    this.meta = null;
    this.ens = { T: 0.4, w: 0.5 };
    this.ema = null; // xác suất đã làm mượt theo thời gian
    this.status = { loaded: false, loading: false, staticSource: 'none', dynamicSource: 'none', error: null, mode: 'main', backend: null, bench: {} };
    this.reset();
  }

  reset() {
    this.hist = []; // lịch sử vị trí đầu ngón để tính chuyển động & LSTM
    this.cooldown = 0;
    this.frameNo = 0;
    this.lastDyn = null;
    this.missing = 0;
    this.suspendDynamic = false; // true khi đang thu mẫu ở trang Hiệu chỉnh
    this.ema = null;
  }

  async load() {
    if (this.status.loaded || this.status.loading) return this.status;
    this.status.loading = true;
    const g = store.read(GLOBAL_KEY, {}) || {};
    const profileId = activeId();
    this.profileId = profileId;
    try {
      let mode = 'main';
      let info = null;
      if (g.useWorker !== false && InferenceClient.supported()) {
        try {
          this.inf = new InferenceClient();
          info = await this.inf.init({ profileId, backend: g.backend || 'auto', hint: g.backendHint || '' });
          if (info.backend && Object.keys(info.bench || {}).length && (g.backend || 'auto') === 'auto') store.write(GLOBAL_KEY, { ...g, backendHint: info.backend, bench: info.bench });
          mode = 'worker';
        } catch (e) {
          this.inf?.dispose();
          this.inf = null; // worker lỗi -> chạy ngay trong luồng chính
        }
      }
      if (mode === 'main') {
        const bk = await chooseBackend(g.backend || 'auto');
        const s = await loadStatic(profileId);
        const d = await loadDynamic(profileId);
        this.staticModel = s.model;
        this.dynamicModel = d.model;
        info = { backend: bk.name, bench: bk.results, list: bk.list, staticSource: s.source, dynamicSource: d.source };
        if (this.staticModel) tf.tidy(() => this.staticModel.predict(tf.zeros([1, 63])).dataSync());
        if (this.dynamicModel) tf.tidy(() => this.dynamicModel.predict(tf.zeros([1, SEQ_LEN, 4])).dataSync());
      }
      await this._loadKnn();
      this.status = { loaded: true, loading: false, error: null, mode, ...info };
    } catch (e) {
      this.status = { ...this.status, loading: false, error: e.message };
    }
    return this.status;
  }

  async _loadKnn() {
    try {
      const meta = await (await fetch(META_URL)).json();
      this.meta = meta;
      if (meta.knn) {
        this.ens = { T: meta.knn.T ?? 0.4, w: meta.knn.weightMlp ?? 0.5 };
        const buf = await (await fetch(KNN_URL)).arrayBuffer();
        this.knn = KnnIndex.fromInt16(buf, meta.knn.labels, STATIC_CLASSES.length);
      }
    } catch {
      this.knn = null;
    }
    if (!this.knn) this.knn = new KnnIndex(STATIC_CLASSES.length);
    this.reloadUserSamples();
  }

  /** Nạp lại mẫu người dùng thu ở trang Hiệu chỉnh vào kNN (ưu tiên hơn mẫu đóng gói: trọng số khoảng cách 0,75). */
  reloadUserSamples() {
    if (!this.knn) return 0;
    this.knn.clearWhere(USER_W);
    let n = 0;
    try {
      const st = (store.read(pkey('samples'), {}) || {}).static || {};
      for (const [c, list] of Object.entries(st)) {
        const ci = STATIC_CLASSES.indexOf(c);
        if (ci < 0) continue;
        for (const v of list) {
          this.knn.add(Float32Array.from(v), ci, USER_W);
          n++;
        }
      }
    } catch {
      /* chưa có mẫu */
    }
    this.userSamples = n;
    return n;
  }

  async reloadModels() {
    this.staticModel?.dispose();
    this.dynamicModel?.dispose();
    this.staticModel = this.dynamicModel = null;
    this.inf?.dispose();
    this.inf = null;
    this.status.loaded = false;
    this.status.loading = false;
    return this.load();
  }

  predictStatic(feat) {
    const mlp = this.inf ? this.inf.predictStatic(feat) : this.staticModel ? tf.tidy(() => this.staticModel.predict(tf.tensor2d(feat, [1, 63])).dataSync().slice()) : null;
    const knn = this.knn && this.knn.size ? this.knn.probs(feat, this.ens.T) : null;
    if (mlp && knn) {
      // Nếu có mẫu người dùng, kNN được tin hơn (mô hình chung chưa biết tay của bạn)
      const w = this.userSamples > 0 ? Math.min(this.ens.w, 0.35) : this.ens.w;
      return Float32Array.from(mlp, (v, i) => w * v + (1 - w) * knn[i]);
    }
    return mlp || knn;
  }

  _pushHistory(px) {
    const s = palmScale(px);
    this.hist.push({ a: [px[8].x, px[8].y], p: [px[20].x, px[20].y], w: [px[0].x, px[0].y], s });
    if (this.hist.length > HISTORY) this.hist.shift();
  }

  _motion() {
    const n = this.hist.length;
    if (n < 7) return 0;
    const a = this.hist[n - 1];
    const b = this.hist[n - 7];
    const s = a.s;
    return Math.max(Math.hypot(a.w[0] - b.w[0], a.w[1] - b.w[1]), Math.hypot(a.a[0] - b.a[0], a.a[1] - b.a[1]), Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1])) / s;
  }

  /**
   * Dựng chuỗi (x, y, vx, vy) × 20 mẫu của đầu ngón 'a' (trỏ, khớp 8) hoặc 'p' (út, khớp 20)
   * từ lịch sử gần nhất (xem STRIDE). Dùng cho nhận diện và cho thu mẫu ở trang Hiệu chỉnh.
   */
  buildSequence(key) {
    if (this.hist.length < HISTORY) return null;
    const seq = new Float32Array(SEQ_LEN * 4);
    const at = (k) => this.hist[this.hist.length - 1 - (SEQ_LEN - 1 - k) * STRIDE];
    const first = at(0);
    let sMean = 0;
    for (let k = 0; k < SEQ_LEN; k++) sMean += at(k).s;
    sMean /= SEQ_LEN;
    let path = 0;
    let prev = null;
    for (let k = 0; k < SEQ_LEN; k++) {
      const h = at(k);
      const x = (h[key][0] - first[key][0]) / sMean;
      const y = (h[key][1] - first[key][1]) / sMean;
      const pr = prev || [x, y];
      seq[k * 4] = x;
      seq[k * 4 + 1] = y;
      seq[k * 4 + 2] = (x - pr[0]) * 3;
      seq[k * 4 + 3] = (y - pr[1]) * 3;
      path += Math.hypot(x - pr[0], y - pr[1]);
      prev = [x, y];
    }
    return { seq, path };
  }

  _dynamic(curls) {
    const c = curls;
    let candidate = null;
    if (c.pinky < 0.42 && c.index > 0.55 && c.middle > 0.55 && c.ring > 0.55) candidate = 'J';
    else if (c.index < 0.42 && c.middle > 0.55 && c.ring > 0.55 && c.pinky > 0.55) candidate = 'Z';
    const res = { candidate, cls: null, conf: 0, detected: false, ready: this.hist.length >= HISTORY };
    if (this.suspendDynamic) return res;
    if (this.cooldown > 0) {
      this.cooldown--;
      return res;
    }
    if (!candidate || !(this.dynamicModel || this.inf) || this.hist.length < HISTORY || this.frameNo % 2) return this.lastDyn?.candidate === candidate ? { ...this.lastDyn, detected: false } : res;
    const built = this.buildSequence(candidate === 'J' ? 'p' : 'a');
    if (!built) return res;
    const { seq, path } = built;
    if (path < 0.7) {
      this.lastDyn = { ...res, cls: candidate, conf: 0 };
      return this.lastDyn;
    }
    const probs = this.inf ? this.inf.predictDynamic(seq, candidate) : tf.tidy(() => this.dynamicModel.predict(tf.tensor3d(seq, [1, SEQ_LEN, 4])).dataSync().slice());
    if (!probs) return { ...res, candidate, cls: candidate, ready: true };
    const ci = DYN_CLASSES.indexOf(candidate);
    const conf = probs[ci];
    const detected = conf >= dynCfg.confidence_threshold;
    if (detected) {
      this.cooldown = 30;
      this.hist.length = 0;
    }
    this.lastDyn = { candidate, cls: candidate, conf, detected, ready: true, path };
    return this.lastDyn;
  }

  /**
   * lm: 21 landmark chuẩn hoá (0..1) của MediaPipe hoặc null khi không thấy tay.
   * Trả về khung kết quả (không cấp phát nhiều để chạy 30 FPS).
   */
  process(lm, W, H, { mode = 'auto' } = {}) {
    this.frameNo++;
    if (!lm) {
      if (++this.missing > 6) this.hist.length = 0;
      if (this.missing > 3) this.ema = null;
      return { present: false };
    }
    this.missing = 0;
    const px = toPixelSpace(lm, W, H);
    const feat = normalizeLandmarks(px);
    this._pushHistory(px);
    const curls = fingerCurls(px);
    const raw = this.predictStatic(feat);
    let top = null;
    let conf = 0;
    let probs = null;
    let margin = 0;
    let smooth = null;
    if (raw) {
      // làm mượt theo thời gian để bớt nhấp nháy giữa các ký tự gần giống nhau
      if (!this.ema) this.ema = Float32Array.from(raw);
      else for (let i = 0; i < raw.length; i++) this.ema[i] = EMA_ALPHA * raw[i] + (1 - EMA_ALPHA) * this.ema[i];
      smooth = this.ema;
      probs = maskProbs(smooth, mode);
      let bi = 0;
      for (let i = 1; i < probs.length; i++) if (probs[i] > probs[bi]) bi = i;
      let second = 0;
      for (let i = 0; i < probs.length; i++) if (i !== bi && probs[i] > second) second = probs[i];
      top = STATIC_CLASSES[bi];
      conf = probs[bi];
      margin = conf - second;
    }
    const motion = this._motion();
    return {
      present: true,
      px,
      feat,
      raw,
      smooth,
      probs,
      top,
      conf,
      margin,
      curls,
      motion,
      moving: motion > 0.3,
      descriptor: poseDescriptor(px),
      dynamic: this._dynamic(curls),
    };
  }

  /** Mô tả hình học của mẫu THẬT gần nhất thuộc ký tự mục tiêu (dùng làm "đáp án" khi chấm điểm). */
  _refDescriptor(feat, ci) {
    if (!this.knn || !this.knn.size) return null;
    const i = this.knn.nearestOfClass(feat, ci);
    if (i < 0) return null;
    const v = this.knn.vecs[i];
    if (!refCache.has(v)) {
      const lm = Array.from({ length: 21 }, (_, k) => ({ x: v[k * 3], y: v[k * 3 + 1], z: v[k * 3 + 2] }));
      refCache.set(v, poseDescriptor(lm));
    }
    return refCache.get(v);
  }

  /**
   * Chấm điểm 0..1 so với ký tự mục tiêu = trộn (a) so khớp hình học với mẫu THẬT gần nhất của ký tự đó
   * và (b) xác suất mô hình dành cho ký tự đó (≥ 75% là đủ điểm tối đa).
   */
  scoreTarget(frame, target) {
    if (!frame?.present) return { accuracy: 0, geometric: 0, model: 0, per: null };
    const base = DYN_BASE[target] || target; // J → tư thế I, Z → tư thế D
    const ci = STATIC_CLASSES.indexOf(base);
    const ref = ci >= 0 ? this._refDescriptor(frame.feat, ci) : null;
    const cmp = comparePose(frame.descriptor, ref || targetDescriptor(base));
    const geometric = ref ? Math.min(1, cmp.overall / REF_FULL) : cmp.overall;
    const w = systemConfig.deaf_mute_learning_module.scoring;
    let model = null;
    const src = frame.smooth || frame.raw;
    if (src && ci >= 0) {
      const m = maskProbs(src, modeForChar(base));
      model = Math.min(1, m[ci] / MODEL_FULL);
    }
    const accuracy = model == null ? geometric : w.geometric_weight * geometric + w.model_weight * model;
    return { accuracy, geometric, model, per: cmp.per };
  }
}

export const signEngine = new SignEngine();
