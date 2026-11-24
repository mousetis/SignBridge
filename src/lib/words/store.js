// Kho mẫu từ/cụm từ của từng hồ sơ (IndexedDB vì có thể lớn). Mỗi mẫu = chuỗi 32 khung × 90 số.
import { idb } from '../idb.js';
import { activeId } from '../profiles.js';
import { normalizeForSign } from '../text.js';
import { WordMatcher, N_FRAMES, DIM } from './dtw.js';

const k = () => `p.${activeId()}.words`;

/** Từ gợi ý để người dùng ghi trước (CHỈ là tên; không kèm dữ liệu ký hiệu). */
export const STARTER_WORDS = ['Xin chào', 'Cảm ơn', 'Xin lỗi', 'Tạm biệt', 'Tôi', 'Bạn', 'Yêu', 'Giúp tôi', 'Có', 'Không', 'Đói', 'Nước'];

export async function loadWords() {
  return (await idb.get(k())) || {};
}
async function save(data) {
  await idb.set(k(), data);
}

export async function addSample(display, seq) {
  const key = normalizeForSign(display).trim();
  if (!key) throw new Error('empty');
  const data = await loadWords();
  const w = data[key] || { display: display.trim(), samples: [], at: Date.now() };
  w.samples = [...w.samples, Array.from(seq)].slice(-12);
  data[key] = w;
  await save(data);
  return { key, count: w.samples.length };
}
export async function removeSample(key, idx) {
  const data = await loadWords();
  if (!data[key]) return;
  data[key].samples.splice(idx, 1);
  if (!data[key].samples.length) delete data[key];
  await save(data);
}
export async function removeWord(key) {
  const data = await loadWords();
  delete data[key];
  await save(data);
}
export async function buildMatcher() {
  return WordMatcher.fromStore(await loadWords());
}
export async function exportWords() {
  return { version: 1, frames: N_FRAMES, dim: DIM, words: await loadWords() };
}
export async function importWords(obj, { merge = true } = {}) {
  if (!obj || obj.dim !== DIM || obj.frames !== N_FRAMES || typeof obj.words !== 'object') throw new Error('bad-format');
  const cur = merge ? await loadWords() : {};
  for (const [key, w] of Object.entries(obj.words)) {
    const old = cur[key];
    cur[key] = old ? { ...old, samples: [...old.samples, ...w.samples].slice(-12) } : w;
  }
  await save(cur);
  return Object.keys(obj.words).length;
}
