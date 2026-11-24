// Văn bản thông minh: sửa lỗi chính tả theo từ vựng, dự đoán từ, câu nói nhanh, khôi phục dấu tiếng Việt.
import { VOCAB, restoreDiacritics } from '../data/vocabulary.js';
import { normalizeForSign } from './text.js';
import { store } from './store.js';
import { pkey } from './profiles.js';

/** Khoảng cách Damerau–Levenshtein có giới hạn (dừng sớm khi vượt `max`). */
export function editDistance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length;
  const n = b.length;
  let p2 = null;
  let p1 = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(p1[j] + 1, cur[j - 1] + 1, p1[j - 1] + c);
      if (p2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, p2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    p2 = p1;
    p1 = cur;
  }
  return p1[n];
}

const SINGLES = [...new Set(VOCAB.flatMap((w) => w.key.split(' ')).filter((t) => t.length >= 2))];
const SINGLE_SET = new Set(SINGLES);

/** Sửa từng từ gần đúng: từ ≥ 4 ký tự, lệch ≤ 1 (≥ 7 ký tự: ≤ 2) so với đúng MỘT từ vựng. Trả về { text, changes:[{from,to}] }. */
export function autocorrect(text, extra = []) {
  const toks = normalizeForSign(text).trim().split(' ').filter(Boolean);
  const dict = extra.length ? [...SINGLES, ...extra.filter((k) => !SINGLE_SET.has(k))] : SINGLES;
  const set = new Set(dict);
  const changes = [];
  const out = toks.map((w) => {
    if (w.length < 4 || set.has(w) || /\d/.test(w)) return w;
    const max = w.length >= 7 ? 2 : 1;
    let best = null;
    let tie = false;
    for (const d of dict) {
      const e = editDistance(w, d, max);
      if (e <= max) {
        if (!best || e < best.e) { best = { d, e }; tie = false; }
        else if (e === best.e) tie = true;
      }
    }
    if (best && !tie) {
      changes.push({ from: w, to: best.d });
      return best.d;
    }
    return w;
  });
  return { text: out.join(' '), changes };
}

/** Văn bản đã sửa + khôi phục dấu để đọc/hiển thị. */
export const beautify = (text) => restoreDiacritics(autocorrect(text).text);

// ---- Câu nói nhanh (cá nhân hoá)
export const DEFAULT_PHRASES = ['Xin chào', 'Cảm ơn', 'Xin lỗi', 'Tôi cần giúp đỡ', 'Tôi không hiểu', 'Bạn khỏe không?', 'Làm ơn nói chậm lại'];
export const loadPhrases = () => store.read(pkey('quickPhrases'), null) || DEFAULT_PHRASES;
export const savePhrases = (list) => store.write(pkey('quickPhrases'), list.filter(Boolean).slice(0, 24));

// ---- Dự đoán từ theo tần suất dùng của người dùng
export const loadFreq = () => store.read(pkey('wordfreq'), {}) || {};
export function bumpFreq(text) {
  const f = { ...loadFreq() };
  for (const w of normalizeForSign(text).trim().split(' ').filter((x) => x.length > 1)) f[w] = (f[w] || 0) + 1;
  const top = Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, 300);
  store.write(pkey('wordfreq'), Object.fromEntries(top));
}
