// MediaPipe Hands (HandLandmarker – @mediapipe/tasks-vision): trích 21 điểm khớp bàn tay từ video.
// Ưu tiên WASM + mô hình đặt trong /public (chạy offline); nếu thiếu sẽ dùng CDN.
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { systemConfig } from '../../config/systemConfig.js';

const ht = systemConfig.ai_sign_to_text_engine.hand_tracking;
const WASM_LOCAL = '/mediapipe/wasm';
const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm';
const MODEL_LOCAL = '/models/hand_landmarker.task';
const MODEL_CDN = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// Vite trả index.html (200) cho file không tồn tại, nên phải kiểm tra content-type.
async function exists(url, minBytes = 0) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    const ct = r.headers.get('content-type') || '';
    const len = Number(r.headers.get('content-length') || 0);
    return r.ok && !ct.includes('text/html') && len >= minBytes;
  } catch {
    return false;
  }
}

const HANDS_LOCAL = '/mediapipe/hands';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.crossOrigin = 'anonymous';
    el.onload = resolve;
    el.onerror = () => reject(new Error(`không tải được ${src}`));
    document.head.appendChild(el);
  });
}

/**
 * MediaPipe Hands "bản đóng gói sẵn" (@mediapipe/hands): mô hình nằm ngay trong gói npm nên chạy được offline,
 * không phải tải thêm tệp nào. Bọc lại để có cùng giao diện detectForVideo() như HandLandmarker.
 */
async function createLegacy() {
  if (!(await exists(`${HANDS_LOCAL}/hands.js`, 10_000)) || !(await exists(`${HANDS_LOCAL}/hand_landmark_full.tflite`, 100_000))) {
    throw new Error('thiếu public/mediapipe/hands (chạy "npm run setup:assets")');
  }
  if (!window.Hands) await loadScript(`${HANDS_LOCAL}/hands.js`);
  const hands = new window.Hands({ locateFile: (f) => `${HANDS_LOCAL}/${f}` });
  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: ht.min_detection_confidence,
    minTrackingConfidence: ht.min_tracking_confidence,
    selfieMode: false,
  });
  let last = null;
  hands.onResults((r) => {
    last = r;
  });
  await hands.initialize();
  return {
    kind: 'legacy',
    async detectForVideo(video) {
      last = null;
      await hands.send({ image: video });
      return { landmarks: last?.multiHandLandmarks || [] };
    },
    setMaxHands: (n) => hands.setOptions({ maxNumHands: n }),
    close: () => hands.close?.(),
  };
}

let cached = null;
export function getHandLandmarker() {
  if (!cached) cached = create().catch((e) => ((cached = null), Promise.reject(e)));
  return cached;
}
export function closeHandLandmarker() {
  cached?.then((l) => l.close()).catch(() => {});
  cached = null;
}

async function create() {
  let legacyErr = null;
  try {
    return await createLegacy();
  } catch (e) {
    legacyErr = e;
  }
  try {
    return await createTasks();
  } catch (e) {
    const why = (x) => (x instanceof Event ? `lỗi tải tệp (${x.type})` : String(x?.message || x || 'không rõ'));
    throw new Error(`Không khởi tạo được MediaPipe Hands. Bản đóng gói sẵn: ${why(legacyErr)}. Bản tải mô hình: ${why(e)}. Hãy chạy "npm run setup:assets" (cần chạy "npm install" trước) rồi tải lại trang.`);
  }
}

async function createTasks() {
  const localWasm = await exists(`${WASM_LOCAL}/vision_wasm_internal.wasm`);
  const localModel = await exists(MODEL_LOCAL, 1_000_000);
  const combos = [];
  combos.push([localWasm ? WASM_LOCAL : WASM_CDN, localModel ? MODEL_LOCAL : MODEL_CDN]);
  if (localWasm || localModel) combos.push([WASM_CDN, MODEL_CDN]);
  let lastErr;
  for (const [wasm, model] of combos) {
    const fileset = await FilesetResolver.forVisionTasks(wasm);
    for (const delegate of ['GPU', 'CPU']) {
      try {
        const lm = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: model, delegate },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: ht.min_detection_confidence,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: ht.min_tracking_confidence,
        });
        lm.kind = 'tasks';
        lm.setMaxHands = (n) => lm.setOptions({ numHands: n });
        return lm;
      } catch (e) {
        lastErr = e;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(lastErr instanceof Event ? `lỗi tải tệp (${lastErr.type})` : String(lastErr?.message || lastErr || 'không rõ'));
}
