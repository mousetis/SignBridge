// Nạp tệp .glb trong Node (không có DOM): bỏ phần ảnh/kết cấu trong JSON rồi để GLTFLoader phân tích — đủ để kiểm tra xương và lưới.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export async function parseGlbNode(buf) {
  const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + jsonLen)));
  delete json.textures; delete json.images; delete json.samplers;
  for (const m of json.materials || []) {
    const strip = (o) => { if (!o || typeof o !== 'object') return; for (const k of Object.keys(o)) { if (/Texture$/.test(k)) delete o[k]; else strip(o[k]); } };
    strip(m);
  }
  let js = new TextEncoder().encode(JSON.stringify(json));
  const pad = (4 - (js.length % 4)) % 4;
  const jsPadded = new Uint8Array(js.length + pad).fill(0x20);
  jsPadded.set(js);
  const rest = u8.subarray(20 + jsonLen); // các khối nhị phân giữ nguyên
  const out = new Uint8Array(20 + jsPadded.length + rest.length);
  const odv = new DataView(out.buffer);
  out.set(u8.subarray(0, 12)); odv.setUint32(8, out.length, true);
  odv.setUint32(12, jsPadded.length, true); out.set(u8.subarray(16, 20), 16);
  out.set(jsPadded, 20); out.set(rest, 20 + jsPadded.length);
  return new GLTFLoader().parseAsync(out.buffer, '');
}
