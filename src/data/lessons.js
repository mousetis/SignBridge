import { PRACTICE_WORDS } from './vocabulary.js';

// 4 cấp độ theo yêu cầu: A–M | N–Z (kể cả ký tự động J, Z) | 0–9 | ghép từ giao tiếp.
export const LEVELS = [
  { id: 1, title: 'Cấp 1 · Chữ cái A–M', desc: '12 chữ cái tĩnh đầu tiên (J được học ở cấp 2 vì là ký tự động)', items: 'ABCDEFGHIKLM'.split('') },
  { id: 2, title: 'Cấp 2 · Chữ cái N–Z và J, Z', desc: 'Chữ cái nâng cao, kết thúc bằng hai ký tự có chuyển động: J và Z', items: 'NOPQRSTUVWXYJZ'.split('') },
  { id: 3, title: 'Cấp 3 · Chữ số 0–9', desc: 'Mười chữ số, có chế độ phân biệt với các chữ cái giống hệt', items: '0123456789'.split('') },
  { id: 4, title: 'Cấp 4 · Luyện ghép từ giao tiếp', desc: 'Ký hiệu từng chữ để ghép thành từ và cụm từ thông dụng', words: PRACTICE_WORDS },
];

/** Trải phẳng cấp độ thành danh sách mục tiêu: { ch, word?, wordIdx?, pos? } */
export function expandLevel(level) {
  if (level.items) return level.items.map((ch) => ({ ch }));
  const out = [];
  level.words.forEach((w, wi) => {
    let pos = 0;
    for (const ch of w) {
      if (ch === ' ') continue;
      out.push({ ch, word: w, wordIdx: wi, pos: pos++ });
    }
  });
  return out;
}

export const isDynamic = (ch) => ch === 'J' || ch === 'Z';
