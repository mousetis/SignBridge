import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tf } from '../../src/lib/ml/models.js';

export async function loadModelDir(dir) {
  const mj = JSON.parse(readFileSync(join(dir, 'model.json'), 'utf8'));
  const weightData = readFileSync(join(dir, 'weights.bin'));
  const ab = weightData.buffer.slice(weightData.byteOffset, weightData.byteOffset + weightData.byteLength);
  return tf.loadLayersModel(tf.io.fromMemory({ modelTopology: mj.modelTopology, weightSpecs: mj.weightsManifest[0].weights, weightData: ab }));
}
