// Kiến trúc & huấn luyện TensorFlow.js: MLP (34 ký tự tĩnh) và LSTM (J, Z + lớp NONE).
import * as tf from '@tensorflow/tfjs';
import { STATIC_CLASSES } from '../../config/systemConfig.js';
import { SEQ_LEN, DYN_CLASSES } from './synthetic.js';

export { tf };
// Hồ sơ "default" giữ khoá cũ (tương thích bản v1); hồ sơ khác thêm hậu tố -<id>.
export const staticDbKey = (id = 'default') => `indexeddb://signbridge-static-mlp${id === 'default' ? '' : `-${id}`}`;
export const dynamicDbKey = (id = 'default') => `indexeddb://signbridge-dynamic-lstm${id === 'default' ? '' : `-${id}`}`;
export const STATIC_DB_KEY = staticDbKey();
export const DYNAMIC_DB_KEY = dynamicDbKey();
export const STATIC_URL = '/models/static_mlp/model.json';
export const DYNAMIC_URL = '/models/dynamic_lstm/model.json';
export const KNN_URL = '/models/static_knn.bin';
export const META_URL = '/models/meta.json';

export function buildStaticModel(nClasses = STATIC_CLASSES.length, lr = 0.003) {
  const m = tf.sequential();
  m.add(tf.layers.dense({ inputShape: [63], units: 128, activation: 'relu', kernelInitializer: 'heNormal' }));
  m.add(tf.layers.dropout({ rate: 0.25 }));
  m.add(tf.layers.dense({ units: 64, activation: 'relu', kernelInitializer: 'heNormal' }));
  m.add(tf.layers.dropout({ rate: 0.15 }));
  m.add(tf.layers.dense({ units: nClasses, activation: 'softmax' }));
  m.compile({ optimizer: tf.train.adam(lr), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
  return m;
}

export function buildDynamicModel(nClasses = DYN_CLASSES.length, lr = 0.004) {
  const m = tf.sequential();
  m.add(tf.layers.lstm({ units: 32, inputShape: [SEQ_LEN, 4] }));
  m.add(tf.layers.dense({ units: 16, activation: 'relu' }));
  m.add(tf.layers.dense({ units: nClasses, activation: 'softmax' }));
  m.compile({ optimizer: tf.train.adam(lr), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
  return m;
}

/** Huấn luyện từ dataset {xs,ys,count,classes}. `shape` = [] cho MLP hoặc [SEQ_LEN,4] cho LSTM. */
export async function fitDataset(model, ds, { epochs = 20, batchSize = 128, validationSplit = 0.1, onEpoch, shape } = {}) {
  const inner = shape ? shape : [63];
  // Xáo trộn TRƯỚC khi tách validationSplit (Keras lấy 10% cuối làm tập kiểm tra – nếu không xáo, các lớp cuối sẽ không bao giờ được học)
  const dim = inner.reduce((a, b) => a * b, 1);
  const order = Array.from({ length: ds.count }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const sx = new Float32Array(ds.count * dim);
  const sy = new Int32Array(ds.count);
  order.forEach((src, dst) => {
    sx.set(ds.xs.subarray(src * dim, (src + 1) * dim), dst * dim);
    sy[dst] = ds.ys[src];
  });
  const x = tf.tensor(sx, [ds.count, ...inner]);
  const y = tf.oneHot(tf.tensor1d(sy, 'int32'), ds.classes.length);
  try {
    const hist = await model.fit(x, y, {
      epochs,
      batchSize,
      shuffle: true,
      validationSplit,
      callbacks: {
        onEpochEnd: async (ep, logs) => {
          if (onEpoch) onEpoch(ep + 1, epochs, logs);
          await tf.nextFrame();
        },
      },
    });
    return hist.history;
  } finally {
    x.dispose();
    y.dispose();
  }
}

export function evaluateDataset(model, ds, shape) {
  const inner = shape ? shape : [63];
  return tf.tidy(() => {
    const x = tf.tensor(ds.xs, [ds.count, ...inner]);
    const pred = model.predict(x).argMax(-1).dataSync();
    let ok = 0;
    for (let i = 0; i < ds.count; i++) if (pred[i] === ds.ys[i]) ok++;
    return ok / ds.count;
  });
}

async function tryLoad(url) {
  try {
    return await tf.loadLayersModel(url);
  } catch {
    return null;
  }
}

/** Ưu tiên mô hình do người dùng hiệu chỉnh (IndexedDB), sau đó mô hình đóng gói sẵn trong /models. */
export async function loadStatic(id = 'default') {
  let m = await tryLoad(staticDbKey(id));
  if (m) return { model: m, source: 'user' };
  m = await tryLoad(STATIC_URL);
  return m ? { model: m, source: 'bundled' } : { model: null, source: 'none' };
}
export async function loadDynamic(id = 'default') {
  let m = await tryLoad(dynamicDbKey(id));
  if (m) return { model: m, source: 'user' };
  m = await tryLoad(DYNAMIC_URL);
  return m ? { model: m, source: 'bundled' } : { model: null, source: 'none' };
}

export async function removeUserModels(id = 'default') {
  for (const k of [staticDbKey(id), dynamicDbKey(id)]) {
    try {
      await tf.io.removeModel(k);
    } catch {
      /* chưa có */
    }
  }
}
