// Bàn tay 3D (Three.js): khung xương 21 khớp (HandSkeleton) điều khiển một mô hình bàn tay .glb (xem handModels.js / glbHand.js).
// Có đổi tay trái/phải bằng phản chiếu, nhiều tông da, tô màu từng ngón, vệt chuyển động cho J/Z.
import * as THREE from 'three';
import { HandSkeleton, FINGER_NAMES } from './handSkeleton.js';
import { resolvePose, resolvedToQuats } from './handPose.js';
import { GlbHand, nodeWorldQuats } from './glbHand.js';
import { loadGlbTemplate } from './glbLoader.js';
import { HAND_MODELS, HAND_STYLE_IDS, DEFAULT_HAND_STYLE, resolveHandStyle } from './handModels.js';

export const SKINS = [
  { id: 0, name: 'skin0', hex: '#f6d5bd' },
  { id: 1, name: 'skin1', hex: '#ecbf9c' },
  { id: 2, name: 'skin2', hex: '#d9a07a' },
  { id: 3, name: 'skin3', hex: '#b97d57' },
  { id: 4, name: 'skin4', hex: '#8c5a3c' },
  { id: 5, name: 'skin5', hex: '#5e3a26' },
];
export const SKIN = SKINS[2].hex;

let bindInfo = null;
export function getBind() {
  if (!bindInfo) {
    const sk = new HandSkeleton();
    // bàn tay mở, các ngón xoè nhẹ, ngón cái duỗi chếch ra ngoài: tư thế gắn xương
    const q = resolvedToQuats(resolvePose({ fingers: { index: [0, 0, 0, 8], middle: [0, 0, 0, 2], ring: [0, 0, 0, -6], pinky: [0, 0, 0, -14] }, thumb: [7.2, 7.4, 1.2] }));
    q.orient.identity();
    sk.applyPose(q);
    const lm = sk.getLandmarks();
    const w = lm[0].clone();
    bindInfo = { quats: q, pos: lm.map((v) => [v.x - w.x, v.y - w.y, v.z - w.z]), worldQ: nodeWorldQuats(sk) };
  }
  return bindInfo;
}
export { HAND_STYLE_IDS, DEFAULT_HAND_STYLE, resolveHandStyle };

export class HandRig {
  constructor({ skin = 2, side = 'right', style = DEFAULT_HAND_STYLE } = {}) {
    this.skeleton = new HandSkeleton();
    this.holder = this.skeleton.holder;
    this.group = new THREE.Group(); // gốc để thêm vào cảnh; scale.x = -1 khi là tay trái
    this.group.add(this.holder);
    this.opts = { skin, side, style: resolveHandStyle(style) };
    this.skinHex = SKINS[skin]?.hex || SKIN;
    this.fingerColors = null;
    this.glbs = new Map(); // id kiểu → GlbHand đã dựng
    this.glb = null; // bàn tay đang hiển thị (null khi đang tải)
    this.skeleton.applyPose(getBind().quats);
    this.group.updateMatrixWorld(true);
    this._buildTrail();
    this.setSide(side);
    this.ready = this._ensureGlb();
  }

  /** Nạp mô hình .glb của kiểu hiện tại (một lần) rồi chuyển sang dùng nó. Trả về Promise xong khi đã hiển thị. */
  _ensureGlb() {
    const id = this.opts.style;
    if (this.glbs.has(id)) { this._show(id); return Promise.resolve(); }
    return loadGlbTemplate(id).then((tpl) => {
      if (this.disposed) return;
      if (!this.glbs.has(id)) {
        const g = new GlbHand(tpl, getBind(), id);
        g.root.visible = false;
        this.group.add(g.root);
        this.glbs.set(id, g);
      }
      if (this.opts.style === id) this._show(id);
    }, () => {});
  }

  _show(id) {
    for (const [k, g] of this.glbs) g.root.visible = k === id;
    this.glb = this.glbs.get(id) || null;
    this._paint();
    if (this._last) this.setPose(this._last.pose, this._last.extra);
  }

  setStyle(style) {
    const st = resolveHandStyle(style);
    if (st === this.opts.style) return this.ready || Promise.resolve();
    this.opts.style = st;
    this.ready = this._ensureGlb();
    return this.ready;
  }

  /** Phần mô hình nhô xuống dưới cổ tay (đơn vị khung xương) — để khung ảnh chụp vừa. */
  get belowWrist() { return HAND_MODELS[this.opts.style].belowWrist; }
  get framePad() { return HAND_MODELS[this.opts.style].framePad ?? 1.4; }
  get credit() { return HAND_MODELS[this.opts.style].credit; }

  /** Tô màu: màu da + màu hướng dẫn từng ngón. */
  _paint() {
    this.glb?.paint(this.skinHex, this.fingerColors, FINGER_NAMES);
  }

  _buildTrail() {
    const geo = new THREE.SphereGeometry(0.3, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color: '#FFC93C' });
    this.trail = new THREE.InstancedMesh(geo, mat, 220);
    this.trail.count = 0;
    this.trail.frustumCulled = false;
    this._trailN = 0;
    this._m4 = new THREE.Matrix4();
  }

  pushTrail(idx) {
    if (this._trailN >= 220) return;
    const e = this.skeleton.nodes[idx].matrixWorld.elements;
    this._m4.makeTranslation(e[12], e[13], e[14]);
    this.trail.setMatrixAt(this._trailN++, this._m4);
    this.trail.count = this._trailN;
    this.trail.instanceMatrix.needsUpdate = true;
  }
  clearTrail() {
    this._trailN = 0;
    this.trail.count = 0;
  }

  setPose(pose, extra) {
    this._last = { pose, extra };
    this.skeleton.applyPose(pose, extra);
    if (this.glb) {
      const h = this.holder;
      this.glb.update({ holderPos: h.position, holderQ: h.quaternion, nodeQ: nodeWorldQuats(this.skeleton) });
    }
  }

  setSide(side) {
    this.opts.side = side;
    this.group.scale.x = side === 'left' ? -1 : 1;
    this.group.updateMatrixWorld(true);
  }
  setSkin(id) {
    this.opts.skin = id;
    this.skinHex = SKINS[id]?.hex || SKIN;
    this._paint();
  }

  /** colors: { thumb:'#hex', … } hoặc null để trả về màu da hiện tại. */
  setFingerColors(colors) {
    this.fingerColors = colors || null;
    this._paint();
  }

  dispose() {
    this.disposed = true;
    for (const g of this.glbs.values()) g.dispose();
    this.trail.geometry.dispose();
    this.trail.material.dispose();
    this.trail.dispose();
  }
}
