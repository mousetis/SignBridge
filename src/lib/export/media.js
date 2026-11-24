// Xuất đoạn diễn hoạt thành video WebM (MediaRecorder) hoặc ảnh GIF (gifenc). Chạy hoàn toàn trên máy người dùng.
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export const canRecordVideo = () => typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype;

function pickMime() {
  for (const m of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']) if (MediaRecorder.isTypeSupported?.(m)) return m;
  return '';
}

/**
 * Ghi lại khi `isDone()` trả về true (hoặc hết `maxMs`). `draw(ctx, w, h)` vẽ một khung hình lên canvas ghi hình.
 * @returns Promise<Blob>
 */
export function recordCanvas({ draw, isDone, start, format = 'webm', width = 640, height = 480, fps = 24, maxMs = 90000, onProgress, signal }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: format === 'gif' });
  const t0 = performance.now();
  const stopped = () => isDone() || signal?.aborted || performance.now() - t0 > maxMs;

  return new Promise((resolve, reject) => {
    if (format === 'gif') {
      const gif = GIFEncoder();
      const gifFps = Math.min(fps, 12);
      const delay = Math.round(1000 / gifFps);
      let tm;
      const step = () => {
        draw(ctx, width, height);
        const { data } = ctx.getImageData(0, 0, width, height);
        const palette = quantize(data, 128, { format: 'rgb444' });
        gif.writeFrame(applyPalette(data, palette, 'rgb444'), width, height, { palette, delay });
        onProgress?.(Math.min(0.99, (performance.now() - t0) / maxMs));
        if (stopped()) {
          gif.finish();
          resolve(new Blob([gif.bytes()], { type: 'image/gif' }));
        } else tm = setTimeout(step, delay);
      };
      start?.();
      tm = setTimeout(step, 0);
      signal?.addEventListener('abort', () => { clearTimeout(tm); reject(new DOMException('aborted', 'AbortError')); });
      return;
    }
    const mime = pickMime();
    const rec = new MediaRecorder(canvas.captureStream(fps), mime ? { mimeType: mime, videoBitsPerSecond: 3_000_000 } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => resolve(new Blob(chunks, { type: mime || 'video/webm' }));
    rec.onerror = (e) => reject(e.error || new Error('record'));
    rec.start(200);
    start?.();
    let raf;
    const loop = () => {
      draw(ctx, width, height);
      onProgress?.(Math.min(0.99, (performance.now() - t0) / maxMs));
      if (stopped()) {
        setTimeout(() => rec.state !== 'inactive' && rec.stop(), 150);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    signal?.addEventListener('abort', () => { cancelAnimationFrame(raf); rec.state !== 'inactive' && rec.stop(); });
  });
}
