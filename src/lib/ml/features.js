// Trích xuất đặc trưng từ 21 điểm khớp (landmark) của MediaPipe Hands.
// Quy ước đầu vào: mảng 21 phần tử {x,y,z} theo KHÔNG GIAN ẢNH (pixel; z cùng tỉ lệ với x),
// giống toạ độ MediaPipe (x phải, y xuống, z âm = gần camera).
import { FINGERS, LM } from '../hand/handSkeleton.js';

const sub = (a, b) => [a.x - b.x, a.y - b.y, a.z - b.z];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const dist = (a, b) => len(sub(a, b));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function angleDeg(u, w) {
  const d = len(u) * len(w);
  if (d < 1e-9) return 0;
  return (Math.acos(clamp((u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / d, -1, 1)) * 180) / Math.PI;
}

export function toPixelSpace(lm, W, H) {
  return lm.map((p) => ({ x: p.x * W, y: p.y * H, z: p.z * W }));
}

/** Kích thước lòng bàn tay = khoảng cách cổ tay → gốc ngón giữa (khớp 0 → 9). */
export function palmScale(lm) {
  return Math.max(dist(lm[0], lm[9]), 1e-6);
}

/** Vector 63 số: (landmark − cổ tay) / kích thước lòng bàn tay → bất biến vị trí & khoảng cách tới camera. */
export function normalizeLandmarks(lm, out = new Float32Array(63)) {
  const s = palmScale(lm);
  const w = lm[0];
  for (let i = 0; i < 21; i++) {
    out[i * 3] = (lm[i].x - w.x) / s;
    out[i * 3 + 1] = (lm[i].y - w.y) / s;
    out[i * 3 + 2] = (lm[i].z - w.z) / s;
  }
  return out;
}

export function mirrorFeatures(f) {
  const o = new Float32Array(f.length);
  for (let i = 0; i < f.length; i += 3) {
    o[i] = -f[i];
    o[i + 1] = f[i + 1];
    o[i + 2] = f[i + 2];
  }
  return o;
}

// ----- Góc gập từng ngón (độ; 0 = duỗi thẳng) -----
export function fingerFlex(lm, f) {
  const [mcp, pip, dip, tip] = LM[f];
  return [
    angleDeg(sub(lm[mcp], lm[0]), sub(lm[pip], lm[mcp])),
    angleDeg(sub(lm[pip], lm[mcp]), sub(lm[dip], lm[pip])),
    angleDeg(sub(lm[dip], lm[pip]), sub(lm[tip], lm[dip])),
  ];
}
export function thumbFlex(lm) {
  const [cmc, mcp, ip, tip] = LM.THUMB;
  return [angleDeg(sub(lm[mcp], lm[cmc]), sub(lm[ip], lm[mcp])), angleDeg(sub(lm[ip], lm[mcp]), sub(lm[tip], lm[ip]))];
}

/** Độ gập 0 (duỗi) → 1 (gập chặt) của 4 ngón + ngón cái. */
export function fingerCurls(lm) {
  const out = {};
  for (const f of FINGERS) out[f] = clamp(fingerFlex(lm, f).reduce((a, b) => a + b, 0) / 230, 0, 1);
  out.thumb = clamp(thumbFlex(lm).reduce((a, b) => a + b, 0) / 120, 0, 1);
  return out;
}

// ----- Mô tả tư thế bất biến theo hướng bàn tay & bên trái/phải -----
export function poseDescriptor(lm) {
  const s = palmScale(lm);
  const d = (a, b) => dist(lm[a], lm[b]) / s;
  const flex = {};
  for (const f of FINGERS) flex[f] = fingerFlex(lm, f);
  return {
    flex,
    thumbFlex: thumbFlex(lm),
    gaps: [d(8, 12), d(12, 16), d(16, 20)],
    thumbDist: [d(4, 8), d(4, 12), d(4, 16), d(4, 20), d(4, 5), d(4, 9), d(4, 13), d(4, 17)],
  };
}

const sAng = (diff) => clamp(1 - Math.max(0, Math.abs(diff) - 14) / 50, 0, 1);
const sDist = (diff, tol) => clamp(1 - Math.max(0, Math.abs(diff) - tol) / (tol * 4), 0, 1);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

/** So khớp tư thế người dùng với tư thế mẫu → điểm 0..1 cho từng ngón và tổng thể. */
export function comparePose(user, target) {
  const per = {};
  const gapScore = user.gaps.map((g, i) => sDist(g - target.gaps[i], 0.15));
  const gapOf = { index: [0], middle: [0, 1], ring: [1, 2], pinky: [2] };
  for (const f of FINGERS) {
    const angles = mean(user.flex[f].map((a, i) => sAng(a - target.flex[f][i])));
    const gaps = mean(gapOf[f].map((i) => gapScore[i]));
    per[f] = 0.78 * angles + 0.22 * gaps;
  }
  const ta = mean(user.thumbFlex.map((a, i) => sAng(a - target.thumbFlex[i])));
  const td = mean(user.thumbDist.map((v, i) => sDist(v - target.thumbDist[i], 0.14)));
  per.thumb = 0.3 * ta + 0.7 * td;
  const vals = Object.values(per);
  const overall = 0.6 * mean(vals) + 0.4 * Math.min(...vals);
  return { overall, per };
}
