// Danh sách mô hình bàn tay .glb có thể chọn trong Cài đặt. Mỗi mô hình khai báo cách ghép xương của nó với khung xương 21 khớp
// của ứng dụng (chỉ số landmark MediaPipe → tên xương trong tệp .glb). Mô-đun thuần dữ liệu nên dùng được cả trong Node.

const cartoonBones = {
  0: 'DEF-handL',
  1: 'DEF-thumb01L', 2: 'DEF-thumb02L', 3: 'DEF-thumb03L',
  5: 'DEF-f_index01L', 6: 'DEF-f_index02L', 7: 'DEF-f_index03L',
  9: 'DEF-f_middle01L', 10: 'DEF-f_middle02L', 11: 'DEF-f_middle03L',
  13: 'DEF-f_ring01L', 14: 'DEF-f_ring02L', 15: 'DEF-f_ring03L',
  17: 'DEF-f_pinky01L', 18: 'DEF-f_pinky02L', 19: 'DEF-f_pinky03L',
};

const doBones = {
  0: 'radius_ulna',
  1: 'thumb_trapez', 2: 'thumb_meta', 3: 'thumb_prox',
  5: 'index_prox', 6: 'index_midd', 7: 'index_dist',
  9: 'midd_prox', 10: 'midd_midd', 11: 'midd_dist',
  13: 'ring_prox', 14: 'ring_midd', 15: 'ring_dist',
  17: 'pinky_prox', 18: 'pinky_midd', 19: 'pinky_dist',
};

const woodBones = {
  0: 'Palm_19',
  1: 'Thumb1_18', 2: 'Thumb2_17', // ngón cái chỉ có 2 xương
  5: 'Index1_16', 6: 'Index2_15', 7: 'Index3_14',
  9: 'Middle1_13', 10: 'Middle2_12', 11: 'Middle3_11',
  13: 'Ring1_10', 14: 'Ring2_9', 15: 'Ring3_8',
  17: 'Pinky1_7', 18: 'Pinky2_6', 19: 'Pinky3_5',
};

export const DEFAULT_HAND_STYLE = 'toon';

export const HAND_MODELS = {
  // Cartoon Hand Rig — Andy Cuccaro, CC-BY (tay TRÁI, có cẳng tay + tay áo)
  toon: {
    id: 'toon',
    url: 'models/cartoon-hand.glb',
    credit: 'Hand Rig by Andy Cuccaro (CC-BY 4.0)',
    mirror: true, // tệp là tay trái → phản chiếu thành tay phải
    scale: 75,
    bones: cartoonBones,
    wrist: 'DEF-handL', frame: ['DEF-handL', 'DEF-f_middle01L', 'DEF-f_index01L', 'DEF-f_pinky01L'],
    arm: [['DEF-forearm001L', 0.45], ['DEF-forearmL', 0.7], ['DEF-upper_arm001L', 0.8], ['DEF-upper_armL', 0.85]], // xương cẳng tay quay theo tay một phần cho cổ tay uốn mềm
    isSkin: (mat) => /skin/i.test(mat?.name || ''),
    belowWrist: 5.8, // phần cẳng tay nhô xuống dưới cổ tay (để khung ảnh chụp vừa)
    framePad: 1.4, // đệm quanh bàn tay khi chụp ảnh
    view: { y: 2.5, dist: 50 }, // vị trí camera ban đầu của khung xoay 360°
  },
  // 3D Rigged Hand — Emma L. D. Lieker (không có cẳng tay)
  do: {
    id: 'do',
    url: 'models/Do_Hand_DetailedRiggedAnimated_shared_16022026.glb',
    credit: '3D Rigged Hand © 2026 Emma L. D. Lieker',
    mirror: false,
    scale: 'auto',
    bones: doBones,
    wrist: 'radius_ulna', frame: ['radius_ulna', 'midd_prox', 'index_prox', 'pinky_prox'],
    arm: [],
    isSkin: () => true,
    // lưới bị cắt phẳng ở cổ tay → thêm cổ tay áo che mép cắt (đơn vị của mô hình: bán trục x/z, cao, y của đáy, tâm x/z so với đầu xương cổ tay)
    cuff: { rx: 3.05, rz: 4.5, h: 3.4, y: -3.0, cx: -0.1, cz: -0.4 },
    belowWrist: 3.6,
    framePad: 1.4,
    view: { y: 2.5, dist: 50 },
  },
  // Rigged wooden puppet hand — Updelta, CC-BY 4.0 (có kết cấu gỗ riêng nên không đổi tông da; gắn trên một thanh đỡ thay cho cẳng tay)
  wood: {
    id: 'wood',
    url: 'models/rigged_wooden_puppet_hand.glb',
    credit: 'Rigged wooden puppet hand by Updelta (CC-BY 4.0)',
    mirror: false,
    scale: 'auto',
    bones: woodBones,
    wrist: 'Palm_19', frame: ['Palm_19', 'Middle1_13', 'Index1_16', 'Pinky1_7'],
    arm: [['Arm_20', 1]], // thanh đỡ quay cứng cùng bàn tay
    capBone: 'Arm_20', // đáy thanh đỡ bị hở (thấy mặt trong màu đỏ) → bịt bằng một đĩa gỗ
    textured: true, // giữ nguyên chất liệu/kết cấu gốc, chỉ nhân màu hướng dẫn từng ngón
    skinTone: false,
    isSkin: () => true,
    belowWrist: 9.7,
    framePad: 3.2, // ngón gỗ dài hơn khung xương
    view: { y: -0.5, dist: 68 },
    noCheck: [1, 2], // ngón cái của mô hình rất ngắn/đặt sát bàn tay nên vị trí khác khung xương (bỏ qua khi kiểm thử sai số)
  },
};

export const handModelOf = (s) => HAND_MODELS[resolveHandStyle(s)];
export const HAND_STYLE_IDS = Object.keys(HAND_MODELS);
export const resolveHandStyle = (s) => (HAND_MODELS[s] ? s : DEFAULT_HAND_STYLE);
