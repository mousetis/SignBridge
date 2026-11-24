import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/index.jsx';
import { getHandLandmarker } from '../lib/ml/handTracker.js';

const handSize = (l) => Math.hypot(l[0].x - l[9].x, l[0].y - l[9].y);

/**
 * Mở webcam + MediaPipe Hands, gọi onFrame(landmarks|null, width, height, timestamp) ~30 FPS.
 * onFrame được giữ trong ref để không phải khởi động lại camera khi component render lại.
 */
export function useHandTracker({ enabled, videoRef, onFrame, retryKey = 0, deviceId = '', maxHands = 1 }) {
  const [status, setStatus] = useState('idle'); // idle | starting | running | error
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const [fps, setFps] = useState(0);
  const [cameras, setCameras] = useState([]);
  const { t: tt } = useT();
  const ttRef = useRef(tt);
  ttRef.current = tt;
  const cb = useRef(onFrame);
  cb.current = onFrame;

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return undefined;
    }
    let cancelled = false;
    let stream = null;
    let raf = 0;
    let vfc = 0;
    setStatus('starting');
    setError(null);
    setErrorCode(null);

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          const err = new Error(location.protocol === 'file:' ? ttRef.current('camera.err.file') : ttRef.current('camera.err.insecure', { host: location.host }));
          err.code = 'insecure';
          throw err;
        }
        // Mở camera TRƯỚC để lỗi camera và lỗi mô hình AI được báo tách bạch.
        let s;
        try {
          const vc = { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } };
          try {
            s = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { ...vc, deviceId: { exact: deviceId } } : vc, audio: false });
          } catch (e1) {
            if (deviceId && (e1.name === 'OverconstrainedError' || e1.name === 'NotFoundError')) s = await navigator.mediaDevices.getUserMedia({ video: vc, audio: false }); // camera đã chọn không còn -> dùng mặc định
            else throw e1;
          }
        } catch (camErr) {
          camErr.stage = 'camera';
          throw camErr;
        }
        let landmarker;
        try {
          landmarker = await getHandLandmarker();
        } catch (aiErr) {
          s.getTracks().forEach((t) => t.stop());
          aiErr.stage = 'ai';
          throw aiErr;
        }
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current;
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play();
        landmarker.setMaxHands?.(maxHands);
        const devs = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        setCameras(devs.filter((d) => d.kind === 'videoinput'));
        setStatus('running');

        let lastVideoTime = -1;
        let frames = 0;
        let fpsT = performance.now();
        let busy = false;
        const handle = (r, now) => {
          const all = r?.landmarks || [];
          // Sắp theo vị trí cổ tay trong ảnh (trái → phải) để thứ tự hai tay luôn ổn định
          const hands = all.length > 1 ? [...all].sort((a, b) => a[0].x - b[0].x) : all;
          const lm = all.length > 1 ? all.reduce((a, b) => (handSize(b) > handSize(a) ? b : a)) : all[0] || null;
          const v = videoRef.current;
          if (!v) return;
          cb.current?.(lm, v.videoWidth, v.videoHeight, now, { hands });
          frames++;
          if (now - fpsT >= 1000) {
            setFps(Math.round((frames * 1000) / (now - fpsT)));
            frames = 0;
            fpsT = now;
          }
        };
        const tick = () => {
          if (cancelled) return;
          const v = videoRef.current;
          if (v && !busy && v.readyState >= 2 && v.currentTime !== lastVideoTime) {
            lastVideoTime = v.currentTime;
            const now = performance.now();
            try {
              const out = landmarker.detectForVideo(v, now);
              if (out && typeof out.then === 'function') {
                busy = true; // bản đóng gói sẵn xử lý bất đồng bộ: không gửi chồng khung hình
                out.then((r) => !cancelled && handle(r, now)).catch(() => {}).finally(() => { busy = false; });
              } else handle(out, now);
            } catch {
              /* khung hình lỗi – bỏ qua */
            }
          }
          if (v && 'requestVideoFrameCallback' in v) vfc = v.requestVideoFrameCallback(tick);
          else raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        if (cancelled) return;
        const name = e?.name;
        setErrorCode(e?.code || null);
        setError(
          name === 'NotAllowedError' ? ttRef.current('camera.err.denied')
            : name === 'NotFoundError' || name === 'OverconstrainedError' ? ttRef.current('camera.err.none')
            : name === 'NotReadableError' ? ttRef.current('camera.err.busy')
            : e.stage === 'ai' ? ttRef.current('camera.err.ai') + (e.message || '?')
            : e.message || ttRef.current('camera.err.generic'),
        );
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      const v = videoRef.current;
      if (v && vfc && 'cancelVideoFrameCallback' in v) v.cancelVideoFrameCallback(vfc);
      stream?.getTracks().forEach((t) => t.stop());
      if (v) v.srcObject = null;
    };
  }, [enabled, videoRef, retryKey, deviceId, maxHands]);

  return { status, error, errorCode, fps, cameras };
}
