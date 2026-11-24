// Nạp một lần mỗi mô hình bàn tay .glb (dùng chung cho mọi khung 3D và ảnh chụp).
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HAND_MODELS, resolveHandStyle } from './handModels.js';

const cache = new Map();
export function loadGlbTemplate(style) {
  const id = resolveHandStyle(style);
  if (!cache.has(id)) {
    const p = new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${HAND_MODELS[id].url}`).then((g) => g.scene);
    p.catch(() => cache.delete(id)); // cho phép thử lại nếu lỗi mạng
    cache.set(id, p);
  }
  return cache.get(id);
}
