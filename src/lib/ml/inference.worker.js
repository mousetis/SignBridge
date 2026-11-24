// Web Worker: giữ mô hình TensorFlow.js (MLP tĩnh + LSTM động) để luồng giao diện không bị khựng.
import { tf, loadStatic, loadDynamic } from './models.js';
import { chooseBackend } from './runtime.js';

let staticModel = null;
let dynamicModel = null;
const SEQ = 20;

async function init({ profileId, backend, hint }) {
  let info = await chooseBackend(backend === 'auto' && hint ? hint : backend);
  if (backend === 'auto' && hint && info.name !== hint) info = await chooseBackend('auto'); // gợi ý cũ không dùng được -> đo lại
  const s = await loadStatic(profileId);
  const d = await loadDynamic(profileId);
  staticModel?.dispose();
  dynamicModel?.dispose();
  staticModel = s.model;
  dynamicModel = d.model;
  if (staticModel) tf.tidy(() => staticModel.predict(tf.zeros([1, 63])).dataSync());
  if (dynamicModel) tf.tidy(() => dynamicModel.predict(tf.zeros([1, SEQ, 4])).dataSync());
  return { backend: info.name, bench: info.results, list: info.list, staticSource: s.source, dynamicSource: d.source };
}

self.onmessage = async (e) => {
  const { id, type, payload } = e.data;
  try {
    if (type === 'init') self.postMessage({ id, type, result: await init(payload) });
    else if (type === 'static') {
      const t0 = performance.now();
      const r = staticModel ? tf.tidy(() => staticModel.predict(tf.tensor2d(payload.feat, [1, 63])).dataSync().slice()) : null;
      self.postMessage({ id, type, result: r, ms: performance.now() - t0 });
    } else if (type === 'dynamic') {
      const r = dynamicModel ? tf.tidy(() => dynamicModel.predict(tf.tensor3d(payload.seq, [1, SEQ, 4])).dataSync().slice()) : null;
      self.postMessage({ id, type, result: r });
    }
  } catch (err) {
    self.postMessage({ id, type, error: String(err?.message || err) });
  }
};
