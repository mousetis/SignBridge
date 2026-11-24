// Bộ phân loại kNN theo "mẫu đại diện" (prototype): khoảng cách tới mẫu gần nhất của từng ký tự -> softmax.
// Chạy tức thì, không cần huấn luyện → dùng cho (1) mẫu thật đóng gói sẵn, (2) mẫu do chính người dùng thu ở trang Hiệu chỉnh.
export class KnnIndex {
  constructor(nClasses, dim = 63) {
    this.nc = nClasses;
    this.dim = dim;
    this.vecs = [];
    this.cls = [];
    this.weight = []; // < 1 = ưu tiên (khoảng cách được nhân trọng số)
  }

  get size() {
    return this.cls.length;
  }

  add(vec, ci, weight = 1) {
    this.vecs.push(vec);
    this.cls.push(ci);
    this.weight.push(weight);
  }

  clearWhere(weight) {
    const keep = [];
    for (let i = 0; i < this.cls.length; i++) if (this.weight[i] !== weight) keep.push(i);
    this.vecs = keep.map((i) => this.vecs[i]);
    this.cls = keep.map((i) => this.cls[i]);
    this.weight = keep.map((i) => this.weight[i]);
  }

  /** Khoảng cách (đã nhân trọng số) tới mẫu gần nhất của từng lớp. */
  nearest(feat, out = new Float32Array(this.nc)) {
    out.fill(1e9);
    const d = this.dim;
    for (let i = 0; i < this.vecs.length; i++) {
      const v = this.vecs[i];
      let s = 0;
      for (let k = 0; k < d; k++) {
        const t = feat[k] - v[k];
        s += t * t;
      }
      const dist = Math.sqrt(s) * this.weight[i];
      if (dist < out[this.cls[i]]) out[this.cls[i]] = dist;
    }
    return out;
  }

  /** Chỉ số mẫu gần nhất thuộc lớp ci (thử cả bản lật trái/phải của feat). */
  nearestOfClass(feat, ci) {
    let best = -1;
    let bd = 1e18;
    const d = this.dim;
    for (let i = 0; i < this.vecs.length; i++) {
      if (this.cls[i] !== ci) continue;
      const v = this.vecs[i];
      let s1 = 0;
      let s2 = 0;
      for (let k = 0; k < d; k++) {
        const t = feat[k] - v[k];
        s1 += t * t;
        // lật trái/phải: đổi dấu toạ độ x (k % 3 === 0)
        const f2 = k % 3 === 0 ? -feat[k] : feat[k];
        const t2 = f2 - v[k];
        s2 += t2 * t2;
      }
      const m = Math.min(s1, s2);
      if (m < bd) {
        bd = m;
        best = i;
      }
    }
    return best;
  }

  /** Xác suất theo softmax(-d/T) trên khoảng cách gần nhất của từng lớp. */
  probs(feat, T = 0.4) {
    const dist = this.nearest(feat);
    let mn = 1e9;
    for (const v of dist) if (v < mn) mn = v;
    const p = new Float32Array(this.nc);
    let sum = 0;
    for (let i = 0; i < this.nc; i++) {
      p[i] = dist[i] > 1e8 ? 0 : Math.exp(-(dist[i] - mn) / T);
      sum += p[i];
    }
    for (let i = 0; i < this.nc; i++) p[i] /= sum || 1;
    return p;
  }

  /** Đọc từ tệp Int16 (giá trị × 1000) và nhãn theo thứ tự. */
  static fromInt16(buffer, labels, nClasses, dim = 63) {
    const a = new Int16Array(buffer);
    const idx = new KnnIndex(nClasses, dim);
    for (let i = 0; i < labels.length; i++) {
      const v = new Float32Array(dim);
      for (let k = 0; k < dim; k++) v[k] = a[i * dim + k] / 1000;
      idx.add(v, labels[i], 1);
    }
    return idx;
  }
}
