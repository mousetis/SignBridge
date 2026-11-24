// Máy chủ giả lập ESP32-S3 để thử giao diện khi chưa có phần cứng.
//   npm run mock:esp32           -> ws://localhost:81/ws  (nhập "localhost" hoặc IP máy tính vào ô địa chỉ)
//   Chỉ gửi áp suất thô:   node tools/esp32-mock-server.mjs --raw     (Web tự nhận cử chỉ thổi/hút)
//   Cổng khác:             npm run mock:esp32 -- --port=8081
// Cứ 20 ms gửi một gói JSON: {"x":..,"y":..,"kpa":..,"event":null|"PUFF_CLICK"|...}
import { WebSocketServer } from 'ws';

const portArg = process.argv.find((a) => a.startsWith('--port='));
const PORT = Number(portArg ? portArg.split('=')[1] : process.env.PORT || 81);
const RAW = process.argv.includes('--raw');
const wss = new WebSocketServer({ port: PORT, path: '/ws' });
console.log(`ESP32-S3 giả lập: ws://localhost:${PORT}/ws  (${RAW ? 'chỉ áp suất thô' : 'có trường event'})`);

wss.on('connection', (ws, req) => {
  console.log('Web đã kết nối từ', req.socket.remoteAddress);
  const t0 = Date.now();
  let lastEvent = 0;
  let evIdx = 0;
  // Kịch bản: Joystick vẽ vòng tròn; mỗi 4 giây có một thao tác thổi/hút
  const SCRIPT = ['PUFF_CLICK', 'PUFF_CLICK', 'SIP_RIGHT_CLICK', 'HOLD_DRAG', 'DRAG_END'];
  const timer = setInterval(() => {
    const t = (Date.now() - t0) / 1000;
    const x = Number((0.7 * Math.cos(t * 0.9)).toFixed(3));
    const y = Number((0.7 * Math.sin(t * 0.9)).toFixed(3));
    let kpa = 0.02 * Math.sin(t * 7);
    let event = null;
    const now = Date.now();
    if (now - lastEvent > 4000) {
      lastEvent = now;
      event = SCRIPT[evIdx++ % SCRIPT.length];
    }
    if (event === 'PUFF_CLICK' || event === 'HOLD_DRAG') kpa = 0.8;
    if (event === 'SIP_RIGHT_CLICK') kpa = -0.8;
    const msg = RAW ? { x, y, kpa } : { x, y, kpa: Number(kpa.toFixed(3)), event };
    ws.send(JSON.stringify(msg));
  }, 20);

  ws.on('message', (m) => {
    try {
      const o = JSON.parse(String(m));
      if (o.type === 'config') console.log('Nhận cấu hình:', JSON.stringify(o));
    } catch {
      /* bỏ qua */
    }
  });
  ws.on('close', () => {
    clearInterval(timer);
    console.log('Web đã ngắt kết nối');
  });
});
