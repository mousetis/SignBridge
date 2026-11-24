// Ánh sáng "studio" dùng chung cho khung xem 3D và ảnh chụp bàn tay (từ điển): ánh sáng dịu, nhiều ánh sáng môi trường, nền sáng.
import * as THREE from 'three';

export const STAGE_BACKGROUND = 'radial-gradient(120% 90% at 50% 22%, #ffffff 0%, #f4eefb 55%, #e8e0f4 100%)';

/** Thêm đèn vào cảnh. */
export function addStageLights(scene) {
  const hemi = new THREE.HemisphereLight('#fff6ee', '#d8c8d8', 1.75);
  const key = new THREE.DirectionalLight('#fff1e0', 1.35);
  key.position.set(16, 30, 42);
  const fill = new THREE.DirectionalLight('#c3d3ff', 0.9);
  fill.position.set(-30, 8, 26);
  const rim = new THREE.DirectionalLight('#a9e0ee', 0.5);
  rim.position.set(-30, 14, -26);
  const under = new THREE.DirectionalLight('#ffd9c4', 0.6); // ánh bật từ dưới giúp lòng bàn tay không bị tối
  under.position.set(6, -24, 30);
  scene.add(hemi, key, fill, rim, under);
}
