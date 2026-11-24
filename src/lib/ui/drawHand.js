/**
 * Đánh dấu bàn tay trên camera: KHÔNG vẽ khung xương/khớp nữa, chỉ có khung bo tròn mềm bao quanh bàn tay
 * (đổi màu theo trạng thái: xanh = đủ chắc chắn, vàng = đang thu thập, đỏ = đang ghi mẫu…).
 * `lm` có thể là một bàn tay hoặc mảng nhiều bàn tay (opts.hands).
 */
export function drawHand(canvas, lm, { lineColor = '#FFC93C', W, H, hands } = {}) {
  const ctx = canvas.getContext('2d');
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  ctx.clearRect(0, 0, W, H);
  const list = hands?.length ? hands : lm ? [lm] : [];
  for (const h of list) {
    const primary = h === lm || list.length === 1;
    let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
    for (const p of h) {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    const padX = (x1 - x0) * 0.16 + 0.012, padY = (y1 - y0) * 0.14 + 0.012;
    const x = (x0 - padX) * W, y = (y0 - padY) * H;
    const w = (x1 - x0 + 2 * padX) * W, hh = (y1 - y0 + 2 * padY) * H;
    const r = Math.min(w, hh) * 0.14;
    const col = primary ? lineColor : '#7DD3E0';
    ctx.beginPath();
    ctx.roundRect(x, y, w, hh, r);
    ctx.fillStyle = `${col}1f`;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(8,10,24,.55)';
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = col;
    ctx.stroke();
  }
}
