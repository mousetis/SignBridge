// Huấn luyện LSTM (J, Z, NONE) từ dữ liệu TỔNG HỢP và ghi vào public/models/dynamic_lstm.
// MLP tĩnh mặc định được huấn luyện bằng dữ liệu bàn tay THẬT (npm run train:real) nên KHÔNG bị ghi đè ở đây.
// Muốn huấn luyện lại cả MLP tổng hợp (chất lượng thấp hơn, chỉ để thử nghiệm):  STATIC=1 npm run train:synthetic
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tf, buildStaticModel, buildDynamicModel, fitDataset, evaluateDataset } from '../src/lib/ml/models.js';
import { makeStaticDataset, makeDynamicDataset, SEQ_LEN, DYN_CLASSES } from '../src/lib/ml/synthetic.js';
import { STATIC_CLASSES } from '../src/config/systemConfig.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'models');
const PER_CLASS = Number(process.env.PER_CLASS || 350);
const EPOCHS = Number(process.env.EPOCHS || 22);

async function saveModel(model, dir) {
  mkdirSync(dir, { recursive: true });
  await model.save(
    tf.io.withSaveHandler(async (a) => {
      const manifest = {
        modelTopology: a.modelTopology,
        format: a.format,
        generatedBy: a.generatedBy,
        convertedBy: a.convertedBy,
        weightsManifest: [{ paths: ['weights.bin'], weights: a.weightSpecs }],
      };
      writeFileSync(join(dir, 'model.json'), JSON.stringify(manifest));
      writeFileSync(join(dir, 'weights.bin'), Buffer.from(a.weightData));
      return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
    }),
  );
}

await tf.ready();
console.log('Backend TF:', tf.getBackend());
const t0 = Date.now();

const DO_STATIC = process.env.STATIC === '1';
let sAcc = null;
if (DO_STATIC) {
// ---------- MLP tĩnh ----------
console.log(`\n[1/2] MLP tĩnh: ${STATIC_CLASSES.length} lớp × ${PER_CLASS} mẫu × 2 (phản chiếu trái/phải)`);
const sTrain = makeStaticDataset({ perClass: PER_CLASS, seed: 11 });
const sTest = makeStaticDataset({ perClass: 80, seed: 999 });
const sModel = buildStaticModel();
await fitDataset(sModel, sTrain, {
  epochs: EPOCHS,
  batchSize: 128,
  onEpoch: (e, n, l) => process.stdout.write(`\r  epoch ${e}/${n} loss=${l.loss.toFixed(3)} acc=${l.acc?.toFixed(3) ?? l.accuracy?.toFixed(3)}   `),
});
sAcc = evaluateDataset(sModel, sTest);
// Độ chính xác khi loại trừ các cặp giống hệt (O/0, V/2, W/6, F/9) – được phân biệt bằng chế độ Chữ/Số
const amb = new Set(['0', '2', '6', '9']);
let ok = 0;
let tot = 0;
{
  const x = tf.tensor(sTest.xs, [sTest.count, 63]);
  const pred = sModel.predict(x).argMax(-1).dataSync();
  x.dispose();
  for (let i = 0; i < sTest.count; i++) {
    const c = STATIC_CLASSES[sTest.ys[i]];
    if (amb.has(c)) continue;
    tot++;
    const p = STATIC_CLASSES[pred[i]];
    if (p === c || (amb.has(p) && ({ 0: 'O', 2: 'V', 6: 'W', 9: 'F' })[p] === c)) ok++;
  }
}
console.log(`\n  Độ chính xác tập kiểm tra tổng hợp: ${(sAcc * 100).toFixed(1)}% (34 lớp); ${((ok / tot) * 100).toFixed(1)}% khi gộp cặp giống hệt`);
await saveModel(sModel, join(outDir, 'static_mlp'));

}

// ---------- LSTM động ----------
console.log(`\n[LSTM] LSTM động: ${DYN_CLASSES.join(', ')} × 800 chuỗi ${SEQ_LEN} khung`);
const dTrain = makeDynamicDataset({ perClass: 800, seed: 5 });
const dTest = makeDynamicDataset({ perClass: 200, seed: 777 });
const dModel = buildDynamicModel();
await fitDataset(dModel, dTrain, {
  epochs: 12,
  batchSize: 64,
  shape: [SEQ_LEN, 4],
  onEpoch: (e, n, l) => process.stdout.write(`\r  epoch ${e}/${n} loss=${l.loss.toFixed(3)} acc=${(l.acc ?? l.accuracy)?.toFixed(3)}   `),
});
const dAcc = evaluateDataset(dModel, dTest, [SEQ_LEN, 4]);
console.log(`\n  Độ chính xác tập kiểm tra tổng hợp: ${(dAcc * 100).toFixed(1)}%`);
await saveModel(dModel, join(outDir, 'dynamic_lstm'));

const metaPath = join(outDir, 'meta.json');
const prev = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
writeFileSync(
  metaPath,
  JSON.stringify(
    {
      ...prev,
      staticClasses: STATIC_CLASSES,
      dynamicClasses: DYN_CLASSES,
      dynamicTrainedAt: new Date().toISOString(),
      syntheticAccuracy: { ...(prev.syntheticAccuracy || {}), ...(sAcc != null ? { static: sAcc } : {}), dynamic: dAcc },
      ...(DO_STATIC ? { note: 'MLP tĩnh huấn luyện trên dữ liệu TỔNG HỢP (STATIC=1).' } : {}),
    },
    null,
    2,
  ),
);
console.log(`\nXong sau ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${outDir}`);
