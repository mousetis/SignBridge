// Chia văn bản thành các đoạn để diễn hoạt: từ/cụm từ mà người dùng đã GHI → phát lại ký hiệu của họ; phần còn lại → đánh vần từng chữ.
import { normalizeForSign } from '../text.js';

/** @returns {{kind:'word'|'letters', start:number, end:number, chars?:string[], key?:string, display?:string, seq?:Float32Array}[]} start/end là chỉ số (gồm cả end) trong chuỗi chuẩn hoá. */
export function buildSegments(input, words = {}) {
  const norm = normalizeForSign(input).trimEnd();
  const toks = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(norm))) toks.push({ w: m[0], s: m.index, e: m.index + m[0].length - 1 });
  const segs = [];
  const pushLetters = (a, b) => {
    const last = segs[segs.length - 1];
    if (last?.kind === 'letters') {
      last.end = b;
      last.chars = norm.slice(last.start, b + 1).split('');
    } else segs.push({ kind: 'letters', start: a, end: b, chars: norm.slice(a, b + 1).split('') });
  };
  for (let i = 0; i < toks.length; ) {
    let hit = null;
    for (let k = Math.min(5, toks.length - i); k >= 1 && !hit; k--) {
      const key = toks.slice(i, i + k).map((t) => t.w).join(' ');
      const w = words[key];
      if (w?.samples?.length) hit = { k, key, w };
    }
    if (hit) {
      segs.push({ kind: 'word', start: toks[i].s, end: toks[i + hit.k - 1].e, key: hit.key, display: hit.w.display, seq: Float32Array.from(hit.w.samples[0]) });
      i += hit.k;
    } else {
      pushLetters(toks[i].s, toks[i].e);
      i++;
    }
  }
  // thêm dấu cách cuối của từng đoạn chữ cái nếu liền sau là một đoạn khác (để có nhịp nghỉ)
  segs.forEach((sg, i) => {
    if (sg.kind === 'letters' && i < segs.length - 1) sg.chars = [...sg.chars, ' '];
  });
  return { norm, segs };
}
