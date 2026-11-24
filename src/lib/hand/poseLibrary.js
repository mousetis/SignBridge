// Kho tư thế: giải đặc tả từ data/poses.js (có cache) + tiện ích sinh landmark.
import * as THREE from 'three';
import { POSES, REST_POSE } from '../../data/poses.js';
import { HandSkeleton, FINGERS } from './handSkeleton.js';
import { resolvePose, resolvedToQuats, jitterResolved, randomTilt } from './handPose.js';

const resolvedCache = new Map();
const quatCache = new Map();
let sharedSkeleton = null;

export function getSkeleton() {
  if (!sharedSkeleton) sharedSkeleton = new HandSkeleton();
  return sharedSkeleton;
}

export function getResolved(ch) {
  const key = String(ch).toUpperCase();
  if (!resolvedCache.has(key)) {
    const spec = key === 'REST' ? REST_POSE : POSES[key];
    if (!spec) throw new Error('Không có tư thế cho ký tự: ' + ch);
    resolvedCache.set(key, resolvePose(spec));
  }
  return resolvedCache.get(key);
}

export function getPoseQuats(ch) {
  const key = String(ch).toUpperCase();
  if (!quatCache.has(key)) quatCache.set(key, resolvedToQuats(getResolved(key)));
  return quatCache.get(key);
}

export function getNeutralQuats() {
  return getPoseQuats('5');
}

/** Trạng thái duỗi/gập mong muốn của từng ngón (0 duỗi → 1 gập) để tô màu hướng dẫn. */
export function expectedCurl(ch) {
  const r = getResolved(ch);
  const out = {};
  for (const f of FINGERS) {
    const [m, p, d] = r.fingers[f];
    out[f] = Math.min(1, Math.max(0, (m + p + d) / 230));
  }
  const t = r.thumb;
  // Ngón cái: coi là "gập" khi đầu ngón nằm gần lòng bàn tay (gập MCP/IP lớn hoặc CMC gập mạnh)
  out.thumb = Math.min(1, Math.max(0, (t[0] + t[3] + t[5]) / 160));
  return out;
}

/** Sinh 21 landmark (toạ độ kiểu MediaPipe: x phải, y xuống, z âm = gần camera). */
export function poseLandmarks(ch, { rng = null, jitter = 0, tilt = 0, orient = true } = {}) {
  const sk = getSkeleton();
  let res = getResolved(ch);
  if (rng && jitter > 0) res = jitterResolved(res, rng, jitter);
  const q = resolvedToQuats(res);
  if (!orient) q.orient.identity();
  if (rng && tilt > 0) q.orient.premultiply(randomTilt(rng, tilt));
  sk.applyPose(q);
  const lm = sk.getLandmarks();
  return lm.map((v) => ({ x: v.x, y: -v.y, z: -v.z }));
}
