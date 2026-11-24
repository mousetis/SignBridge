// Chuyển "đặc tả tư thế" (góc gập từng ngón + đích của đầu ngón cái) thành quaternion từng khớp.
// Ngón cái được giải bằng IK đơn giản (tìm kiếm mẫu) để đầu ngón cái chạm đúng vị trí mong muốn.
import * as THREE from 'three';
import { FINGERS, JOINT_NAMES, HandSkeleton, LM } from './handSkeleton.js';

const D2R = Math.PI / 180;
const AX = new THREE.Vector3(1, 0, 0);
const AY = new THREE.Vector3(0, 1, 0);
const AZ = new THREE.Vector3(0, 0, 1);
const qAxis = (axis, deg) => new THREE.Quaternion().setFromAxisAngle(axis, deg * D2R);

// ---------- Ngón thường: [mcp, pip, dip, nghiêng sang +X (độ)] ----------
export function fingerQuats([mcp, pip, dip, lean = 0]) {
  const qm = qAxis(AZ, -lean).multiply(qAxis(AX, mcp));
  return [qm, qAxis(AX, pip), qAxis(AX, dip)];
}

// ---------- Ngón cái: [cmcFlex, cmcAbd, cmcTwist, mcpFlex, mcpAbd, ipFlex] ----------
const THUMB_BASE = qAxis(AZ, -35).multiply(qAxis(AX, 15));
export const THUMB_NATURAL = [0, 10, 0, 5, 0, 5];
export const THUMB_LO = [-20, -20, -100, -10, -30, -20];
export const THUMB_HI = [80, 85, 100, 85, 30, 90];
export function thumbQuats(p) {
  const qc = THUMB_BASE.clone()
    .multiply(qAxis(AZ, -p[1]))
    .multiply(qAxis(AX, p[0]))
    .multiply(qAxis(AY, p[2]));
  const qm = qAxis(AZ, -p[4]).multiply(qAxis(AX, p[3]));
  const qi = qAxis(AX, p[5]);
  return [qc, qm, qi];
}

export function quatFromOps(ops = []) {
  const q = new THREE.Quaternion();
  for (const [axis, deg] of ops) {
    const a = axis === 'x' ? AX : axis === 'y' ? AY : AZ;
    q.premultiply(qAxis(a, deg)); // áp dụng lần lượt trong hệ trục cố định
  }
  return q;
}

// ---------- Giải IK ngón cái ----------
let scratch = null;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function palmPos(sk, idx, out) {
  const e = sk.nodes[idx].matrixWorld.elements;
  const w = sk.root.matrixWorld.elements;
  return out.set(e[12] - w[12], e[13] - w[13], e[14] - w[14]);
}

function patternSearch(cost, x0, lo, hi) {
  let x = x0.slice();
  let fx = cost(x);
  let step = 14;
  for (let it = 0; it < 200 && step > 0.25; it++) {
    let improved = false;
    for (let i = 0; i < x.length && !improved; i++) {
      for (const s of [step, -step]) {
        const y = x.slice();
        y[i] = clamp(y[i] + s, lo[i], hi[i]);
        if (y[i] === x[i]) continue;
        const fy = cost(y);
        if (fy < fx - 1e-9) {
          x = y;
          fx = fy;
          improved = true;
          break;
        }
      }
    }
    if (!improved) step *= 0.6;
  }
  return { x, fx };
}

function solveThumb(sk, target) {
  const tgt = new THREE.Vector3(...target);
  const tip = new THREE.Vector3();
  const cost = (p) => {
    const [qc, qm, qi] = thumbQuats(p);
    sk.joints.thumb_cmc.quaternion.copy(qc);
    sk.joints.thumb_mcp.quaternion.copy(qm);
    sk.joints.thumb_ip.quaternion.copy(qi);
    sk.joints.thumb_cmc.updateMatrixWorld(true);
    palmPos(sk, LM.THUMB[3], tip);
    let reg = 0;
    for (let i = 0; i < 6; i++) reg += ((p[i] - THUMB_NATURAL[i]) / 90) ** 2;
    return tip.distanceToSquared(tgt) + 0.15 * reg;
  };
  const starts = [THUMB_NATURAL, [40, 30, 0, 40, 0, 40], [0, 60, 0, 0, 0, 0], [35, 25, 10, 60, 0, 60], [55, 40, -10, 20, 0, 20]];
  let best = null;
  for (const s of starts) {
    const r = patternSearch(cost, s, THUMB_LO, THUMB_HI);
    if (!best || r.fx < best.fx) best = r;
  }
  // Khởi động lại ngẫu nhiên (cố định hạt giống => kết quả luôn giống nhau)
  const rng = makeRng(7);
  for (let k = 0; k < 24 && best.fx > 0.01; k++) {
    const s = best.x.map((v, i) => clamp(v + rng.gauss() * 35, THUMB_LO[i], THUMB_HI[i]));
    const r = patternSearch(cost, s, THUMB_LO, THUMB_HI);
    if (r.fx < best.fx) best = r;
  }
  cost(best.x);
  const err = tip.distanceTo(tgt);
  return { params: best.x, err };
}

/**
 * Giải đặc tả -> "resolved": { fingers: {name:[mcp,pip,dip,lean]}, thumb:[6], orientOps, thumbErr }
 * spec.thumb có thể là: [x,y,z] | { touch, part, off } | { params:[6] }
 */
export function resolvePose(spec) {
  if (!scratch) scratch = new HandSkeleton();
  const sk = scratch;
  const fingers = {};
  for (const f of FINGERS) fingers[f] = (spec.fingers[f] || [0, 0, 0, 0]).slice();
  const q = { joints: {}, orient: new THREE.Quaternion() };
  FINGERS.forEach((f) => {
    const [a, b, c] = fingerQuats(fingers[f]);
    q.joints[`${f}_mcp`] = a;
    q.joints[`${f}_pip`] = b;
    q.joints[`${f}_dip`] = c;
  });
  const th = spec.thumb;
  let thumb;
  let thumbErr = 0;
  if (th && th.params) {
    thumb = th.params.slice();
  } else {
    for (const f of FINGERS) {
      sk.joints[`${f}_mcp`].quaternion.copy(q.joints[`${f}_mcp`]);
      sk.joints[`${f}_pip`].quaternion.copy(q.joints[`${f}_pip`]);
      sk.joints[`${f}_dip`].quaternion.copy(q.joints[`${f}_dip`]);
    }
    sk.holder.quaternion.identity();
    sk.holder.position.set(0, 0, 0);
    sk.holder.updateMatrixWorld(true);
    let target = th;
    if (th && !Array.isArray(th) && th.touch) {
      const idx = { tip: 3, dip: 2, pip: 1, mcp: 0 }[th.part || 'tip'];
      const p = palmPos(sk, LM[th.touch][idx], new THREE.Vector3());
      const o = th.off || [0, 0, 0];
      target = [p.x + o[0], p.y + o[1], p.z + o[2]];
    }
    const r = solveThumb(sk, target || [7, 4, 1]);
    thumb = r.params;
    thumbErr = r.err;
  }
  return { fingers, thumb, orientOps: spec.orient || [], thumbErr };
}

export function resolvedToQuats(res) {
  const joints = {};
  for (const f of FINGERS) {
    const [a, b, c] = fingerQuats(res.fingers[f]);
    joints[`${f}_mcp`] = a;
    joints[`${f}_pip`] = b;
    joints[`${f}_dip`] = c;
  }
  const [tc, tm, ti] = thumbQuats(res.thumb);
  joints.thumb_cmc = tc;
  joints.thumb_mcp = tm;
  joints.thumb_ip = ti;
  return { joints, orient: quatFromOps(res.orientOps) };
}

/** Nội suy Quaternion SLERP giữa hai tư thế (từng khớp + hướng chung). */
export function blendPoses(a, b, t, out) {
  const res = out || { joints: {}, orient: new THREE.Quaternion() };
  for (const n of JOINT_NAMES) {
    if (!res.joints[n]) res.joints[n] = new THREE.Quaternion();
    res.joints[n].slerpQuaternions(a.joints[n], b.joints[n], t);
  }
  res.orient.slerpQuaternions(a.orient, b.orient, t);
  return res;
}

// ---------- RNG & nhiễu (dùng cho dữ liệu huấn luyện tổng hợp) ----------
export function makeRng(seed = 1) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => {
    const u = Math.max(next(), 1e-9);
    const v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return { next, gauss, range: (a, b) => a + (b - a) * next() };
}

export function jitterResolved(res, rng, k = 1) {
  const fingers = {};
  for (const f of FINGERS) {
    const [m, p, d, l] = res.fingers[f];
    fingers[f] = [
      clamp(m + rng.gauss() * 6 * k, -10, 100),
      clamp(p + rng.gauss() * 8 * k, -5, 115),
      clamp(d + rng.gauss() * 7 * k, -5, 90),
      l + rng.gauss() * 4 * k,
    ];
  }
  const thumb = res.thumb.map((v, i) => clamp(v + rng.gauss() * 6 * k, THUMB_LO[i], THUMB_HI[i]));
  return { ...res, fingers, thumb };
}

export function randomTilt(rng, k = 1) {
  const cl = (v, m) => clamp(v, -m, m);
  return new THREE.Quaternion().setFromEuler(
    new THREE.Euler(cl(rng.gauss() * 12 * k, 30) * D2R, cl(rng.gauss() * 14 * k, 35) * D2R, cl(rng.gauss() * 10 * k, 25) * D2R, 'XYZ'),
  );
}

// ---------- Chuyển động của ký tự động J và Z ----------
// Trả về vị trí dịch chuyển (cm) của cả bàn tay tại thời điểm u∈[0,1] và khớp đầu ngón để vẽ vệt.
const ease = (u) => u * u * (3 - 2 * u);
function polyline(points, u) {
  const lens = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const l = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    lens.push(l);
    total += l;
  }
  let d = ease(u) * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const t = lens[i] ? Math.min(1, d / lens[i]) : 0;
      return [
        points[i][0] + (points[i + 1][0] - points[i][0]) * t,
        points[i][1] + (points[i + 1][1] - points[i][1]) * t,
      ];
    }
    d -= lens[i];
  }
  return points[points.length - 1];
}

export const DYNAMIC_INFO = {
  J: { tipLandmark: 20, base: 'I' }, // ngón út vẽ nét móc
  Z: { tipLandmark: 8, base: 'Z_BASE' }, // ngón trỏ vẽ ziczac
};

export function dynamicOffset(ch, u) {
  if (ch === 'J') {
    // thân thẳng đi xuống rồi móc sang trái
    const stem = 0.55;
    if (u < stem) return [0, -9 * ease(u / stem), 0];
    const s = (u - stem) / (1 - stem);
    const th = -Math.PI * 0.9 * ease(s);
    const cx = -3.6;
    return [cx + 3.6 * Math.cos(th), -9 + 3.6 * Math.sin(th), 0];
  }
  if (ch === 'Z') {
    const [x, y] = polyline([[-3.5, 3], [3.5, 3], [-3.5, -5], [3.5, -5]], u);
    return [x, y, 0];
  }
  return [0, 0, 0];
}
