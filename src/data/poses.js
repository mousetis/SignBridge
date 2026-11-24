// BẢNG TƯ THẾ 36 KÝ TỰ (A–Z, 0–9) – xấp xỉ bảng chữ cái ngón tay chuẩn (ASL / quốc tế).
// ⚠ Đây là dữ liệu có thể chỉnh sửa: nếu bạn có bảng ký hiệu chuẩn riêng, hãy sửa file này
//   rồi chạy lại `npm run train:synthetic`. Mô hình 3D, hình 2D, dữ liệu huấn luyện và
//   điểm chấm bài học đều được sinh ra từ chính bảng này.
//
// Mỗi ngón: [mcp, pip, dip, nghiêng sang +X (phía ngón cái)] – độ (0 = duỗi thẳng).
// Ngón cái: toạ độ đích của đầu ngón (cm, gốc = cổ tay, +Y = hướng ngón, +Z = ra trước lòng bàn tay)
//           hoặc { touch:'index', part:'tip', off:[x,y,z] } để chạm đầu một ngón khác.
// orient: danh sách phép quay [['z', -90], ['x', 180]] áp dụng lần lượt (hướng lòng bàn tay).

const X = (lean = 0) => [0, 0, 0, lean]; // duỗi
const FST = [85, 105, 75, 0]; // gập chặt vào lòng bàn tay
const CRV = (m, lean = 0) => [m, m + 8, m - 5, lean]; // cong tròn
const ROUND = [60, 70, 45, 0]; // vòng tròn (O, F, 0, 9)
const HOOK = [10, 95, 25, 0]; // móc (X)

const ALL = (f) => ({ index: f, middle: f, ring: f, pinky: f });
const fingers = (i, m, r, p) => ({ index: i, middle: m, ring: r, pinky: p });

const ACROSS = [0.4, 7.3, 5.9]; // ngón cái vắt ngang mặt nắm tay
const ACROSS_PALM = [0.3, 4.6, 1.9]; // ngón cái gập ngang lòng bàn tay
const SIDEWAYS = [['z', -90], ['x', 180]]; // bàn tay xoay ngang (G, H)
const DOWN = [['x', 150]]; // chúc xuống (P, Q)

const G_POSE = { fingers: fingers(X(), FST, FST, FST), thumb: [4.2, 7.8, 1.8] };
const K_POSE = { fingers: fingers(X(8), X(-6), FST, FST), thumb: [1.6, 9.8, 1.6] };
const F_POSE = {
  fingers: fingers(ROUND, X(-2), X(-6), X(-10)),
  thumb: { touch: 'index', part: 'tip', off: [0, 0, 0.2] },
};
const O_POSE = {
  fingers: fingers(ROUND, [62, 72, 45, 0], [64, 72, 45, 0], [66, 70, 45, 0]),
  thumb: { touch: 'index', part: 'tip', off: [0, -0.3, 0.2] },
};
const V_POSE = { fingers: fingers(X(12), X(-12), FST, FST), thumb: [-0.3, 7.4, 5.9] };
const W_POSE = {
  fingers: fingers(X(10), X(0), X(-10), FST),
  thumb: { touch: 'pinky', part: 'tip', off: [0, 0, 0.3] },
};

export const POSES = {
  A: { fingers: ALL(FST), thumb: [4.6, 7.4, 3.0] },
  B: { fingers: ALL(X()), thumb: ACROSS_PALM },
  C: { fingers: fingers(CRV(40, 3), CRV(40), CRV(40, -3), CRV(40, -6)), thumb: [3.2, 6.6, 5.6] },
  D: {
    fingers: fingers(X(), [55, 80, 50, 0], [58, 80, 50, 0], [60, 80, 50, 0]),
    thumb: { touch: 'middle', part: 'tip', off: [0, 0, 0.3] },
  },
  E: { fingers: ALL([50, 100, 40, 0]), thumb: [0.3, 5.8, 3.0] },
  F: F_POSE,
  G: { ...G_POSE, orient: SIDEWAYS },
  H: { fingers: fingers(X(), X(), FST, FST), thumb: [-0.3, 7.5, 5.9], orient: SIDEWAYS },
  I: { fingers: fingers(FST, FST, FST, X(-4)), thumb: ACROSS },
  J: { fingers: fingers(FST, FST, FST, X(-4)), thumb: ACROSS, dynamic: true }, // I + vẽ móc
  K: K_POSE,
  L: { fingers: fingers(X(), FST, FST, FST), thumb: [7.4, 5.2, 0.8] },
  M: { fingers: ALL(FST), thumb: [-0.5, 7.2, 4.6] },
  N: { fingers: ALL(FST), thumb: [0.9, 7.2, 4.6] },
  O: O_POSE,
  P: { ...K_POSE, orient: DOWN },
  Q: { ...G_POSE, orient: DOWN },
  R: { fingers: fingers(X(-9), X(9), FST, FST), thumb: [0.0, 7.5, 5.9] },
  S: { fingers: ALL(FST), thumb: [0.5, 7.7, 5.9] },
  T: { fingers: ALL(FST), thumb: [2.0, 8.6, 5.2] },
  U: { fingers: fingers(X(1), X(-1), FST, FST), thumb: [-0.3, 7.2, 5.9] },
  V: V_POSE,
  W: W_POSE,
  X: { fingers: fingers(HOOK, FST, FST, FST), thumb: ACROSS },
  Y: { fingers: fingers(FST, FST, FST, X(-8)), thumb: [7.2, 4.2, 1.0] },
  Z: { fingers: fingers(X(), FST, FST, FST), thumb: ACROSS, dynamic: true }, // trỏ + vẽ ziczac
  // Chữ số
  0: { ...O_POSE },
  1: { fingers: fingers(X(), FST, FST, FST), thumb: ACROSS },
  2: { ...V_POSE },
  3: { fingers: fingers(X(4), X(-2), FST, FST), thumb: [6.8, 4.8, 1.8] },
  4: { fingers: fingers(X(4), X(0), X(-4), X(-9)), thumb: ACROSS_PALM },
  5: { fingers: fingers(X(8), X(2), X(-6), X(-14)), thumb: [7.0, 4.0, 0.8] },
  6: { ...W_POSE },
  7: {
    fingers: fingers(X(8), X(-2), [58, 80, 50, 0], X(-12)),
    thumb: { touch: 'ring', part: 'tip', off: [0, 0, 0.3] },
  },
  8: {
    fingers: fingers(X(6), [55, 80, 50, 0], X(-6), X(-12)),
    thumb: { touch: 'middle', part: 'tip', off: [0, 0, 0.3] },
  },
  9: { ...F_POSE },
};

// Tư thế nghỉ (tay thả lỏng) dùng giữa các từ khi diễn hoạt – không thuộc 36 ký tự.
export const REST_POSE = {
  fingers: { index: [12, 18, 10, 3], middle: [14, 20, 12, 0], ring: [16, 22, 12, -3], pinky: [18, 24, 14, -6] },
  thumb: { params: [10, 25, 0, 12, 0, 10] },
};

// Cặp ký hiệu GIỐNG HỆT nhau về hình dạng bàn tay (chỉ phân biệt nhờ ngữ cảnh chữ/số).
export const AMBIGUOUS_PAIRS = [['O', '0'], ['V', '2'], ['W', '6'], ['F', '9']];

// Mô tả ngắn bằng tiếng Việt (chỉ để chú thích hình, không bắt buộc).
export const HINTS = {
  A: 'Nắm tay, ngón cái dựng cạnh ngón trỏ', B: 'Bốn ngón duỗi sát, ngón cái gập ngang lòng bàn tay',
  C: 'Cong cả bàn tay thành hình chữ C', D: 'Trỏ duỗi, ngón cái chạm đầu ngón giữa',
  E: 'Các ngón gập móc, ngón cái nằm dưới', F: 'Trỏ chạm ngón cái thành vòng tròn, ba ngón còn lại duỗi',
  G: 'Trỏ và ngón cái song song, xoay ngang', H: 'Trỏ và giữa duỗi sát, xoay ngang',
  I: 'Chỉ ngón út duỗi', J: 'Tư thế chữ I rồi vẽ nét móc J', K: 'Trỏ và giữa xòe, ngón cái chạm ngón giữa',
  L: 'Trỏ lên, ngón cái ngang (chữ L)', M: 'Ba ngón phủ lên ngón cái', N: 'Hai ngón phủ lên ngón cái',
  O: 'Các ngón chụm thành vòng tròn', P: 'Như chữ K nhưng chúc xuống', Q: 'Như chữ G nhưng chúc xuống',
  R: 'Trỏ và giữa bắt chéo', S: 'Nắm tay, ngón cái vắt ngang', T: 'Ngón cái kẹp giữa ngón trỏ và giữa',
  U: 'Trỏ và giữa duỗi sát nhau', V: 'Trỏ và giữa xòe chữ V', W: 'Trỏ, giữa, áp út xòe',
  X: 'Ngón trỏ co móc', Y: 'Ngón cái và ngón út duỗi', Z: 'Ngón trỏ vẽ chữ Z trong không khí',
  0: 'Vòng tròn như chữ O', 1: 'Ngón trỏ dựng', 2: 'Trỏ và giữa xòe', 3: 'Ngón cái, trỏ, giữa duỗi',
  4: 'Bốn ngón duỗi, ngón cái gập', 5: 'Năm ngón xòe', 6: 'Ngón út chạm ngón cái, ba ngón duỗi',
  7: 'Áp út chạm ngón cái', 8: 'Ngón giữa chạm ngón cái', 9: 'Trỏ chạm ngón cái',
};
