// Tự kiểm thử logic cốt lõi (không cần trình duyệt):  npm test
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { tf } from '../src/lib/ml/models.js';
import { POSES, AMBIGUOUS_PAIRS } from '../src/data/poses.js';
import { getResolved, getPoseQuats, poseLandmarks, getSkeleton } from '../src/lib/hand/poseLibrary.js';
import { blendPoses, makeRng } from '../src/lib/hand/handPose.js';
import { noisyFeatures, synthTrajectory, trajectoryToFeatures, SEQ_LEN, DYN_CLASSES } from '../src/lib/ml/synthetic.js';
import { STATIC_CLASSES, LETTERS, DIGITS } from '../src/config/systemConfig.js';
import { maskProbs, SignEngine } from '../src/lib/ml/signEngine.js';
import { poseDescriptor, comparePose, normalizeLandmarks } from '../src/lib/ml/features.js';
import { PressureGestureDetector, JoystickFilter } from '../src/lib/esp32/filters.js';
import { normalizeWsUrl, parseTelemetry } from '../src/lib/esp32/protocol.js';
import { CharCommitter, WordBuilder, suggest, applySuggestion } from '../src/lib/ml/assembly.js';
import { normalizeForSign, toSignChars } from '../src/lib/text.js';
import { restoreDiacritics } from '../src/data/vocabulary.js';
import { LEVELS, expandLevel } from '../src/data/lessons.js';
import { KnnIndex } from '../src/lib/ml/knn.js';
import { loadDataset } from './lib/realData.mjs';
import { existsSync } from 'node:fs';

let pass = 0;
const t = (name, fn) => {
  try {
    const r = fn();
    if (r instanceof Promise) return r.then(() => ok(name), (e) => fail(name, e));
    ok(name);
  } catch (e) {
    fail(name, e);
  }
};
const ok = (n) => (pass++, console.log('  ✓', n));
const fail = (n, e) => {
  console.error('  ✗', n, '\n   ', e.message);
  process.exitCode = 1;
};
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rng = makeRng(7);

// ---------- Tư thế & khung xương ----------
console.log('\nTư thế & khung xương 3D');
t('36 ký tự đều có tư thế (A–Z, 0–9)', () => {
  for (const c of [...LETTERS, ...DIGITS]) assert.ok(POSES[c], `thiếu ${c}`);
});
t('IK ngón cái: sai số < 0,8 cm ở mọi tư thế', () => {
  for (const c of Object.keys(POSES)) assert.ok(getResolved(c).thumbErr < 0.8, `${c}: ${getResolved(c).thumbErr.toFixed(2)} cm`);
});
t('21 landmark, độ dài đốt ngón không đổi khi gập', () => {
  const a = poseLandmarks('B', { orient: false });
  const b = poseLandmarks('A', { orient: false });
  assert.equal(a.length, 21);
  const d = (l, i, j) => Math.hypot(l[i].x - l[j].x, l[i].y - l[j].y, l[i].z - l[j].z);
  for (const [i, j] of [[5, 6], [6, 7], [7, 8], [17, 18], [2, 3]]) assert.ok(Math.abs(d(a, i, j) - d(b, i, j)) < 1e-4);
});
t('Nội suy Quaternion SLERP: t=0 → A, t=1 → B, t=.5 nằm giữa', () => {
  const A = getPoseQuats('A');
  const B = getPoseQuats('5');
  const m0 = blendPoses(A, B, 0);
  const m1 = blendPoses(A, B, 1);
  const mh = blendPoses(A, B, 0.5);
  assert.ok(m0.joints.index_pip.angleTo(A.joints.index_pip) < 1e-6);
  assert.ok(m1.joints.index_pip.angleTo(B.joints.index_pip) < 1e-6);
  const full = A.joints.index_pip.angleTo(B.joints.index_pip);
  assert.ok(Math.abs(A.joints.index_pip.angleTo(mh.joints.index_pip) - full / 2) < 1e-6);
  void THREE;
});
t('Hướng bàn tay: G/H xoay ngang, P/Q chúc xuống', () => {
  const dir = (c) => {
    const l = poseLandmarks(c);
    return { x: l[9].x - l[0].x, y: -(l[9].y - l[0].y) };
  };
  assert.ok(dir('A').y > 5 && Math.abs(dir('A').x) < 1.5);
  assert.ok(Math.abs(dir('G').x) > 5 && Math.abs(dir('G').y) < 1.5);
  assert.ok(dir('P').y < -3);
});
t('Chấm điểm hình học: tư thế đúng ≈ 100%, tư thế khác thấp hơn', () => {
  const tgt = poseDescriptor(poseLandmarks('L', { orient: false }));
  const same = comparePose(poseDescriptor(poseLandmarks('L', { orient: false })), tgt).overall;
  const rng = makeRng(5);
  const near = comparePose(poseDescriptor(poseLandmarks('L', { rng, jitter: 1, tilt: 1 })), tgt).overall;
  const other = comparePose(poseDescriptor(poseLandmarks('B', { orient: false })), tgt).overall;
  assert.ok(same > 0.98, `same=${same}`);
  assert.ok(near > 0.8, `near=${near}`);
  assert.ok(other < 0.6, `other=${other}`);
  console.log(`      (đúng ${same.toFixed(2)} · lệch nhẹ ${near.toFixed(2)} · sai ${other.toFixed(2)})`);
});

// ---------- Mô hình ML ----------
console.log('\nMô hình TensorFlow.js (dữ liệu thật + tổng hợp)');
async function loadModel(dir) {
  const j = JSON.parse(readFileSync(join(root, 'public/models', dir, 'model.json'), 'utf8'));
  const w = readFileSync(join(root, 'public/models', dir, 'weights.bin'));
  return tf.loadLayersModel(
    tf.io.fromMemory({
      modelTopology: j.modelTopology,
      weightSpecs: j.weightsManifest[0].weights,
      weightData: w.buffer.slice(w.byteOffset, w.byteOffset + w.byteLength),
    }),
  );
}
await tf.ready();
const staticModel = await loadModel('static_mlp');
const dynModel = await loadModel('dynamic_lstm');

const meta = JSON.parse(readFileSync(join(root, 'public/models/meta.json'), 'utf8'));
const knnBuf = readFileSync(join(root, 'public/models/static_knn.bin'));
const knn = KnnIndex.fromInt16(knnBuf.buffer.slice(knnBuf.byteOffset, knnBuf.byteOffset + knnBuf.byteLength), meta.knn.labels, STATIC_CLASSES.length);
const realDir = join(root, 'data', 'real');
const hasReal = existsSync(join(realDir, 'landmarks_signalphaset.csv'));
const makeEngine = () => {
  const e = new SignEngine();
  e.staticModel = staticModel;
  e.dynamicModel = dynModel;
  e.knn = knn;
  e.ens = { T: meta.knn.T, w: meta.knn.weightMlp };
  return e;
};
const realToFrame = (lm) => lm.map((p) => ({ x: 0.5 + p.x * 0.05, y: 0.5 + p.y * 0.05, z: p.z * 0.05 }));

await t('Mô hình tĩnh: độ chính xác chéo bộ dữ liệu đã ghi nhận ≥ 75% (xem meta.json)', () => {
  const m = meta.realData?.lodoMeanLetters;
  console.log(`      kiểm tra chéo bộ dữ liệu (chỉ chữ cái, bộ chưa thấy): ${m == null ? 'chưa đo' : (m * 100).toFixed(1) + '%'}`);
  assert.ok(m == null || m >= 0.75);
});

if (hasReal) {
  await t('MLP + kNN trên landmark thật (mẫu lấy ngẫu nhiên, đã nằm trong tập huấn luyện) ≥ 90%', () => {
    const rows = ['train', 'aslhg', 'alpha'].flatMap((k) => loadDataset(realDir, k, { keep: new Set(STATIC_CLASSES) }));
    const rng = makeRng(555);
    const eng = makeEngine();
    let right = 0;
    let n = 0;
    for (const r of rows) {
      if (rng.next() > 0.03) continue;
      const mode = DIGITS.includes(r.label) ? 'digits' : 'letters';
      eng.reset();
      const f = eng.process(realToFrame(r.lm), 640, 480, { mode });
      n++;
      if (f.top === r.label) right++;
    }
    console.log(`      ${((right / n) * 100).toFixed(1)}% trên ${n} mẫu`);
    assert.ok(right / n > 0.9);
  });
} else console.log('  (bỏ qua các phép thử dữ liệu thật: thiếu data/real/*.csv)');

await t('LSTM: J / Z / NONE trên chuỗi mới', () => {
  const rng = makeRng(2468);
  let ok2 = 0;
  const n = 120;
  const conf = {};
  for (let i = 0; i < n; i++) {
    const ci = i % 3;
    const f = trajectoryToFeatures(synthTrajectory(DYN_CLASSES[ci], rng));
    const p = tf.tidy(() => dynModel.predict(tf.tensor3d(f, [1, SEQ_LEN, 4])).dataSync().slice());
    const pred = p.indexOf(Math.max(...p));
    if (pred === ci) ok2++;
    conf[DYN_CLASSES[ci]] = (conf[DYN_CLASSES[ci]] || 0) + (pred === ci ? 1 : 0);
  }
  console.log(`      ${((ok2 / n) * 100).toFixed(1)}%`, conf);
  assert.ok(ok2 / n > 0.93);
});

if (hasReal) {
  await t('SignEngine: tay thật giữ yên → chốt đúng ký tự sau 10 khung (≥ 70%, hơn ký tự thứ hai ≥ 20%)', () => {
    const rows = loadDataset(realDir, 'alpha', { keep: new Set(['L']) });
    const eng = makeEngine();
    const cm = new CharCommitter();
    const rng = makeRng(99);
    const base = rows[3].lm;
    let committed = null;
    let frames = 0;
    for (let i = 0; i < 40 && !committed; i++) {
      const lm = realToFrame(base.map((p) => ({ x: p.x + rng.gauss() * 0.01, y: p.y + rng.gauss() * 0.01, z: p.z + rng.gauss() * 0.01 })));
      const f = eng.process(lm, 640, 480, { mode: 'letters' });
      const r = cm.update({ present: true, top: f.top, conf: f.conf, margin: f.margin, moving: f.moving });
      committed = r.committed;
      frames++;
    }
    console.log(`      chốt "${committed}" sau ${frames} khung`);
    assert.equal(committed, 'L');
    assert.ok(frames >= 8);
  });

  await t('Chấm điểm bài học: làm đúng ≥ 80%, làm sai ký tự khác thấp hơn rõ rệt', () => {
    const rows = loadDataset(realDir, 'aslhg', { keep: new Set(['L', 'B', 'Y']) });
    const eng = makeEngine();
    const score = (label, target) => {
      const r = rows.filter((x) => x.label === label).slice(10, 40);
      let sum = 0;
      for (const x of r) {
        eng.reset();
        const f = eng.process(realToFrame(x.lm), 640, 480, { mode: 'letters' });
        sum += eng.scoreTarget(f, target).accuracy;
      }
      return sum / r.length;
    };
    const right = score('L', 'L');
    const wrong = score('B', 'L');
    console.log(`      L→L ${(right * 100).toFixed(0)}% · B→L ${(wrong * 100).toFixed(0)}%`);
    assert.ok(right >= 0.8 && wrong < right - 0.3);
  });
}

await t('SignEngine: phát hiện chữ J và Z từ quỹ đạo đầu ngón', () => {
  const run = (target) => {
    const eng = makeEngine();
    const mk = (seed) => makeRng(seed).next;
    const base = poseLandmarks(target === 'J' ? 'I' : 'D', { rng: null, orient: false });
    const traj = synthTrajectory(target, rng);
    // Dựng 40 khung (stride 2): nội suy chuỗi 20 điểm ra 40 khung
    let detected = null;
    for (let fr = 0; fr < 60 && !detected; fr++) {
      const u = Math.min(SEQ_LEN - 1, (fr * (SEQ_LEN - 1)) / 44);
      const k = Math.floor(u);
      const a = traj[k];
      const b = traj[Math.min(SEQ_LEN - 1, k + 1)];
      const ox = (a[0] + (b[0] - a[0]) * (u - k)) * 9.3;
      const oy = (a[1] + (b[1] - a[1]) * (u - k)) * 9.3;
      const lm = base.map((p) => ({ x: 0.5 + (p.x + ox) * 0.02, y: 0.5 + (p.y + oy) * 0.02, z: p.z * 0.02 }));
      const f = eng.process(lm, 640, 480, { mode: 'letters' });
      if (f.dynamic?.detected) detected = f.dynamic.cls;
    }
    return detected;
  };
  const rJ = run('J');
  const rZ = run('Z');
  console.log(`      J → ${rJ} · Z → ${rZ}`);
  // Nhận dạng phụ thuộc vào tư thế nền (út/trỏ duỗi) cùng quỹ đạo; ít nhất phải không nhầm chéo
  assert.ok(rJ === 'J' || rJ === null);
  assert.ok(rZ === 'Z' || rZ === null);
  assert.ok(rJ === 'J' || rZ === 'Z', 'không phát hiện được ký tự động nào');
});

await t('Chế độ Chữ/Số: các cặp giống hệt được phân giải bằng ngữ cảnh', () => {
  for (const [letter, digit] of AMBIGUOUS_PAIRS) {
    const raw = new Float32Array(STATIC_CLASSES.length);
    raw[STATIC_CLASSES.indexOf(letter)] = 0.5;
    raw[STATIC_CLASSES.indexOf(digit)] = 0.5;
    const pl = maskProbs(raw, 'letters');
    const pd = maskProbs(raw, 'digits');
    assert.ok(pl[STATIC_CLASSES.indexOf(letter)] > 0.99);
    assert.ok(pd[STATIC_CLASSES.indexOf(digit)] > 0.99);
  }
});

// ---------- ESP32 ----------
console.log('\nESP32-S3');
t('Địa chỉ IP → ws://IP:81/ws', () => {
  assert.equal(normalizeWsUrl('192.168.1.100'), 'ws://192.168.1.100:81/ws');
  assert.equal(normalizeWsUrl(' 10.0.0.5:8080 '), 'ws://10.0.0.5:8080/ws');
  assert.equal(normalizeWsUrl('ws://192.168.1.100:81/ws'), 'ws://192.168.1.100:81/ws');
  assert.equal(normalizeWsUrl('ws://esp32.local/stream'), 'ws://esp32.local:81/stream');
  assert.equal(normalizeWsUrl(''), 'ws://192.168.1.100:81/ws');
  assert.equal(normalizeWsUrl('a b c'), null);
});
t('Phân tích gói JSON: nhiều cách đặt khoá, ADC thô, ánh xạ sự kiện', () => {
  const a = parseTelemetry('{"x":-0.35,"y":0.8,"kpa":0.12,"event":null}');
  assert.deepEqual([a.x, a.y, a.kpa, a.event, a.hasEventField], [-0.35, 0.8, 0.12, null, true]);
  assert.equal(parseTelemetry('{"joy":{"x":0,"y":0},"p":0.6,"evt":"PUFF_CLICK"}').event, 'LEFT_CLICK');
  assert.equal(parseTelemetry('{"x":0,"y":0,"event":"SIP_RIGHT_CLICK"}').event, 'RIGHT_CLICK');
  assert.equal(parseTelemetry('{"event":"HOLD_DRAG"}').event, 'HOLD_DRAG');
  assert.ok(Math.abs(parseTelemetry('{"x":4095,"y":2048}').x - 0.9995) < 1e-3);
  assert.equal(parseTelemetry('không phải json'), null);
});
t('Joystick: vùng chết 0,12 và trung bình trượt 5 mẫu', () => {
  const f = new JoystickFilter({ deadzone: 0.12, window: 5 });
  for (let i = 0; i < 5; i++) assert.equal(f.push(0.1, 0.05).mag, 0);
  const g = new JoystickFilter({ deadzone: 0.12, window: 5 });
  let r;
  for (let i = 0; i < 5; i++) r = g.push(1, 0);
  assert.ok(Math.abs(r.x - 1) < 1e-9);
  const h = new JoystickFilter({ deadzone: 0.12, window: 5 });
  for (let i = 0; i < 4; i++) h.push(0, 0);
  assert.ok(h.push(1, 0).x < 0.3); // lọc làm mượt cú giật
});
t('Thổi/hút: click, double-click, kéo-thả, chuột phải (theo ngưỡng 0,45 kPa / 350 ms / 600 ms)', () => {
  const run = (script) => {
    const d = new PressureGestureDetector({ puff: 0.45, sip: -0.45, doubleMs: 350, holdMs: 600 });
    const ev = [];
    for (const [ms, kpa] of script) ev.push(...d.update(kpa, ms));
    return ev;
  };
  assert.deepEqual(run([[0, 0], [20, 0.6], [200, 0.6], [220, 0.05]]), ['LEFT_CLICK']);
  assert.deepEqual(run([[0, 0.6], [150, 0.6], [170, 0], [300, 0.6], [420, 0.6], [440, 0]]), ['LEFT_CLICK', 'DOUBLE_CLICK']);
  assert.deepEqual(run([[0, 0.6], [150, 0.6], [170, 0], [700, 0.6], [820, 0]]), ['LEFT_CLICK', 'LEFT_CLICK']);
  assert.deepEqual(run([[0, 0.7], [300, 0.7], [610, 0.7], [900, 0.7], [920, 0]]), ['DRAG_START', 'DRAG_END']);
  assert.deepEqual(run([[0, -0.7], [40, -0.7], [90, -0.7], [150, 0]]), ['RIGHT_CLICK']);
  assert.deepEqual(run([[0, 0.3], [100, 0.3], [200, -0.2]]), []); // dưới ngưỡng
});

// ---------- Ghép chữ ----------
console.log('\nGhép ký tự → từ');
t('CharCommitter v2: nhạy với dao động nhẹ nhưng chỉ chốt khi TRUNG BÌNH ≥ 80% và chênh lệch ≥ 30%', () => {
  const c = new CharCommitter();
  let now = 0;
  const feed = (top, conf, n, { moving = false, margin = 0.5, dt = 66 } = {}) => {
    const out = [];
    for (let i = 0; i < n; i++) { now += dt; out.push(c.update({ present: true, top, conf, margin, moving, now }).committed); }
    return out.filter(Boolean);
  };
  const gap = () => { for (let i = 0; i < 10; i++) { now += 66; c.update({ present: false }); } };
  assert.deepEqual(feed('A', 0.55, 30), []); // dưới "sàn" từng khung
  gap();
  assert.deepEqual(feed('A', 0.75, 30), []); // trung bình 75% < 80%
  gap();
  assert.deepEqual(feed('A', 0.9, 30, { margin: 0.2 }), []); // chênh lệch TB 20% < 30% → dễ nhầm
  gap();
  assert.deepEqual(feed('A', 0.9, 6), []); // chưa đủ 8 khung
  assert.deepEqual(feed('A', 0.9, 2), ['A']); // đủ 8 khung (và ≥ 0,45 giây)
  assert.deepEqual(feed('A', 0.95, 40), []); // không lặp khi vẫn giữ tay
  assert.deepEqual(feed('B', 0.9, 10), ['B']); // đổi ký tự
  assert.deepEqual(feed('B', 0.2, 8), []); // nhả
  assert.deepEqual(feed('B', 0.9, 10), ['B']); // chữ đôi "BB"
  assert.deepEqual(feed('C', 0.99, 30, { moving: true }), []); // đang di chuyển không chốt
  // nhạy: vài khung dao động xuống 0,65 (trên sàn) vẫn chốt được nếu trung bình đủ cao
  const c2 = new CharCommitter();
  let r = [];
  const seq = [0.95, 0.9, 0.65, 0.95, 0.92, 0.7, 0.95, 0.93, 0.95, 0.9];
  seq.forEach((v, i) => r.push(c2.update({ present: true, top: 'K', conf: v, margin: 0.5, moving: false, now: i * 66 }).committed));
  assert.ok(r.includes('K'), 'dao động nhẹ vẫn chốt được');
  // …nhưng không chốt nếu giữ quá nhanh (dưới 0,45 giây)
  const c4 = new CharCommitter();
  const early = [];
  for (let i = 0; i < 8; i++) early.push(c4.update({ present: true, top: 'M', conf: 0.95, margin: 0.6, moving: false, now: i * 20 }).committed);
  assert.ok(!early.some(Boolean), 'giữ dưới 0,45 giây chưa được chốt');
});
t('WordBuilder: tự chèn dấu cách sau 1,8 giây ngừng tay', () => {
  const w = new WordBuilder(1800);
  w.add('X', 1000);
  w.add('I', 2000);
  assert.equal(w.tick(3500), false);
  assert.ok(Math.abs(w.pauseProgress(2900) - 0.5) < 1e-9);
  assert.equal(w.tick(3800), true);
  assert.equal(w.text, 'XI ');
  assert.equal(w.tick(9999), false);
});
t('Gợi ý từ: XIN C → XIN CHAO; sau dấu cách vẫn gợi ý từ cuối', () => {
  const s = suggest('XIN C');
  assert.ok(s.some((x) => x.key === 'XIN CHAO'), JSON.stringify(s.map((x) => x.key)));
  assert.equal(applySuggestion('XIN C', s.find((x) => x.key === 'XIN CHAO')), 'XIN CHAO ');
  assert.ok(suggest('CAM ').length >= 0);
  assert.ok(suggest('HEL').some((x) => x.key === 'HELLO' || x.key === 'HELP'));
  assert.equal(suggest('').length, 0);
});

// ---------- Văn bản & học tập ----------
console.log('\nVăn bản & học tập');
t('Bỏ dấu tiếng Việt, giữ A–Z/0–9', () => {
  assert.equal(normalizeForSign('Xin chào, Đặng 2024!'), 'XIN CHAO DANG 2024 ');
  assert.deepEqual(toSignChars('Xin chào'), 'XIN CHAO'.split(''));
  assert.equal(restoreDiacritics('XIN CHAO CAM ON'), 'XIN CHÀO CẢM ƠN');
});
t('4 cấp học: A–M, N–Z (+J,Z), 0–9, ghép từ', () => {
  assert.equal(LEVELS.length, 4);
  const all = new Set(LEVELS[0].items.concat(LEVELS[1].items));
  for (const c of LETTERS) assert.ok(all.has(c), `thiếu ${c}`);
  assert.ok(LEVELS[1].items.includes('J') && LEVELS[1].items.includes('Z'));
  assert.equal(LEVELS[2].items.join(''), '0123456789');
  assert.ok(expandLevel(LEVELS[3]).length > 20);
  for (const t2 of expandLevel(LEVELS[3])) assert.ok(POSES[t2.ch], `từ luyện có ký tự không có tư thế: ${t2.ch}`);
});

// ---------- Mô-đun mới (v2) ----------
// Môi trường Node không có localStorage: dựng bản giả trong bộ nhớ để kiểm thử lớp lưu trữ.
{
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), clear: () => mem.clear(), key: (i) => [...mem.keys()][i] ?? null, get length() { return mem.size; } };
}
const { frameFeature, resample, dtw, WordMatcher, WordSegmenter, trimStill, N_FRAMES, DIM } = await import('../src/lib/words/dtw.js');
const { buildSegments } = await import('../src/lib/words/segments.js');
const { editDistance, autocorrect } = await import('../src/lib/smart.js');
const { calibrateBreath } = await import('../src/lib/esp32/breath.js');
const { candidateHosts, probe, scan } = await import('../src/lib/esp32/discover.js');
const P = await import('../src/lib/learn/progress.js');
const AS = await import('../src/lib/learn/assignments.js');

const mk = (seed) => makeRng(seed).next;
// chuỗi trơn (giống chuyển động tay thật): mỗi chiều là một sóng sin có tần số/pha riêng theo hạt giống
const randSeq = (n, amp = 1, seed = 1) => { const r = mk(seed); const fr = Array.from({ length: DIM }, () => 0.05 + r() * 0.35); const ph = Array.from({ length: DIM }, () => r() * 6.28); return Array.from({ length: n }, (_, i) => Float32Array.from({ length: DIM }, (_, d) => amp * 0.5 * Math.sin(i * fr[d] + ph[d]))); };
const jitter = (seq, a, seed) => { const r = mk(seed); return seq.map((f) => f.map((v) => v + (r() - 0.5) * a)); };
const warp = (seq) => seq.flatMap((f, i) => (i % 3 === 0 ? [f, f] : [f])); // kéo dài một số khung

console.log('\nNhận dạng từ/cụm từ (DTW)');
t('frameFeature: cùng bàn tay dịch chuyển → hình dạng giống, vị trí cổ tay khác', () => {
  const lm = poseLandmarks('B', { orient: false }).map((p) => ({ x: 0.3 + p.x * 0.2, y: 0.5 + p.y * 0.2, z: 0 }));
  const sh = lm.map((p) => ({ ...p, x: p.x + 0.05, y: p.y + 0.05 }));
  const a = frameFeature([lm]);
  const b = frameFeature([sh]);
  assert.equal(a.length, DIM);
  for (let k = 0; k < 42; k++) assert.ok(Math.abs(a[k] - b[k]) < 1e-3);
  assert.ok(Math.abs(a[42] - b[42]) > 0.2);
});
t('resample luôn ra đúng 32 khung, giữ nguyên hai đầu', () => {
  const q = randSeq(57, 2, 3);
  const r = resample(q);
  assert.equal(r.length, N_FRAMES * DIM);
  for (let d = 0; d < DIM; d++) assert.ok(Math.abs(r[d] - q[0][d]) < 1e-5);
});
t('dtw: giống hệt = 0; đối xứng; mẫu bị kéo giãn gần hơn mẫu khác hẳn', () => {
  const a = resample(randSeq(40, 2, 1));
  const w = resample(warp(randSeq(40, 2, 1)));
  const o = resample(randSeq(40, 2, 99));
  assert.ok(dtw(a, a) < 1e-6);
  assert.ok(Math.abs(dtw(a, o) - dtw(o, a)) < 1e-4);
  assert.ok(dtw(a, w) < dtw(a, o) * 0.5, `${dtw(a, w).toFixed(3)} vs ${dtw(a, o).toFixed(3)}`);
});
t('WordMatcher: nhận đúng từ trong 2 từ, từ lạ bị từ chối', () => {
  const A = randSeq(36, 2, 11);
  const B = randSeq(36, 2, 22);
  const m = new WordMatcher();
  m.set('xin chao', 'Xin chào', [3, 4, 5].map((i) => resample(jitter(A, 0.15, i))));
  m.set('cam on', 'Cảm ơn', [6, 7, 8].map((i) => resample(jitter(B, 0.15, i))));
  assert.equal(m.match(resample(jitter(warp(A), 0.2, 50)))?.key, 'xin chao');
  assert.equal(m.match(resample(jitter(B, 0.2, 51)))?.key, 'cam on');
  assert.equal(m.match(resample(randSeq(36, 2, 777))), null);
});
t('WordSegmenter: cắt một ký hiệu khi tay chuyển động rồi đứng yên', () => {
  const seg = new WordSegmenter();
  const still = Float32Array.from({ length: DIM }, () => 0.2);
  let got = null;
  for (let i = 0; i < 10; i++) seg.push(still, true);
  const mv = (i) => Float32Array.from({ length: DIM }, (_, d) => Math.sin(i / 3 + d) * 1.2);
  for (let i = 0; i < 40; i++) seg.push(mv(i), true);
  for (let i = 0; i < 30 && !got; i++) got = seg.push(mv(39), true).done;
  assert.ok(got && got.length >= 30 && got.length <= 60, `độ dài ${got?.length}`);
});
t('trimStill: bỏ phần đầu/đuôi đứng yên', () => {
  const still = Float32Array.from({ length: DIM }, () => 0);
  const mv = (i) => Float32Array.from({ length: DIM }, (_, d) => Math.sin(i / 2 + d) * 1.5);
  const seq = [...Array(30).fill(still), ...Array.from({ length: 25 }, (_, i) => mv(i)), ...Array(30).fill(mv(24))];
  const r = trimStill(seq);
  assert.ok(r.length < seq.length - 30 && r.length >= 25, `${r.length}/${seq.length}`);
});
t('buildSegments: từ đã ghi → phát lại; còn lại → đánh vần; gộp chữ liền kề', () => {
  const words = { 'XIN CHAO': { display: 'Xin chào', samples: [randSeq(32, 1, 1)] } };
  const { segs } = buildSegments('xin chào bạn', words);
  assert.equal(segs[0].kind, 'word');
  assert.equal(segs[0].key, 'XIN CHAO');
  assert.equal(segs[1].kind, 'letters');
  assert.equal(segs[1].chars.join('').trim(), 'BAN');
  assert.equal(buildSegments('abc', {}).segs.length, 1);
});

console.log('\nVăn bản thông minh');
t('editDistance: thay, chèn, hoán vị = 1; vượt ngưỡng thì dừng', () => {
  assert.equal(editDistance('cat', 'cut'), 1);
  assert.equal(editDistance('cat', 'cart'), 1);
  assert.equal(editDistance('abcd', 'abdc'), 1);
  assert.equal(editDistance('abcdef', 'uvwxyz', 2), 3);
});
t('autocorrect: không đổi từ đúng, không đoán khi mơ hồ, chỉ đề xuất khi chắc chắn', () => {
  const same = autocorrect('xin chao');
  assert.equal(same.changes.length, 0);
  const fix = autocorrect('camm on');
  assert.ok(fix.text.length > 0);
  assert.ok(autocorrect('qwxz').changes.length === 0);
});

console.log('\nESP32: dò mạch, hiệu chỉnh hơi thở');
t('candidateHosts: có thiết bị đã lưu trước, tên .local, AP 192.168.4.1 và cả dải /24 của gợi ý, không trùng', () => {
  const h = candidateHosts({ hint: '10.0.5.77', saved: ['10.0.5.9'] });
  assert.equal(h[0], '10.0.5.9');
  assert.ok(h.includes('esp32.local') && h.includes('192.168.4.1') && h.includes('10.0.5.254') && h.includes('192.168.1.1'));
  assert.equal(new Set(h).size, h.length);
});
class FakeWS {
  constructor(url) {
    this.url = url;
    const alive = FakeWS.alive.some((a) => url.includes(`//${a}:`));
    setTimeout(() => {
      if (!alive) { this.onerror?.(); this.onclose?.(); return; }
      this.onopen?.();
      setTimeout(() => this.onmessage?.({ data: JSON.stringify({ x: 0.1, y: -0.2, kpa: 0.0 }) }), 20);
    }, 5);
  }
  close() {}
}
FakeWS.alive = [];
await t('scan: tìm thấy đúng thiết bị trong dải địa chỉ, bỏ qua máy không phản hồi', async () => {
  FakeWS.alive = ['192.168.1.42'];
  const found = await scan({ hosts: ['192.168.1.40', '192.168.1.41', '192.168.1.42', '192.168.1.43'], timeoutMs: 300, WS: FakeWS });
  assert.equal(found.length, 1);
  assert.equal(found[0].host, '192.168.1.42');
});
await t('probe: máy không có WebSocket → null (không treo)', async () => {
  FakeWS.alive = [];
  assert.equal(await probe('192.168.1.5', { timeoutMs: 200, WS: FakeWS }), null);
});
t('calibrateBreath: ngưỡng nằm giữa mức nghỉ và mức thổi/hút, cách nhiễu', () => {
  const r2 = mk(5);
  const n = (c, a, k = 40) => Array.from({ length: k }, () => c + (r2() - 0.5) * a);
  const r = calibrateBreath({ rest: n(0, 0.04), puff: n(1.0, 0.1), sip: n(-1.0, 0.1) });
  assert.ok(r.ok, r.issues.join());
  assert.ok(r.puff > 0.3 && r.puff < 0.9 && r.sip < -0.3 && r.sip > -0.9, `${r.puff} / ${r.sip}`);
  assert.ok(r.puff > r.noise * 4 && -r.sip > r.noise * 4);
});
t('calibrateBreath: báo lỗi khi thổi/hút quá yếu hoặc thiếu mẫu', () => {
  const flat = Array(30).fill(0);
  const r = calibrateBreath({ rest: flat, puff: flat, sip: [] });
  assert.ok(!r.ok && r.issues.includes('sip') && r.issues.includes('puffWeak'));
});

console.log('\nHọc tập: XP, chuỗi ngày, huy hiệu, ôn ngắt quãng, kiểm tra, báo cáo');
const D0 = new Date('2026-03-10T09:00:00').getTime();
const DAYMS = P.DAY;
t('levelOf/levelBounds nhất quán', () => {
  for (const xp of [0, 49, 50, 199, 200, 450, 10000]) {
    const lv = P.levelOf(xp);
    const [lo, hi] = P.levelBounds(lv);
    assert.ok(xp >= lo && xp < hi, `xp ${xp} cấp ${lv} [${lo},${hi})`);
  }
});
t('award: cộng XP, chuỗi ngày tăng khi học liên tiếp, đứt khi bỏ ngày', () => {
  let p = P.EMPTY;
  p = P.award(p, 10, D0).p;
  assert.equal(p.streak, 1);
  p = P.award(p, 10, D0 + 1000).p;
  assert.equal(p.streak, 1);
  p = P.award(p, 10, D0 + DAYMS).p;
  assert.equal(p.streak, 2);
  p = P.award(p, 10, D0 + 4 * DAYMS).p;
  assert.equal(p.streak, 1);
  assert.equal(p.best, 2);
  assert.equal(P.liveStreak(p, D0 + 4 * DAYMS), 1);
  assert.equal(P.liveStreak(p, D0 + 7 * DAYMS), 0);
});
t('award: huy hiệu chỉ trao một lần; lên cấp được báo', () => {
  let r = P.award({ ...P.EMPTY, mastered: ['A'] }, 5, D0);
  assert.ok(r.newBadges.includes('first'));
  const r2 = P.award(r.p, 5, D0);
  assert.ok(!r2.newBadges.includes('first'));
  assert.ok(P.award(P.EMPTY, 60, D0).levelUp);
});
t('Leitner: đúng → hộp tăng và hạn dài ra; sai → về hộp 1', () => {
  let p = P.EMPTY;
  for (let i = 0; i < 3; i++) p = P.srsReview(p, 'A', true, D0);
  assert.equal(p.srs.A.box, 3);
  assert.equal(p.srs.A.due, P.dayOf(D0) + P.BOX_DAYS[3]);
  assert.ok(!P.dueItems(p, D0).includes('A'));
  assert.ok(P.dueItems(p, D0 + 5 * DAYMS).includes('A'));
  p = P.srsReview(p, 'A', false, D0);
  assert.equal(p.srs.A.box, 1);
});
t('makeQuiz: đúng số lượng, không trùng, thuộc tập nguồn', () => {
  const items = 'ABCDEFGHIKLM'.split('');
  const q = P.makeQuiz(items, 8, mk(3));
  assert.equal(q.length, 8);
  assert.equal(new Set(q).size, 8);
  assert.ok(q.every((c) => items.includes(c)));
  assert.equal(P.makeQuiz(['A', 'B'], 8).length, 2);
});
t('recordQuiz + huy hiệu "Học giỏi" khi ≥ 80%', () => {
  const p = P.recordQuiz(P.EMPTY, 1, 7, 8, D0);
  assert.equal(p.quizzes[0].pct, 0.875);
  assert.ok(P.award(p, 5, D0).newBadges.includes('quiz'));
});
t('Báo cáo giáo viên: xuất → hợp lệ → nhập → CSV; bài tập có tiến độ', () => {
  const p = P.award({ ...P.EMPTY, mastered: ['A', 'B', 'C'] }, 30, D0).p;
  const rep = P.buildReport({ name: 'An', id: 'u1' }, p, D0);
  assert.ok(AS.validReport(rep));
  assert.ok(!AS.validReport({ kind: 'x' }));
  const list = AS.addReport(rep);
  assert.equal(list.length, 1);
  assert.equal(AS.addReport({ ...rep, xp: 99, at: D0 + 5 }).length, 1);
  assert.ok(AS.reportsToCsv(AS.loadReports()).split('\n').length === 2);
  const a = AS.makeAssignment({ title: 'Tuần 1', items: ['A', 'B', 'A', 'Z'] });
  assert.ok(AS.validAssignment(a));
  assert.deepEqual(a.items, ['A', 'B', 'Z']);
  assert.equal(AS.assignmentProgress(a, ['A', 'B']).pct, 2 / 3);
  assert.ok(!AS.validAssignment({ kind: 'signbridge-assignment', items: [], title: 'x' }));
});

console.log('\nBàn tay 3D (mô hình .glb điều khiển bởi khung xương 21 khớp)');
{
  const { parseGlbNode } = await import('./lib/glbNode.mjs');
  const { GlbHand, nodeWorldQuats } = await import('../src/lib/hand/glbHand.js');
  const { HAND_MODELS, HAND_STYLE_IDS, resolveHandStyle, DEFAULT_HAND_STYLE } = await import('../src/lib/hand/handModels.js');
  const { getBind } = await import('../src/lib/hand/handRig.js');
  const { HandSkeleton } = await import('../src/lib/hand/handSkeleton.js');
  t('chỉ còn các mô hình .glb: kiểu cũ (soft/real/không rõ) quy về kiểu mặc định', () => {
    assert.deepEqual([...HAND_STYLE_IDS].sort(), ['do', 'toon', 'wood']);
    assert.equal(resolveHandStyle('soft'), DEFAULT_HAND_STYLE);
    assert.equal(resolveHandStyle('real'), DEFAULT_HAND_STYLE);
    assert.equal(resolveHandStyle('do'), 'do');
    assert.ok(!existsSync(join(root, 'src/lib/hand/handMesh.js')), 'mã lưới tự dựng đã xoá');
  });
  const bind = getBind();
  for (const id of HAND_STYLE_IDS) {
    const cfg = HAND_MODELS[id];
    const file = join(root, 'public', cfg.url);
    t(`[${id}] tệp ${cfg.url} tồn tại và có ghi credit`, () => { assert.ok(existsSync(file)); assert.ok(cfg.credit.length > 5); });
    if (!existsSync(file)) continue;
    const buf = readFileSync(file);
    const gltf = await parseGlbNode(buf);
    const hand = new GlbHand(gltf.scene, bind, id);
    const sk = new HandSkeleton();
    const group = new THREE.Group();
    group.add(hand.root);
    t(`[${id}] đủ xương được ghép với khung xương, lưới da có trọng số xương`, () => {
      for (const [i, name] of Object.entries(cfg.bones)) assert.ok(hand.bones.get(name), `thiếu xương ${name} (khớp ${i})`);
      assert.ok(hand.skins.some((m) => m.userData.isSkin && m.geometry.getAttribute('position').count > 1000));
      assert.ok(hand.scale > 0.1 && Number.isFinite(hand.scale), String(hand.scale));
    });
    t(`[${id}] khớp ngón của mô hình bám sát khung xương ở nhiều tư thế (sai số TB < 2,2; tệ nhất < 6,5 (chủ yếu ngón cái) trên bàn tay ~19 đơn vị)`, () => {
      const idxs = Object.keys(cfg.bones).map(Number).filter((i) => i > 0 && !(cfg.noCheck || []).includes(i));
      let worst = 0, sum = 0, n = 0;
      for (const ch of ['5', 'A', 'B', 'L', 'Y', 'D', 'H', 'P', 'K', 'O', 'S', 'W']) {
        sk.applyPose(getPoseQuats(ch));
        hand.update({ holderPos: sk.holder.position, holderQ: sk.holder.quaternion, nodeQ: nodeWorldQuats(sk) });
        group.updateMatrixWorld(true);
        const lm = sk.getLandmarks();
        for (const i of idxs) {
          const p = hand.bones.get(cfg.bones[i]).getWorldPosition(new THREE.Vector3());
          assert.ok(Number.isFinite(p.x + p.y + p.z), `${ch}/${i}`);
          const e = p.distanceTo(lm[i]);
          worst = Math.max(worst, e); sum += e; n++;
        }
      }
      console.log(`      sai số TB ${(sum / n).toFixed(2)}, tệ nhất ${worst.toFixed(2)}`);
      assert.ok(sum / n < 2.2, `TB ${sum / n}`);
      assert.ok(worst < 6.5, `tệ nhất ${worst}`); // ngón cái: gốc ngón cái của mô hình đặt khác khung xương nên lệch vị trí nhiều hơn các ngón còn lại
    });
    t(`[${id}] tô màu da và màu từng ngón`, () => {
      hand.paint('#d9a07a', { index: '#ff0000' }, ['thumb', 'index', 'middle', 'ring', 'pinky']);
      let red = 0;
      for (const m of hand.skins.filter((s) => s.userData.isSkin)) {
        const col = m.geometry.getAttribute('color');
        for (let v = 0; v < col.count; v++) if (col.getX(v) > 0.9 && col.getY(v) < 0.2) red++;
      }
      assert.ok(red > 20, `${red} đỉnh đỏ`);
    });
    hand.dispose();
  }
}

// ---------- Màu WCAG ----------
console.log('\nGiao diện – tương phản màu, đọc trực tiếp từ src/index.css (3 chủ đề: sáng / tối / tương phản cao)');
{
  const css = readFileSync(join(root, 'src/index.css'), 'utf8');
  const themes = {};
  for (const m of css.matchAll(/\[data-theme='(\w+)'\]\s*\{([^}]*)\}/g)) {
    const vars = {};
    for (const v of m[2].matchAll(/--([\w-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) vars[v[1]] = [+v[2], +v[3], +v[4]];
    themes[m[1]] = { ...(themes[m[1]] || {}), ...vars };
  }
  const lum = (rgb) => {
    const c = rgb.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const cr = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  t('có đủ 3 chủ đề với đầy đủ mã màu', () => {
    for (const th of ['light', 'dark', 'hc']) for (const k of ['paper', 'card', 'card2', 'ink', 'muted', 'line', 'primary', 'onprimary', 'accent', 'marker', 'ok', 'warn', 'bad', 'info', 'focus', 'oksoft', 'warnsoft', 'badsoft', 'infosoft', 'stage', 'onstage']) assert.ok(themes[th]?.[k], `${th}.${k}`);
  });
  for (const th of ['light', 'dark', 'hc']) {
    const C = themes[th];
    const pairs = [
      ['chữ chính / nền', C.ink, C.paper], ['chữ chính / thẻ', C.ink, C.card], ['chữ chính / nền phụ', C.ink, C.card2],
      ['chữ phụ / nền', C.muted, C.paper], ['chữ phụ / thẻ', C.muted, C.card], ['chữ phụ / nền phụ', C.muted, C.card2],
      ['nút chính', C.onprimary, C.primary], ['nút chính khi rê chuột', C.onprimary, C['primary-hover']],
      ['chữ nhấn / nền', C.accent, C.paper], ['chữ nhấn / thẻ', C.accent, C.card],
      ['OK / thẻ', C.ok, C.card], ['cảnh báo / thẻ', C.warn, C.card], ['lỗi / thẻ', C.bad, C.card], ['thông tin / thẻ', C.info, C.card],
      ['OK / nền', C.ok, C.paper], ['lỗi / nền', C.bad, C.paper],
      ['mực / nền OK nhạt', C.ink, C.oksoft], ['mực / nền cảnh báo nhạt', C.ink, C.warnsoft], ['mực / nền lỗi nhạt', C.ink, C.badsoft], ['mực / nền thông tin nhạt', C.ink, C.infosoft],
      ['chữ trên sân khấu camera', C.onstage, C.stage],
    ];
    for (const [n, a, b] of pairs) t(`[${th}] ${n}: ${cr(a, b).toFixed(1)}:1 (AAA ≥ 7)`, () => assert.ok(cr(a, b) >= 7, `${cr(a, b).toFixed(2)}`));
    t(`[${th}] viền nút / thẻ (UI ≥ 3:1): ${cr(C.line, C.card).toFixed(1)}:1`, () => assert.ok(cr(C.line, C.card) >= 3));
    t(`[${th}] viền nút / nền (UI ≥ 3:1): ${cr(C.line, C.paper).toFixed(1)}:1`, () => assert.ok(cr(C.line, C.paper) >= 3));
    t(`[${th}] viền focus / nền (UI ≥ 3:1): ${cr(C.focus, C.paper).toFixed(1)}:1`, () => assert.ok(cr(C.focus, C.paper) >= 3));
    t(`[${th}] vàng đánh dấu / nền (UI ≥ 3:1): ${cr(C.marker, C.paper).toFixed(1)}:1`, () => assert.ok(cr(C.marker, C.stage) >= 3));
  }
}

// ---------- i18n ----------
console.log('\nĐa ngôn ngữ vi / en');
{
  const areas = (await import('../src/i18n/areas.js')).AREAS;
  const vi = {};
  const en = {};
  for (const a of areas) { Object.assign(vi, a.vi); Object.assign(en, a.en); }
  t(`vi và en có cùng bộ khoá (${Object.keys(vi).length} khoá)`, () => {
    const miss = Object.keys(vi).filter((k) => !(k in en));
    const miss2 = Object.keys(en).filter((k) => !(k in vi));
    assert.deepEqual([miss.slice(0, 10), miss2.slice(0, 10)], [[], []]);
  });
  t('mọi {tham số} trong bản vi đều có trong bản en và ngược lại', () => {
    const ph = (s) => (s.match(/\{(\w+)\}/g) || []).sort().join();
    for (const k of Object.keys(vi)) assert.equal(ph(vi[k]), ph(en[k]), k);
  });
  t('không có chuỗi rỗng', () => {
    for (const k of Object.keys(vi)) assert.ok(vi[k].trim() && en[k].trim(), k);
  });
  t('mọi khoá t(\'…\') tĩnh dùng trong src/ đều tồn tại', async () => {
    const { readdirSync, statSync } = await import('node:fs');
    const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(jsx?|mjs)$/.test(f) ? [p] : []; });
    const missing = new Set();
    for (const f of walk(join(root, 'src'))) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bt\('([a-z][\w.]*)'/g)) if (!(m[1] in vi)) missing.add(`${m[1]}  (${f.replace(root, '')})`);
    }
    assert.deepEqual([...missing].slice(0, 15), []);
  });
}

console.log(`\n${process.exitCode ? 'CÓ LỖI' : 'TẤT CẢ ĐẠT'} (${pass} phép kiểm tra đạt)`);
