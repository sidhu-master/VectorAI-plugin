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
  it('extracts bounded strokes and batches safe final analytic geometry from the real fixture', async () => {
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
            kind: chain.pieces.length === 1 && chain.pieces[0].candidate
              ? `${chain.pieces[0].candidate.type}-candidate`
              : 'polyline-candidate',
            bounds: { ...chain.bounds },
            confidence: chain.pieces[0]?.candidate?.confidence ?? 0.8,
            touchesRegionEdge: false,
            sampleCount: chain.samples.length,
          },
        })),
      };
      const steps = buildVectorizationSteps(persisted);
      const finalTypes = new Set(steps.flatMap((step) => (
        step.previewNodes.map((node) => node.type)
      )));
      const sourceDiagonal = Math.hypot(result.width, result.height);

      expect(result.chains.length).toBeGreaterThan(20);
      expect(steps.length).toBeLessThan(result.chains.length);
      expect(steps.every((step) => step.previewNodes.length <= 48)).toBe(true);
      expect(finalTypes.has('line')).toBe(true);
      expect([...finalTypes].some((type) => type === 'circle' || type === 'arc')).toBe(true);
      expect(result.chains.every((chain) => chain.samples.length > 0)).toBe(true);
      expect(result.chains.flatMap((chain) => chain.samples).every(([x, y]) => (
        x >= 0 && x < result.width && y >= 0 && y < result.height
      ))).toBe(true);
      expect(result.chains.every((chain) => {
        return chain.pieces.every((piece) => {
          const radius = piece.candidate?.parameters.radius;
          return typeof radius !== 'number' || radius <= sourceDiagonal;
        });
      })).toBe(true);
      expect(Math.max(...steps.map((step) => step.validation.junctionGapMaxPx)))
        .toBeLessThan(0.001);

      const reconstructedCircle = result.chains.find((chain) => (
        chain.closed
        && chain.bounds.x < result.width * 0.05
        && chain.bounds.y > result.height * 0.6
        && chain.bounds.width > result.width * 0.15
        && chain.pieces.length === 1
        && chain.pieces[0].candidate?.type === 'circle'
      ));
      expect(reconstructedCircle).toBeDefined();
      expect(reconstructedCircle?.pieces[0].candidate?.fitErrorP95)
        .toBeLessThan(reconstructedCircle!.segmentation.fitTolerancePx);
      const reconstructedNodes = steps.flatMap((step) => step.previewNodes).filter((node) => (
        node.quality.evidenceRefs.includes(`evidence_${reconstructedCircle?.id}` as never)
      ));
      expect(reconstructedNodes.map((node) => node.type)).toEqual(['circle']);

      const continuedMouthArc = result.chains.find((chain) => (
        !chain.closed
        && chain.segmentation.continuationAssembly?.modelType === 'arc'
        && chain.segmentation.continuationAssembly.sourceChainCount === 2
        && chain.bounds.x < result.width * 0.35
        && chain.bounds.y > result.height * 0.4
        && chain.bounds.y < result.height * 0.5
        && chain.bounds.width > result.width * 0.35
        && chain.pieces.length === 1
        && chain.pieces[0].candidate?.type === 'arc'
      ));
      expect(continuedMouthArc).toBeDefined();
      expect(continuedMouthArc?.pieces[0].candidate?.parameters.sweepDegrees)
        .toBeGreaterThan(80);
      const mouthNodes = steps.flatMap((step) => step.previewNodes).filter((node) => (
        node.quality.evidenceRefs.includes(`evidence_${continuedMouthArc?.id}` as never)
      ));
      expect(mouthNodes.map((node) => node.type)).toEqual(['arc']);

      const independentBranch = result.chains.find((chain) => (
        !chain.closed
        && chain.bounds.x > result.width * 0.48
        && chain.bounds.x < result.width * 0.5
        && chain.bounds.y > result.height * 0.3
        && chain.bounds.y < result.height * 0.35
        && chain.bounds.height > result.height * 0.15
        && chain.bounds.width < result.width * 0.01
        && chain.pieces[0]?.candidate?.type === 'line'
      ));
      expect(independentBranch).toBeDefined();

      const longPiecewiseLine = result.chains
        .filter((chain) => !chain.closed && chain.pieces.length === 2)
        .filter((chain) => chain.pieces.some((piece) => piece.candidate?.type === 'line'))
        .sort((left, right) => right.bounds.height - left.bounds.height)[0];
      expect(longPiecewiseLine).toBeDefined();
      expect(longPiecewiseLine.bounds.height).toBeGreaterThan(result.height * 0.15);
      expect(longPiecewiseLine.pieces[0].sampleRange[1])
        .toBe(longPiecewiseLine.pieces[1].sampleRange[0]);
      const compoundBatch = steps.find((step) => step.chainIds.includes(longPiecewiseLine.id));
      const compoundNodeIds = new Set(longPiecewiseLine.pieces.map((piece) => piece.id));
      expect(compoundBatch?.previewNodes.filter((node) => (
        node.quality.evidenceRefs.includes(`evidence_${longPiecewiseLine.id}` as never)
      )).map((node) => node.type)).toEqual(['line', 'line']);
      expect(compoundNodeIds.size).toBe(2);
      expect(compoundBatch?.commands.filter((command) => (
        command.type === 'feature.create'
        && command.value.properties.sourceChainId === longPiecewiseLine.id
      )))
        .toHaveLength(1);
    } finally {
      await provider.close();
    }
  }, 35_000);
});
