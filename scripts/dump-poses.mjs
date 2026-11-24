// Xuất landmark của 36 tư thế ra JSON để vẽ contact sheet kiểm tra bằng Python.
import { writeFileSync } from 'node:fs';
import { POSES } from '../src/data/poses.js';
import { getResolved, poseLandmarks } from '../src/lib/hand/poseLibrary.js';
const out = {};
for (const ch of Object.keys(POSES)) {
  const r = getResolved(ch);
  out[ch] = { front: poseLandmarks(ch, { orient: false }), orient: poseLandmarks(ch), thumbErr: r.thumbErr, thumb: r.thumb.map(Math.round) };
}
writeFileSync(process.argv[2] || '/tmp/poses.json', JSON.stringify(out));
const bad = Object.entries(out).filter(([, v]) => v.thumbErr > 0.6).map(([k, v]) => k + ':' + v.thumbErr.toFixed(2));
console.log('Poses:', Object.keys(out).length, '| thumb IK error > 0.6cm:', bad.join(' ') || 'none');
