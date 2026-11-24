// Sinh dữ liệu huấn luyện TỔNG HỢP từ chính mô hình khung xương 3D (không cần thu thập dữ liệu thật để chạy thử).
// Độ chính xác trên bàn tay thật cần được cải thiện bằng trang "Hiệu chỉnh AI" (thu mẫu thật + huấn luyện lại).
import { makeRng } from '../hand/handPose.js';
import { poseLandmarks } from '../hand/poseLibrary.js';
import { normalizeLandmarks, mirrorFeatures } from './features.js';
import { STATIC_CLASSES } from '../../config/systemConfig.js';

export const SEQ_LEN = 20;
export const DYN_CLASSES = ['J', 'Z', 'NONE']; // NONE = lớp nội bộ để tránh kích hoạt nhầm

export function noisyFeatures(ch, rng, { jitter = 1, tilt = 1, noise = 0.03 } = {}) {
  const lm = poseLandmarks(ch, { rng, jitter, tilt });
  const s = 9.3; // ~ kích thước lòng bàn tay (cm) trong mô hình
  const noisy = lm.map((p) => ({
    x: p.x + rng.gauss() * noise * s,
    y: p.y + rng.gauss() * noise * s,
    z: p.z + rng.gauss() * noise * s * 2.2,
  }));
  return normalizeLandmarks(noisy);
}

export function makeStaticDataset({ perClass = 300, seed = 1, classes = STATIC_CLASSES, mirror = true } = {}) {
  const rng = makeRng(seed);
  const n = classes.length * perClass * (mirror ? 2 : 1);
  const xs = new Float32Array(n * 63);
  const ys = new Int32Array(n);
  let k = 0;
  classes.forEach((ch, ci) => {
    for (let i = 0; i < perClass; i++) {
      const f = noisyFeatures(ch, rng, { jitter: 1, tilt: 1, noise: rng.range(0.01, 0.045) });
      xs.set(f, k * 63);
      ys[k++] = ci;
      if (mirror) {
        xs.set(mirrorFeatures(f), k * 63);
        ys[k++] = ci;
      }
    }
  });
  return { xs, ys, count: n, classes };
}

// ---------- Quỹ đạo động ----------
// Toạ độ theo "đơn vị lòng bàn tay", y hướng xuống (như ảnh).
function bez(points, u) {
  // đường gấp khúc theo độ dài cung
  const lens = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const l = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    lens.push(l);
    total += l;
  }
  let d = u * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const t = lens[i] ? Math.min(1, d / lens[i]) : 0;
      return [points[i][0] + (points[i + 1][0] - points[i][0]) * t, points[i][1] + (points[i + 1][1] - points[i][1]) * t];
    }
    d -= lens[i];
  }
  return points[points.length - 1];
}

function jPath(u) {
  const stem = 0.55;
  if (u < stem) return [0, 1.0 * (u / stem)];
  const s = (u - stem) / (1 - stem);
  const th = Math.PI * 0.9 * s; // móc sang trái
  return [-0.42 + 0.42 * Math.cos(th), 1.0 + 0.42 * Math.sin(th)];
}
const zPts = [[-0.45, 0], [0.45, 0], [-0.45, 1.0], [0.45, 1.0]];
const zPath = (u) => bez(zPts, u);

function rot(p, a) {
  return [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
}

/** Một chuỗi SEQ_LEN điểm (x,y) theo lớp 'J' | 'Z' | 'NONE'. */
export function synthTrajectory(cls, rng) {
  const scale = rng.range(0.55, 1.9);
  const angle = rng.gauss() * 0.18;
  const flip = rng.next() < 0.5 ? -1 : 1; // tay trái / phải
  const pts = [];
  const dur = Math.round(rng.range(11, SEQ_LEN));
  const start = Math.floor(rng.range(0, SEQ_LEN - dur + 1));
  const drift = [rng.gauss() * 0.01, rng.gauss() * 0.01];
  const gesture = (u) => {
    if (cls === 'J') return jPath(u);
    if (cls === 'Z') return zPath(u);
    return [0, 0];
  };

  if (cls === 'NONE') {
    const kind = Math.floor(rng.range(0, 7));
    const A = rng.range(0.05, 1.2);
    const dir = rng.range(0, Math.PI * 2);
    for (let t = 0; t < SEQ_LEN; t++) {
      const u = t / (SEQ_LEN - 1);
      let p;
      if (kind === 0) p = [0, 0]; // đứng yên
      else if (kind === 1) p = [Math.cos(dir) * A * u, Math.sin(dir) * A * u]; // đường thẳng
      else if (kind === 2) p = [Math.cos(dir) * A * Math.sin(u * Math.PI * rng.range(2, 6)) * 0.5, Math.sin(dir) * A * Math.sin(u * Math.PI * 4) * 0.5]; // lắc
      else if (kind === 3) p = [Math.cos(u * Math.PI * 2) * A * 0.5 - A * 0.5, Math.sin(u * Math.PI * 2) * A * 0.5]; // vòng tròn
      else if (kind === 4) p = jPath(Math.min(0.55, u * 0.6)).map((v) => v * A); // chỉ thân J (chưa móc)
      else if (kind === 5) p = bez(zPts.slice(0, 2), u).map((v) => v * A * 1.2); // chỉ nét ngang đầu của Z
      else p = [rng.gauss() * 0.08 * t * 0.3, rng.gauss() * 0.08 * t * 0.3]; // trôi ngẫu nhiên
      pts.push(p);
    }
  } else {
    for (let t = 0; t < SEQ_LEN; t++) {
      const u = t < start ? 0 : t >= start + dur ? 1 : (t - start) / dur;
      pts.push(gesture(u));
    }
  }
  const p0 = pts[0];
  return pts.map((p, t) => {
    const r = rot([(p[0] - p0[0]) * scale * flip, (p[1] - p0[1]) * scale], angle);
    return [r[0] + drift[0] * t + rng.gauss() * 0.012, r[1] + drift[1] * t + rng.gauss() * 0.012];
  });
}

/** Đặc trưng LSTM: (x, y, vx, vy) mỗi bước. */
export function trajectoryToFeatures(traj) {
  const out = new Float32Array(SEQ_LEN * 4);
  for (let t = 0; t < SEQ_LEN; t++) {
    const prev = traj[Math.max(0, t - 1)];
    out[t * 4] = traj[t][0];
    out[t * 4 + 1] = traj[t][1];
    out[t * 4 + 2] = (traj[t][0] - prev[0]) * 3;
    out[t * 4 + 3] = (traj[t][1] - prev[1]) * 3;
  }
  return out;
}

export function makeDynamicDataset({ perClass = 700, seed = 3 } = {}) {
  const rng = makeRng(seed);
  const n = perClass * DYN_CLASSES.length;
  const xs = new Float32Array(n * SEQ_LEN * 4);
  const ys = new Int32Array(n);
  let k = 0;
  DYN_CLASSES.forEach((c, ci) => {
    for (let i = 0; i < perClass; i++) {
      xs.set(trajectoryToFeatures(synthTrajectory(c, rng)), k * SEQ_LEN * 4);
      ys[k++] = ci;
    }
  });
  return { xs, ys, count: n, classes: DYN_CLASSES };
}
