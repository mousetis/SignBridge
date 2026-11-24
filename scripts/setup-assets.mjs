// Chạy tự động sau `npm install`.
// 1) Sao chép WASM của MediaPipe vào public/ để chạy được cả khi không có Internet (Edge computing).
// 2) Sao chép bộ MediaPipe Hands (kèm sẵn mô hình, KHÔNG cần tải thêm) -> chạy hoàn toàn offline.
// 3) Thử tải thêm hand_landmarker.task (tuỳ chọn, bộ nhận diện thế hệ mới). Tải lỗi cũng không sao.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmDst = join(root, 'public', 'mediapipe', 'wasm');
const modelDst = join(root, 'public', 'models', 'hand_landmarker.task');
const handsSrc = join(root, 'node_modules', '@mediapipe', 'hands');
const handsDst = join(root, 'public', 'mediapipe', 'hands');
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

try {
  if (existsSync(wasmSrc)) {
    mkdirSync(wasmDst, { recursive: true });
    cpSync(wasmSrc, wasmDst, { recursive: true });
    console.log('[setup-assets] Đã sao chép MediaPipe WASM ->', wasmDst);
  } else {
    console.warn('[setup-assets] Chưa thấy @mediapipe/tasks-vision/wasm (bỏ qua).');
  }
} catch (e) {
  console.warn('[setup-assets] Không sao chép được WASM:', e.message);
}

try {
  if (existsSync(handsSrc)) {
    mkdirSync(handsDst, { recursive: true });
    cpSync(handsSrc, handsDst, { recursive: true, filter: (f) => !/(README\.md|index\.d\.ts|package\.json)$/.test(f) });
    console.log('[setup-assets] Đã sao chép MediaPipe Hands (offline) ->', handsDst);
  } else {
    console.warn('[setup-assets] Chưa thấy @mediapipe/hands (chạy lại: npm install).');
  }
} catch (e) {
  console.warn('[setup-assets] Không sao chép được MediaPipe Hands:', e.message);
}

if (!existsSync(modelDst)) {
  try {
    mkdirSync(dirname(modelDst), { recursive: true });
    const res = await fetch(MODEL_URL, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    writeFileSync(modelDst, Buffer.from(await res.arrayBuffer()));
    console.log('[setup-assets] Đã tải hand_landmarker.task ->', modelDst);
  } catch (e) {
    console.warn(
      '[setup-assets] (không bắt buộc) Không tải được hand_landmarker.task (' + e.message + '). ' +
        'Ứng dụng vẫn chạy bình thường bằng bộ MediaPipe Hands đã sao chép ở trên.',
    );
  }
}
process.exit(0);
