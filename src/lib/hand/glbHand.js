// Bàn tay nạp từ tệp .glb (xem handModels.js) — được điều khiển bởi CHÍNH khung xương 21 khớp của ứng dụng: mỗi khớp của khung xương →
// xoay xương tương ứng của mô hình (chuyển phép quay theo hệ toạ độ thế giới nên không phụ thuộc việc hai bộ xương đặt trục khác nhau).
// Trước khi dùng, bộ xương của tệp được "chuẩn hoá" (mọi xương có hướng nghỉ = đơn vị, không còn scale lệch/xiên) rồi căn khớp với tư thế
// mở bàn tay của khung xương (tay trái → phản chiếu thành tay phải nếu mô hình khai báo mirror).
//
// Mô-đun không đụng tới DOM nên kiểm thử được trong Node (xem scripts/selftest.mjs).
import * as THREE from 'three';
import { PALM_CENTER_Y } from './handSkeleton.js';
import { HAND_MODELS, resolveHandStyle } from './handModels.js';

const FINGER_OF = (name) => {
  const n = name.toLowerCase();
  return n.includes('thumb') ? 0 : n.includes('index') ? 1 : /middle|midd_/.test(n) ? 2 : n.includes('ring') ? 3 : n.includes('pinky') ? 4 : -1;
};

/**
 * Dựng lại bộ xương của tệp với xương không xoay (chỉ có vị trí đầu xương lấy từ pose gắn xương thật = nghịch đảo ma trận bind) và gắn
 * lại lưới da. Nhờ đó phép quay lấy từ khung xương áp thẳng vào xương, kể cả khi tệp có scale không đều trên armature.
 * Mỗi lần gọi trả về một bản mới (hình học được nhân bản để tô màu đỉnh riêng).
 */
export function normalizeRig(template) {
  template.updateMatrixWorld(true);
  const out = new THREE.Group();
  const oldBones = [];
  template.traverse((o) => { if (o.isBone) oldBones.push(o); });
  const head = new Map();
  for (const b of oldBones) head.set(b, b.getWorldPosition(new THREE.Vector3()));
  // vị trí gắn xương thật lấy từ boneInverses của lưới da (nếu có)
  template.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.skeleton.bones.forEach((b, i) => head.set(b, new THREE.Vector3().setFromMatrixPosition(o.skeleton.boneInverses[i].clone().invert())));
  });
  const map = new Map();
  for (const b of oldBones) { const nb = new THREE.Bone(); nb.name = b.name; map.set(b, nb); }
  for (const b of oldBones) {
    const nb = map.get(b);
    const par = b.parent && map.get(b.parent);
    if (par) { par.add(nb); nb.position.copy(head.get(b)).sub(head.get(b.parent)); } else { out.add(nb); nb.position.copy(head.get(b)); }
  }
  template.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const bones = o.skeleton.bones.map((b) => map.get(b));
    const inv = o.skeleton.bones.map((b) => new THREE.Matrix4().makeTranslation(-head.get(b).x, -head.get(b).y, -head.get(b).z));
    const mesh = new THREE.SkinnedMesh(o.geometry.clone(), o.material);
    mesh.name = o.name;
    mesh.frustumCulled = false;
    out.add(mesh);
    out.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones, inv), new THREE.Matrix4());
  });
  return out;
}

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _I = new THREE.Quaternion();

/** Dựng hệ trục (side, up, normal) của bàn tay từ cổ tay, đốt giữa ngón giữa, đốt ngón trỏ và ngón út. */
function frameOf(wrist, mid, idx, pnk) {
  const up = mid.clone().sub(wrist).normalize();
  const side = idx.clone().sub(pnk);
  side.addScaledVector(up, -side.dot(up)).normalize();
  const n = new THREE.Vector3().crossVectors(side, up).normalize();
  return new THREE.Matrix4().makeBasis(side, up, n);
}

/**
 * @param template scene đã nạp từ GLTFLoader (không bị sửa)
 * @param bind { pos: [[x,y,z]*21] (gốc ở cổ tay), worldQ: Quaternion[21] } của khung xương ở tư thế mở bàn tay
 * @param style id trong HAND_MODELS
 */
export class GlbHand {
  constructor(template, bind, style) {
    this.cfg = HAND_MODELS[resolveHandStyle(style)];
    this.root = new THREE.Group(); // gắn vào `group` của HandRig
    this.model = normalizeRig(template);
    this.root.add(this.model);
    this.bind = bind;
    this.bones = new Map();
    this.skins = [];
    this.model.traverse((o) => {
      if (o.isBone) this.bones.set(o.name.replace(/\./g, ''), o);
      if (o.isSkinnedMesh) this.skins.push(o);
    });
    this.model.updateMatrixWorld(true);
    this.rest = new Map(); // vị trí đầu xương ở tư thế nghỉ (xương nghỉ không xoay)
    for (const b of this.bones.values()) this.rest.set(b, { head: b.getWorldPosition(new THREE.Vector3()) });
    this._align();
    this._order = [];
    const visit = (o) => { if (o.isBone) this._order.push(o); o.children.forEach(visit); };
    visit(this.model);
    this._W = new Map();
    this._desired = new Map();
    this._setupMaterials();
    this._addCuff();
    this._addCap();
    this.update({ holderQ: _I, holderPos: new THREE.Vector3(0, 0, 0), nodeQ: bind.worldQ });
  }

  _headOf(name) { return this.rest.get(this.bones.get(name)).head; }

  /** Căn mô hình (phản chiếu nếu cần) vào hệ toạ độ của khung xương ở tư thế mở + chọn tỉ lệ. */
  _align() {
    const c = this.cfg;
    const mx = c.mirror ? (p) => new THREE.Vector3(-p.x, p.y, p.z) : (p) => p.clone();
    const [w, m, i, k] = c.frame.map((n) => mx(this._headOf(n)));
    const g = frameOf(w, m, i, k);
    const P = (n) => new THREE.Vector3(...this.bind.pos[n]);
    const mf = frameOf(P(0), P(9), P(5), P(17));
    const A = new THREE.Matrix4().multiplyMatrices(mf, g.clone().transpose());
    this.Aq = new THREE.Quaternion().setFromRotationMatrix(A);
    this.AqInv = this.Aq.clone().invert();
    const scale = c.scale === 'auto' ? P(9).distanceTo(P(0)) / m.distanceTo(w) : c.scale;
    this.scale = scale;
    this.model.quaternion.copy(this.Aq);
    this.model.scale.set(c.mirror ? -scale : scale, scale, scale);
    this.model.updateMatrixWorld(true);
  }

  _setupMaterials() {
    this.skinMat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.62, metalness: 0 });
    this.clothMat = new THREE.MeshStandardMaterial({ color: '#4483e7', roughness: 0.8 });
    this.ownMats = [];
    for (const m of this.skins) {
      const isSkin = !Array.isArray(m.material) && this.cfg.isSkin(m.material);
      m.userData.isSkin = isSkin;
      m.geometry.deleteAttribute('color_1');
      if (!isSkin) { m.material = this.clothMat; continue; }
      if (this.cfg.textured) {
        // giữ chất liệu/kết cấu gốc (bản sao riêng cho từng bàn tay), nhân thêm màu đỉnh để tô màu từng ngón
        m.material = m.material.clone();
        m.material.vertexColors = true;
        m.material.side = THREE.DoubleSide; // mép cắt/đầu thanh đỡ hở → thấy mặt trong thay vì thủng
        m.material.needsUpdate = true;
        this.ownMats.push(m.material);
      } else m.material = this.skinMat;
      const geo = m.geometry;
      const n = geo.getAttribute('position').count;
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
      const si = geo.getAttribute('skinIndex'), sw = geo.getAttribute('skinWeight');
      const W = new Float32Array(n * 5);
      for (let v = 0; v < n; v++) {
        for (let k = 0; k < 4; k++) {
          const f = FINGER_OF(m.skeleton.bones[si.getComponent(v, k)].name);
          if (f >= 0) W[v * 5 + f] += sw.getComponent(v, k);
        }
      }
      m.userData.W = W;
    }
  }

  /** Cổ tay áo (hình trụ elip) che mép cắt phẳng của lưới ở cổ tay, gắn vào xương cổ tay nên quay theo bàn tay. */
  _addCuff() {
    const c = this.cfg.cuff;
    if (!c) return;
    const geo = new THREE.CylinderGeometry(1, 1.06, c.h, 40, 1, false);
    this.cuff = new THREE.Mesh(geo, this.clothMat);
    this.cuff.scale.set(c.rx, 1, c.rz);
    this.cuff.position.set(c.cx, c.y + c.h / 2, c.cz);
    this.bones.get(this.cfg.wrist).add(this.cuff);
  }

  /** Bịt đáy hở của mô hình (đáy thanh đỡ) bằng một đĩa gỗ: tìm vòng đỉnh thấp nhất rồi dựng đĩa khít vòng đó. */
  _addCap() {
    const bone = this.cfg.capBone && this.bones.get(this.cfg.capBone);
    if (!bone) return;
    let ymin = Infinity;
    for (const m of this.skins) { const p = m.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) ymin = Math.min(ymin, p.getY(i)); }
    let cx = 0, cz = 0, n = 0;
    for (const m of this.skins) { const p = m.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) if (p.getY(i) < ymin + 0.02) { cx += p.getX(i); cz += p.getZ(i); n++; } }
    if (!n) return;
    cx /= n; cz /= n;
    let r = 0;
    for (const m of this.skins) { const p = m.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) if (p.getY(i) < ymin + 0.02) r = Math.max(r, Math.hypot(p.getX(i) - cx, p.getZ(i) - cz)); }
    const geo = new THREE.CircleGeometry(r * 1.02, 40);
    geo.rotateX(Math.PI / 2); // hướng xuống (−Y)
    this.capMat = new THREE.MeshStandardMaterial({ color: '#e3bd8a', roughness: 0.85, side: THREE.DoubleSide });
    this.cap = new THREE.Mesh(geo, this.capMat);
    const head = this.rest.get(bone).head;
    this.cap.position.set(cx - head.x, ymin - 0.04 - head.y, cz - head.z);
    bone.add(this.cap);
  }

  /** Tô màu đỉnh: màu da + màu hướng dẫn từng ngón. */
  paint(skinHex, fingerColors, fingerNames) {
    const skin = new THREE.Color(this.cfg.textured ? '#ffffff' : skinHex);
    const fc = fingerNames.map((f) => (fingerColors?.[f] ? new THREE.Color(fingerColors[f]) : null));
    for (const m of this.skins) {
      if (!m.userData.isSkin) continue;
      const col = m.geometry.getAttribute('color');
      const W = m.userData.W;
      for (let v = 0; v < col.count; v++) {
        let r = skin.r, g = skin.g, b = skin.b;
        for (let f = 0; f < 5; f++) {
          const c = fc[f];
          const w = W[v * 5 + f];
          if (!c || w <= 0.002) continue;
          const t = Math.min(1, w * 1.15);
          r += (c.r - r) * t; g += (c.g - g) * t; b += (c.b - b) * t;
        }
        col.setXYZ(v, r, g, b);
      }
      col.needsUpdate = true;
    }
  }

  /** Phép quay (theo hệ thế giới của khung xương) → phép quay tương ứng trong hệ của mô hình (có phản chiếu nếu cần). */
  _toModel(d, out) {
    _v.set(d.x, d.y, d.z).applyQuaternion(this.AqInv);
    return this.cfg.mirror ? out.set(_v.x, -_v.y, -_v.z, d.w) : out.set(_v.x, _v.y, _v.z, d.w);
  }

  /**
   * @param s { holderQ, holderPos, nodeQ: Quaternion[21] } nodeQ = phép quay thế giới của từng khớp khung xương
   * (gốc toạ độ nhóm). Đặt xương mô hình và dời mô hình để cổ tay trùng cổ tay của khung xương.
   */
  update({ holderPos, holderQ, nodeQ }) {
    const bq = this.bind.worldQ;
    const desired = this._desired;
    desired.clear();
    const dHand = new THREE.Quaternion();
    for (const [i, name] of Object.entries(this.cfg.bones)) {
      const bone = this.bones.get(name);
      if (!bone) continue;
      const d = nodeQ[i].clone().multiply(bq[i].clone().invert()); // phép quay thế giới so với tư thế nghỉ
      if (+i === 0) dHand.copy(d);
      desired.set(bone, this._toModel(d, new THREE.Quaternion()));
    }
    for (const [name, k] of this.cfg.arm) {
      const bone = this.bones.get(name);
      if (!bone) continue;
      desired.set(bone, this._toModel(_I.clone().slerp(dHand, k), new THREE.Quaternion()));
    }
    const W = this._W;
    for (const b of this._order) {
      const parentW = b.parent && this.bones.has(b.parent.name.replace(/\./g, '')) ? W.get(b.parent) : _I;
      const want = desired.get(b);
      if (want) {
        b.quaternion.copy(_q.copy(parentW).invert().multiply(want));
        W.set(b, want.clone());
      } else {
        b.quaternion.identity();
        W.set(b, parentW.clone());
      }
    }
    // đặt cổ tay mô hình đúng chỗ cổ tay của khung xương
    this.model.position.set(0, 0, 0);
    this.model.updateMatrixWorld(true);
    const cur = this.bones.get(this.cfg.wrist).getWorldPosition(new THREE.Vector3());
    this.root.worldToLocal(cur);
    const wrist = _v.set(0, -PALM_CENTER_Y, 0).applyQuaternion(holderQ).add(holderPos);
    this.model.position.copy(wrist).sub(cur);
    this.model.updateMatrixWorld(true);
  }

  dispose() {
    this.skinMat.dispose();
    this.clothMat.dispose();
    this.ownMats.forEach((m) => m.dispose());
    this.cuff?.geometry.dispose();
    this.cap?.geometry.dispose();
    this.capMat?.dispose();
    for (const m of this.skins) m.geometry.dispose();
  }
}

/** Phép quay thế giới (trong hệ nhóm) của 21 khớp của khung xương, tính tay (không phụ thuộc scale âm của nhóm cha). */
export function nodeWorldQuats(sk, out = null) {
  const res = out || Array.from({ length: 21 }, () => new THREE.Quaternion());
  const q = new Map();
  const walk = (o, parentQ) => {
    const w = parentQ.clone().multiply(o.quaternion);
    q.set(o, w);
    o.children.forEach((c) => c.isBone && walk(c, w));
  };
  walk(sk.root, sk.holder.quaternion);
  for (let i = 0; i < 21; i++) res[i].copy(q.get(sk.nodes[i]));
  return res;
}
