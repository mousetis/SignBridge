// Khung xương 21 khớp (theo đúng thứ tự landmark của MediaPipe Hands) dùng chung cho:
//  - hiển thị bàn tay 3D (Three.js)
//  - sinh dữ liệu huấn luyện tổng hợp (chạy được cả trong Node, không cần WebGL)
//
// Hệ trục (đơn vị ~ cm): X sang phải (phía ngón cái của bàn tay phải nhìn từ người xem),
// Y hướng lên (hướng ngón tay), Z hướng ra phía người xem (pháp tuyến lòng bàn tay).
// Gập ngón = quay dương quanh trục X (đầu ngón cong về phía +Z, tức phía lòng bàn tay).
import * as THREE from 'three';

export const FINGERS = ['index', 'middle', 'ring', 'pinky'];
export const FINGER_NAMES = ['thumb', ...FINGERS];

export const PALM_CENTER_Y = 5.5; // tâm xoay của cả bàn tay
export const MCP_POS = {
  index: [3.0, 8.8, 0],
  middle: [1.0, 9.2, 0],
  ring: [-1.0, 8.7, 0],
  pinky: [-2.9, 7.8, 0],
};
export const SEG_LEN = {
  index: [4.3, 2.5, 2.0],
  middle: [4.7, 2.9, 2.1],
  ring: [4.4, 2.8, 2.0],
  pinky: [3.5, 1.9, 1.8],
};
export const THUMB_CMC = [1.2, 0.6, 0.3];
export const THUMB_LEN = [3.8, 3.2, 2.6]; // CMC->MCP, MCP->IP, IP->TIP

// Chỉ số landmark MediaPipe
export const LM = {
  WRIST: 0,
  THUMB: [1, 2, 3, 4],
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
};
export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];
export const JOINT_NAMES = [
  'thumb_cmc', 'thumb_mcp', 'thumb_ip',
  ...FINGERS.flatMap((f) => [`${f}_mcp`, `${f}_pip`, `${f}_dip`]),
];

export class HandSkeleton {
  constructor() {
    this.holder = new THREE.Object3D(); // đặt ở tâm lòng bàn tay, mang hướng chung của bàn tay
    this.root = new THREE.Bone(); // cổ tay (các khớp là THREE.Bone để gắn lưới da)
    this.root.position.set(0, -PALM_CENTER_Y, 0);
    this.holder.add(this.root);
    this.joints = {};
    this.nodes = new Array(21); // theo chỉ số landmark
    this.nodes[0] = this.root;

    const chain = (parent, names, lens, firstPos, firstIdx) => {
      let p = parent;
      names.forEach((n, i) => {
        const o = new THREE.Bone();
        if (i === 0) o.position.set(...firstPos);
        else o.position.set(0, lens[i - 1], 0);
        p.add(o);
        this.joints[n] = o;
        this.nodes[firstIdx + i] = o;
        p = o;
      });
      const tip = new THREE.Bone();
      tip.position.set(0, lens[lens.length - 1], 0);
      p.add(tip);
      this.nodes[firstIdx + names.length] = tip;
    };

    chain(this.root, ['thumb_cmc', 'thumb_mcp', 'thumb_ip'], THUMB_LEN, THUMB_CMC, 1);
    FINGERS.forEach((f, i) =>
      chain(this.root, [`${f}_mcp`, `${f}_pip`, `${f}_dip`], SEG_LEN[f], MCP_POS[f], 5 + i * 4),
    );
    this.holder.updateMatrixWorld(true);
  }

  /** pose = { joints: {name: Quaternion}, orient: Quaternion } */
  applyPose(pose, extra) {
    for (const n of JOINT_NAMES) this.joints[n].quaternion.copy(pose.joints[n]);
    this.holder.quaternion.copy(pose.orient);
    if (extra?.quaternion) this.holder.quaternion.premultiply(extra.quaternion);
    if (extra?.position) this.holder.position.copy(extra.position);
    else this.holder.position.set(0, 0, 0);
    this.holder.updateMatrixWorld(true);
  }

  /** Vị trí 21 landmark trong không gian thế giới (Vector3 mới nếu không truyền `out`). */
  getLandmarks(out) {
    const res = out || Array.from({ length: 21 }, () => new THREE.Vector3());
    for (let i = 0; i < 21; i++) {
      const e = this.nodes[i].matrixWorld.elements;
      res[i].set(e[12], e[13], e[14]);
    }
    return res;
  }
}
