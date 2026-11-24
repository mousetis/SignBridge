// Tăng cường dữ liệu landmark thật: xoay 3D nhẹ, đổi tỉ lệ độ sâu, phóng/thu, nhiễu khớp, lật trái-phải.
import { normalizeLandmarks } from '../../src/lib/ml/features.js';

export function makeRng(seed = 1) {
  let s = seed >>> 0;
  const next = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const gauss = () => Math.sqrt(-2 * Math.log(next() + 1e-12)) * Math.cos(2 * Math.PI * next());
  return { next, gauss, range: (a, b) => a + (b - a) * next() };
}

function rotMat(rx, ry, rz) {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(rx), Math.sin(rx), Math.cos(ry), Math.sin(ry), Math.cos(rz), Math.sin(rz)];
  // Rz * Ry * Rx
  return [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx],
  ];
}

/** lm: 21 điểm {x,y,z} -> vector 63 chiều đã chuẩn hoá, có xoay/nhiễu ngẫu nhiên. */
export function augmentFeatures(lm, rng, { tilt = 0.4, noise = 0.02, mirror = false } = {}) {
  const R = rotMat(rng.gauss() * tilt * 0.6, rng.gauss() * tilt * 0.6, rng.gauss() * tilt);
  const zs = rng.range(0.6, 1.5);
  const sc = rng.range(0.92, 1.08);
  const w = lm[0];
  const pts = lm.map((p) => {
    const v = [p.x - w.x, p.y - w.y, p.z - w.z];
    const x = R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2];
    const y = R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2];
    const z = (R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2]) * zs;
    return { x: (mirror ? -x : x) * sc + rng.gauss() * noise, y: y * sc + rng.gauss() * noise, z: z * sc + rng.gauss() * noise };
  });
  return normalizeLandmarks(pts);
}
