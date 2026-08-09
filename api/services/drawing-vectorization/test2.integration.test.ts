import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { buildVectorizationSteps } from './build-steps.js';
import { PythonVectorizationProvider } from './python-provider.js';
import type { PersistedCleanLineVectorizationResult } from './types.js';

const fixturePath = resolve(process.cwd(), 'test2.png');

describe.skipIf(!existsSync(fixturePath))('test2 clean-line vectorization', () => {
  it('extracts bounded strokes and safe analytic promotions from the real fixture', async () => {
    const bytes = await readFile(fixturePath);
    const metadata = await sharp(bytes).metadata();
    const provider = await PythonVectorizationProvider.create({ timeoutMs: 30_000 });
    try {
      const result = await provider.vectorize({
        source: {
          sourceId: 'test2', mimeType: 'image/png', bytes,
          width: metadata.width!, height: metadata.height!,
        },
        maxPixels: 4_000_000,
        signal: new AbortController().signal,
      });
      const persisted: PersistedCleanLineVectorizationResult = {
        ...result,
        chains: result.chains.map((chain) => ({
          ...chain,
          evidence: {
            handle: `evidence_${chain.id}`,
            sourceId: result.sourceId,
            regionId: `vector_${chain.id}`,
            kind: chain.candidate ? `${chain.candidate.type}-candidate` : 'polyline-candidate',
            bounds: { ...chain.bounds },
            confidence: chain.candidate?.confidence ?? 0.8,
            touchesRegionEdge: false,
            sampleCount: chain.samples.length,
          },
        })),
      };
      const steps = buildVectorizationSteps(persisted);
      const drafts = steps.filter((step) => step.kind === 'draft');
      const promotions = steps.filter((step) => step.kind === 'promotion');
      const promotionTypes = new Set(promotions.map((step) => step.previewNode.type));
      const sourceDiagonal = Math.hypot(result.width, result.height);

      expect(result.chains.length).toBeGreaterThan(20);
      expect(drafts).toHaveLength(result.chains.length);
      expect(promotions.length).toBeGreaterThan(0);
      expect(promotionTypes.has('line')).toBe(true);
      expect([...promotionTypes].some((type) => type === 'circle' || type === 'arc')).toBe(true);
      expect(result.chains.every((chain) => chain.samples.length > 0)).toBe(true);
      expect(result.chains.flatMap((chain) => chain.samples).every(([x, y]) => (
        x >= 0 && x < result.width && y >= 0 && y < result.height
      ))).toBe(true);
      expect(result.chains.every((chain) => {
        const radius = chain.candidate?.parameters.radius;
        return typeof radius !== 'number' || radius <= sourceDiagonal;
      })).toBe(true);
    } finally {
      await provider.close();
    }
  }, 35_000);
});
