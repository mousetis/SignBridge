// Đọc các tệp CSV landmark bàn tay THẬT (MediaPipe) -> mẫu đã chuẩn hoá 63 chiều.
// Mỗi dòng: label,x0,y0,z0,...,x20,y20,z20 (đã tịnh tiến về cổ tay). Ta chuẩn hoá lại theo kích thước lòng bàn tay.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeLandmarks } from '../../src/lib/ml/features.js';

export const DATASETS = {
  train: 'landmarks_train.csv', // Kaggle ASL Alphabet: A–Z (J, Z tĩnh), del, space
  aslhg: 'landmarks_aslhg.csv', // ASL-HG: 0–9, A–Z
  alpha: 'landmarks_signalphaset.csv', // SignAlphaSet: A–Z
};

export function loadDataset(dir, key, { keep } = {}) {
  const file = join(dir, DATASETS[key]);
  if (!existsSync(file)) throw new Error(`Thiếu ${file}`);
  const lines = readFileSync(file, 'utf8').split('\n');
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const ln = lines[i];
    if (!ln) continue;
    const parts = ln.split(',');
    const label = parts[0];
    if (keep && !keep.has(label)) continue;
    if (parts.length < 64) continue;
    const lm = [];
    let bad = false;
    for (let j = 0; j < 21; j++) {
      const x = +parts[1 + j * 3];
      const y = +parts[2 + j * 3];
      const z = +parts[3 + j * 3];
      if (!Number.isFinite(x + y + z)) { bad = true; break; }
      lm.push({ x, y, z });
    }
    if (bad) continue;
    // bỏ mẫu suy biến (lòng bàn tay ~0)
    const dx = lm[9].x - lm[0].x, dy = lm[9].y - lm[0].y, dz = lm[9].z - lm[0].z;
    if (Math.hypot(dx, dy, dz) < 1e-3) continue;
    out.push({ label, lm, ds: key });
  }
  return out;
}

export function toXY(samples, classes) {
  const xs = new Float32Array(samples.length * 63);
  const ys = new Int32Array(samples.length);
  samples.forEach((s, i) => {
    normalizeLandmarks(s.lm, xs.subarray(i * 63, (i + 1) * 63));
    ys[i] = classes.indexOf(s.label);
  });
  return { xs, ys, count: samples.length, classes };
}
