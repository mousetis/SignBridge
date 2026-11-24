import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tf } from '../../src/lib/ml/models.js';

export async function saveModel(model, dir) {
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
