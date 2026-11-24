// Huấn luyện bộ nhận diện TĨNH bằng landmark bàn tay THẬT (3 bộ dữ liệu) + tăng cường dữ liệu.
//   npm run train:real           -> huấn luyện lần cuối trên cả 3 bộ, ghi vào public/models
//   npm run train:real:eval      -> trước đó, đo độ chính xác "chéo bộ dữ liệu" (huấn luyện 2 bộ, thử bộ còn lại)
// Dữ liệu: đặt 3 tệp CSV vào data/real/ (xem README).
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tf, buildStaticModel, fitDataset } from '../src/lib/ml/models.js';
import { STATIC_CLASSES, LETTERS } from '../src/config/systemConfig.js';
import { loadDataset } from './lib/realData.mjs';
import { augmentFeatures, makeRng } from './lib/augment.mjs';
import { normalizeLandmarks } from '../src/lib/ml/features.js';
import { KnnIndex } from '../src/lib/ml/knn.js';
import { maskProbs } from '../src/lib/ml/signEngine.js';
import { saveModel } from './lib/saveModel.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.REAL_DATA_DIR || join(root, 'data', 'real');
const outDir = join(root, 'public', 'models');
const N_PER_CLASS = Number(process.env.N_PER_CLASS || 1000);
const EPOCHS = Number(process.env.EPOCHS || 14);
const PROTOS = Number(process.env.PROTOS || 24);
const keep = new Set(STATIC_CLASSES);

const sets = {};
for (const k of ['train', 'aslhg', 'alpha']) sets[k] = loadDataset(dataDir, k, { keep });
console.log('Dữ liệu thật:', Object.entries(sets).map(([k, v]) => `${k}=${v.length}`).join('  '));

/** Mỗi lớp lấy đúng N mẫu tăng cường (cân bằng lớp), nhân đôi bằng lật trái/phải. */
function buildTrain(samples, seed) {
  const rng = makeRng(seed);
  const byClass = new Map(STATIC_CLASSES.map((c) => [c, []]));
  for (const s of samples) byClass.get(s.label)?.push(s);
  const n = STATIC_CLASSES.length * N_PER_CLASS * 2;
  const xs = new Float32Array(n * 63);
  const ys = new Int32Array(n);
  let k = 0;
  STATIC_CLASSES.forEach((c, ci) => {
    const pool = byClass.get(c);
    if (!pool.length) return;
    for (let i = 0; i < N_PER_CLASS; i++) {
      const s = pool[Math.floor(rng.next() * pool.length)];
      xs.set(augmentFeatures(s.lm, rng, { tilt: 0.4, noise: 0.02, mirror: false }), k * 63);
      ys[k++] = ci;
      xs.set(augmentFeatures(s.lm, rng, { tilt: 0.4, noise: 0.02, mirror: true }), k * 63);
      ys[k++] = ci;
    }
  });
  return { xs: xs.subarray(0, k * 63), ys: ys.subarray(0, k), count: k, classes: STATIC_CLASSES };
}

// ---- k-means để chọn mẫu đại diện cho kNN ----
function kmeans(vecs, k, rng, iters = 12) {
  if (vecs.length <= k) return vecs.map((v) => Float32Array.from(v));
  let cent = Array.from({ length: k }, () => Float32Array.from(vecs[Math.floor(rng.next() * vecs.length)]));
  const assign = new Int32Array(vecs.length);
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < vecs.length; i++) {
      let bi = 0, bd = 1e18;
      for (let c = 0; c < k; c++) {
        let s = 0;
        for (let d = 0; d < 63; d++) { const t = vecs[i][d] - cent[c][d]; s += t * t; }
        if (s < bd) { bd = s; bi = c; }
      }
      assign[i] = bi;
    }
    const sum = Array.from({ length: k }, () => new Float32Array(63));
    const cnt = new Int32Array(k);
    for (let i = 0; i < vecs.length; i++) { cnt[assign[i]]++; for (let d = 0; d < 63; d++) sum[assign[i]][d] += vecs[i][d]; }
    cent = cent.map((c, ci) => (cnt[ci] ? sum[ci].map((v) => v / cnt[ci]) : c));
  }
  return cent;
}
function buildKnn(samples, seed) {
  const rng = makeRng(seed);
  const idx = new KnnIndex(STATIC_CLASSES.length);
  STATIC_CLASSES.forEach((c, ci) => {
    const feats = samples.filter((s) => s.label === c).map((s) => normalizeLandmarks(s.lm));
    for (const p of kmeans(feats, PROTOS, rng)) idx.add(p, ci);
  });
  return idx;
}

// ---- đánh giá: chỉ tính chữ cái; O/V/W/F gộp với 0/2/6/9 theo chế độ chữ ----
function evalOn(model, knn, test, { T, w }) {
  const feats = test.map((s) => normalizeLandmarks(s.lm));
  const flat = new Float32Array(feats.length * 63);
  feats.forEach((f, i) => flat.set(f, i * 63));
  const mlp = tf.tidy(() => model.predict(tf.tensor2d(flat, [feats.length, 63])).arraySync());
  const res = { mlp: 0, knn: 0, ens: 0, n: 0, perEns: {} };
  test.forEach((s, i) => {
    const digit = !LETTERS.includes(s.label);
    const mode = digit ? 'digits' : 'letters';
    const pk = knn.probs(feats[i], T);
    const ens = Float32Array.from(mlp[i], (v, k) => w * v + (1 - w) * pk[k]);
    const top = (p) => { const m = maskProbs(p, mode); let b = 0; for (let k = 1; k < m.length; k++) if (m[k] > m[b]) b = k; return STATIC_CLASSES[b]; };
    res.n++;
    if (top(mlp[i]) === s.label) res.mlp++;
    if (top(pk) === s.label) res.knn++;
    const hit = top(ens) === s.label;
    if (hit) res.ens++;
    const pe = (res.perEns[s.label] ||= [0, 0]);
    pe[1]++;
    if (hit) pe[0]++;
  });
  return res;
}

await tf.ready();
const t0 = Date.now();
const log = (e, n, l) => process.stdout.write(`\r    epoch ${e}/${n} loss=${l.loss.toFixed(3)} val_acc=${(l.val_acc ?? l.val_accuracy ?? 0).toFixed(3)}   `);
const report = { lodo: {}, params: { N_PER_CLASS, EPOCHS, PROTOS } };
const grid = [{ T: 0.25, w: 0.5 }, { T: 0.4, w: 0.5 }, { T: 0.4, w: 0.7 }, { T: 0.6, w: 0.5 }];
let best = { T: 0.4, w: 0.5 };

if (process.env.LODO || process.argv.includes('--lodo')) {
  const keys = Object.keys(sets);
  const folds = (process.env.LODO_FOLDS || keys.join(',')).split(',');
  const totals = grid.map(() => ({ ens: 0, n: 0 }));
  for (const test of folds) {
    const trainSamples = keys.filter((k) => k !== test).flatMap((k) => sets[k]);
    const testSamples = sets[test].filter((s) => LETTERS.includes(s.label) && s.label !== 'J' && s.label !== 'Z');
    console.log(`\n[LODO] huấn luyện trên ${keys.filter((k) => k !== test).join('+')} -> thử trên ${test} (${testSamples.length} mẫu chữ cái)`);
    const model = buildStaticModel();
    await fitDataset(model, buildTrain(trainSamples, 7), { epochs: EPOCHS, batchSize: 256, onEpoch: log });
    const knn = buildKnn(trainSamples, 3);
    grid.forEach((g, gi) => {
      const r = evalOn(model, knn, testSamples, g);
      totals[gi].ens += r.ens; totals[gi].n += r.n;
      if (gi === 0) console.log(`\n    MLP ${(r.mlp / r.n * 100).toFixed(1)}%  kNN ${(r.knn / r.n * 100).toFixed(1)}%`);
      console.log(`    kết hợp T=${g.T} w=${g.w}: ${(r.ens / r.n * 100).toFixed(1)}%`);
      if (gi === 1) report.lodo[test] = { mlp: r.mlp / r.n, knn: r.knn / r.n, ens: r.ens / r.n, perClass: Object.fromEntries(Object.entries(r.perEns).map(([c, [a, b]]) => [c, a / b])) };
    });
    model.dispose();
  }
  const accs = totals.map((t) => t.ens / t.n);
  best = grid[accs.indexOf(Math.max(...accs))];
  console.log('\nTrung bình chéo bộ dữ liệu theo cấu hình:', grid.map((g, i) => `T=${g.T},w=${g.w}: ${(accs[i] * 100).toFixed(1)}%`).join(' | '), '-> chọn', best);
  report.lodoMean = Math.max(...accs);
}

// ---------- Mô hình cuối: dùng cả 3 bộ ----------
console.log('\n[Cuối] huấn luyện trên cả 3 bộ dữ liệu');
const all = Object.values(sets).flat();
const model = buildStaticModel();
await fitDataset(model, buildTrain(all, 11), { epochs: EPOCHS, batchSize: 256, onEpoch: log });
await saveModel(model, join(outDir, 'static_mlp'));

const knn = buildKnn(all, 5);
const bin = new Int16Array(knn.size * 63);
knn.vecs.forEach((v, i) => v.forEach((x, k) => (bin[i * 63 + k] = Math.max(-32000, Math.min(32000, Math.round(x * 1000))))));
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'static_knn.bin'), Buffer.from(bin.buffer));

const metaPath = join(outDir, 'meta.json');
const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
Object.assign(meta, {
  note: 'MLP tĩnh + kNN huấn luyện trên landmark bàn tay THẬT (Kaggle ASL Alphabet, ASL-HG, SignAlphaSet) với tăng cường dữ liệu; LSTM J/Z huấn luyện trên quỹ đạo tổng hợp.',
  staticClasses: STATIC_CLASSES,
  knn: { labels: knn.cls, T: best.T, weightMlp: best.w, prototypes: knn.size },
  staticTrainedAt: new Date().toISOString(),
  realData: { params: report.params, lodo: report.lodo, lodoMeanLetters: report.lodoMean ?? null },
});
writeFileSync(metaPath, JSON.stringify(meta, null, 2));
console.log(`\nXong sau ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${outDir}`);
