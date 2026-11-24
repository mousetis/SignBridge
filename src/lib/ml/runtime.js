// Chọn backend TensorFlow.js (WebGPU / WebGL / CPU) bằng cách ĐO thật trên mô hình MLP nhỏ rồi nhớ kết quả.
// Lưu ý trung thực: với mô hình nhỏ (63→128→64→34) CPU thường nhanh ngang hoặc hơn GPU vì không tốn chi phí chuyển dữ liệu.
import * as tf from '@tensorflow/tfjs';

export const BACKENDS = ['webgpu', 'webgl', 'cpu'];

async function registerWebgpu() {
  try {
    if (typeof navigator === 'undefined' || !navigator.gpu) return false;
    await import('@tensorflow/tfjs-backend-webgpu');
    return true;
  } catch {
    return false;
  }
}

export async function available() {
  const out = ['cpu'];
  const g = typeof OffscreenCanvas !== 'undefined' || typeof document !== 'undefined';
  if (g) {
    try {
      const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
      if (c.getContext('webgl2') || c.getContext('webgl')) out.unshift('webgl');
    } catch { /* không có WebGL */ }
  }
  if (await registerWebgpu()) out.unshift('webgpu');
  return out;
}

export async function useBackend(name) {
  if (name === 'webgpu') await registerWebgpu();
  const ok = await tf.setBackend(name).catch(() => false);
  await tf.ready();
  return ok && tf.getBackend() === name;
}

/** Đo thời gian trung vị (ms) cho một lần dự đoán MLP + LSTM giả trên backend `name`. */
export async function timeBackend(name, n = 40) {
  if (!(await useBackend(name))) return null;
  const mlp = tf.sequential({ layers: [tf.layers.dense({ inputShape: [63], units: 128, activation: 'relu' }), tf.layers.dense({ units: 64, activation: 'relu' }), tf.layers.dense({ units: 34, activation: 'softmax' })] });
  const x = tf.zeros([1, 63]);
  for (let i = 0; i < 6; i++) mlp.predict(x).dataSync();
  const ts = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    mlp.predict(x).dataSync();
    ts.push(performance.now() - t0);
  }
  mlp.dispose();
  x.dispose();
  ts.sort((a, b) => a - b);
  return ts[Math.floor(ts.length / 2)];
}

/** Chọn backend: pref = 'auto' (đo) hoặc tên cụ thể. Trả về { name, results:{backend:ms}, list }. */
export async function chooseBackend(pref = 'auto') {
  const list = await available();
  const results = {};
  if (pref !== 'auto' && list.includes(pref) && (await useBackend(pref))) return { name: pref, results, list };
  for (const b of list) {
    try {
      const ms = await timeBackend(b);
      if (ms != null) results[b] = Number(ms.toFixed(3));
    } catch { /* bỏ qua backend lỗi */ }
  }
  const best = Object.entries(results).sort((a, b) => a[1] - b[1])[0]?.[0] || 'cpu';
  await useBackend(best);
  return { name: tf.getBackend(), results, list };
}
