import { useEffect, useRef } from 'react';
import { HAND_CONNECTIONS } from '../../lib/hand/handSkeleton.js';
import { N_FRAMES } from '../../lib/words/dtw.js';

const SLOT = 45;
const SCALE = 0.1; // độ dài lòng bàn tay (so với chiều rộng khung) khi vẽ lại

/** Vẽ một chuỗi từ đã ghi (32 khung × 90 số) bằng khung xương 2D của một hoặc hai bàn tay. t ∈ [0,1]. */
export function drawWordFrame(ctx, seq, t, w, h, { bg = true, color = '#FFC93C' } = {}) {
  if (bg) {
    ctx.fillStyle = '#12162B';
    ctx.fillRect(0, 0, w, h);
  }
  if (!seq) return;
  const p = Math.min(N_FRAMES - 1, Math.max(0, t * (N_FRAMES - 1)));
  const a = Math.floor(p);
  const b = Math.min(N_FRAMES - 1, a + 1);
  const f = p - a;
  const D = SLOT * 2;
  const val = (i, d) => seq[a * D + d] * (1 - f) + seq[b * D + d] * f;
  const unit = SCALE * w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let s = 0; s < 2; s++) {
    const o = s * SLOT;
    if (val(0, o + 44) < 0.5) continue;
    const wx = (val(0, o + 42) / 8 + 0.5) * w;
    const wy = (val(0, o + 43) / 8 + 0.5) * h;
    const P = (k) => [wx + val(0, o + k * 2) * unit, wy + val(0, o + k * 2 + 1) * unit];
    for (const [i, j] of HAND_CONNECTIONS) {
      const [x1, y1] = P(i);
      const [x2, y2] = P(j);
      ctx.strokeStyle = 'rgba(8,10,24,.85)';
      ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = s ? '#7DD3E0' : color;
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    for (let k = 0; k < 21; k++) {
      const [x, y] = P(k);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, y, k % 4 === 0 && k ? 7 : 5, 0, Math.PI * 2); ctx.fill();
    }
  }
}

export default function WordCanvas({ seq, progress = 0, className = '', label }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    drawWordFrame(ctx, seq, progress, c.width, c.height);
  }, [seq, progress]);
  return <canvas ref={ref} width={640} height={480} className={className} role="img" aria-label={label} />;
}
