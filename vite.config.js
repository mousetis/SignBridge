import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Sau build: điền danh sách tệp có mã băm + mã phiên bản vào sw.js.
function swPrecache() {
  return {
    name: 'sb-sw-precache',
    apply: 'build',
    closeBundle() {
      const dist = join(process.cwd(), 'dist');
      const sw = join(dist, 'sw.js');
      if (!existsSync(sw)) return;
      const dir = join(dist, 'assets');
      const files = existsSync(dir) ? readdirSync(dir).filter((f) => /\.(js|css|woff2?)$/.test(f)).map((f) => `/assets/${f}`) : [];
      // Gói nặng (three/tfjs/mediapipe) chỉ lưu khi dùng thật, không tải trước toàn bộ
      const light = files.filter((f) => !/(three|tfjs|mediapipe)-/.test(f));
      const version = String(Date.now().toString(36));
      let src = readFileSync(sw, 'utf8');
      src = src.replace('/*__PRECACHE__*/[]', JSON.stringify(light)).replace('__VERSION__', version);
      writeFileSync(sw, src);
    },
  };
}

export default defineConfig({
  plugins: [react(), swPrecache()],
  worker: { format: 'es' },
  // Mặc định chỉ mở ở localhost (camera chỉ chạy ở localhost/https) và tự mở trình duyệt.
  server: { port: 5173, strictPort: false, open: '/#/' },
  build: {
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('@tensorflow')) return 'tfjs';
          if (id.includes('@mediapipe')) return 'mediapipe';
        },
      },
    },
  },
});
