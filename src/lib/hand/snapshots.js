// Ảnh chụp bàn tay 3D cho từ điển: dùng CHÍNH mô hình bàn tay (HandRig) vẽ ngoài màn hình rồi lưu thành ảnh PNG (có đệm nhớ),
// nên mỗi ký hiệu hiện ra giống bàn tay thật thay vì sơ đồ xương. Hàng đợi tuần tự để không làm đơ giao diện.
import * as THREE from 'three';
import { HandRig } from './handRig.js';
import { PoseAnimator, HOLD_DYNAMIC } from './animator.js';
import { addStageLights } from './stage.js';
import { resolveHandStyle } from './handModels.js';

let env = null;
const cache = new Map();
let chain = Promise.resolve();

function ensure() {
  if (env) return env;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  addStageLights(scene);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 300);
  const rig = new HandRig({ skin: 2, side: 'right' });
  scene.add(rig.group);
  scene.add(rig.trail);
  const animator = new PoseAnimator(rig);
  env = { renderer, scene, camera, rig, animator };
  return env;
}

const tmp = new THREE.Vector3();
function frame(e, ch, { yaw, pitch }) {
  const { rig, animator, camera } = e;
  animator.load([ch]);
  animator.mode = 'once';
  animator.seek(0);
  if (ch === 'J' || ch === 'Z') {
    // vẽ quỹ đạo chuyển động (chấm vàng) cho ký tự động
    animator.restart();
    animator.play();
    for (let t = 0; t < 0.3 + HOLD_DYNAMIC + 0.05; t += 1 / 30) animator.update(1 / 30);
  }
  rig.group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  rig.skeleton.getLandmarks().forEach((v) => box.expandByPoint(tmp.copy(v).applyMatrix4(rig.group.matrixWorld)));
  box.expandByPoint(rig.skeleton.nodes[0].localToWorld(new THREE.Vector3(0, -rig.belowWrist, 0))); // đoạn cổ tay/cẳng tay của mô hình
  box.expandByScalar(rig.framePad);
  const c = box.getCenter(new THREE.Vector3());
  const s = box.getSize(new THREE.Vector3());
  const half = Math.max(s.x, s.y) / 2;
  const dist = half / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) + s.z / 2 + 1.5;
  const cy = Math.cos(pitch);
  camera.position.set(c.x + Math.sin(yaw) * cy * dist, c.y + Math.sin(pitch) * dist, c.z + Math.cos(yaw) * cy * dist);
  camera.lookAt(c);
  camera.updateProjectionMatrix();
}

/**
 * @returns {Promise<string>} data URL PNG nền trong suốt
 * @param opts { skin, side, style, size(px), yaw(độ), pitch(độ) }
 */
export function handSnapshot(ch, { skin = 2, side = 'right', style, size = 360, yaw = -10, pitch = 6 } = {}) {
  style = resolveHandStyle(style);
  const key = [ch, skin, side, style, size, yaw, pitch].join('|');
  if (cache.has(key)) return cache.get(key);
  const p = (chain = chain.then(() => new Promise((resolve, reject) => {
    // nhường luồng giao diện giữa các ảnh
    setTimeout(async () => {
      try {
        const e = ensure();
        e.rig.setSide(side);
        e.rig.setSkin(skin);
        await e.rig.setStyle(style);
        e.renderer.setSize(size, size, false);
        frame(e, ch, { yaw: THREE.MathUtils.degToRad(yaw), pitch: THREE.MathUtils.degToRad(pitch) });
        e.renderer.render(e.scene, e.camera);
        resolve(e.renderer.domElement.toDataURL('image/png'));
      } catch (err) {
        cache.delete(key);
        reject(err);
      }
    }, 0);
  })));
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}

export function clearHandSnapshots() {
  cache.clear();
}
