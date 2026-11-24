import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { HandRig } from '../../lib/hand/handRig.js';
import { handModelOf, resolveHandStyle } from '../../lib/hand/handModels.js';
import { PoseAnimator } from '../../lib/hand/animator.js';
import { addStageLights, STAGE_BACKGROUND } from '../../lib/hand/stage.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useT } from '../../i18n/index.jsx';

/**
 * Khung hiển thị bàn tay 3D (kiểu tay, tay trái/phải, tông da – lấy từ cài đặt hồ sơ).
 * `onFrame(animator, rig, dt)` được gọi mỗi khung hình vẽ. Kéo để xoay 360°, cuộn để phóng to/thu nhỏ.
 * Ref: animator, rig, resetView(), setAutoRotate(v), renderNow() → canvas (để xuất video/GIF).
 */
const Hand3DViewer = forwardRef(function Hand3DViewer({ onFrame, autoRotate = false, className = '', label, framing = 'hand' }, ref) {
  const { t } = useT();
  const { settings } = useSettings();
  const { skin, side, style } = settings.hand;
  const mountRef = useRef(null);
  const apiRef = useRef({});
  const frameCb = useRef(onFrame);
  frameCb.current = onFrame;
  const [error, setError] = useState(null);
  const aria = label || t('hand.label');

  useImperativeHandle(ref, () => ({
    get animator() { return apiRef.current.animator; },
    get rig() { return apiRef.current.rig; },
    resetView: () => apiRef.current.resetView?.(),
    setAutoRotate: (v) => apiRef.current.controls && (apiRef.current.controls.autoRotate = v),
    renderNow: () => apiRef.current.renderNow?.(),
  }));

  useEffect(() => {
    const mount = mountRef.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) {
      setError(t('hand.noWebgl'));
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.setAttribute('aria-label', aria);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 300);
    let homeY = 0;
    const home = new THREE.Vector3();

    addStageLights(scene);

    const rig = new HandRig({ skin, side, style });
    scene.add(rig.group);
    scene.add(rig.trail);
    const animator = new PoseAnimator(rig);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, homeY, 0);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minDistance = 28;
    controls.maxDistance = 120;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 3.2;
    // vị trí camera ban đầu phụ thuộc kích thước từng mô hình
    const setView = (st) => {
      const v = handModelOf(st).view;
      homeY = framing === 'hand' ? v.y : v.y - 4.5;
      home.set(0, homeY + 1.5, v.dist);
      camera.position.copy(home);
      controls.target.set(0, homeY, 0);
      controls.update();
    };
    setView(style);

    const renderNow = () => {
      controls.update();
      renderer.render(scene, camera);
      return renderer.domElement;
    };
    apiRef.current = {
      animator, rig, controls, renderNow, setView,
      resetView: () => {
        camera.position.copy(home);
        controls.target.set(0, homeY, 0);
        controls.update();
      },
    };

    const resize = () => {
      const w = mount.clientWidth || 300;
      const h = mount.clientHeight || 300;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const clock = new THREE.Clock();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, clock.getDelta());
      frameCb.current?.(animator, rig, dt);
      renderNow();
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      rig.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
      apiRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Đổi tay / tông da / kiểu tay không cần dựng lại cảnh
  useEffect(() => {
    const r = apiRef.current.rig;
    if (!r) return;
    r.setSide(side);
    r.setSkin(skin);
    if (r.opts.style !== resolveHandStyle(style)) apiRef.current.setView?.(style);
    r.setStyle(style);
  }, [side, skin, style]);

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-rule bg-gradient-to-b from-stage to-[rgb(var(--stage)/0.82)] ${className}`} style={{ background: STAGE_BACKGROUND }}>
      <div ref={mountRef} className="h-full w-full" role="img" aria-label={aria} />
      {error && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-[1.05rem] font-bold text-onstage">{error}</div>}
    </div>
  );
});

export default Hand3DViewer;
