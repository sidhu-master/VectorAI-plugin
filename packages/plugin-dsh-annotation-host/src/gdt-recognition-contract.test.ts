// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeShaftPartition } from '@vectorai/engineering-annotation';
import { importDxf } from '../../dxf-import/src/index';
import { describe, expect, it, vi } from 'vitest';
import { createAnnotationRecognitionRunner } from './annotation-recognition-runtime';
import type { GdtRecommendation } from './gdt-grounding';
import {
  GDT_SEMANTIC_PIPELINE_ID,
  type AutomaticGdtReviewInput,
} from './gdt-reviewer';
import { recognitionDigest, type RecognitionModelPort } from './recognition-runtime';

const fixtureDirectory = resolve(import.meta.dirname, '../../engineering-annotation/test/fixtures/golden-shaft-001');

describe('shaft GD&T recognition contract', () => {
  it('keeps the golden shaft datum, control and surface-texture semantics stable without model drift', async () => {
    const engineeringText = readFileSync(resolve(fixtureDirectory, 'engineering-data.ini'), 'utf8');
    const imported = importDxf({
      bytes: readFileSync(resolve(fixtureDirectory, 'initial.dxf')),
      source: { name: 'initial.dxf', digest: 'sha256:gdt-contract' },
      drawingId: 'contract:gdt',
      now: () => 1,
    });
    if (imported.status !== 'imported') throw new Error('CONTRACT_FIXTURE_IMPORT_FAILED');
    const ref = { drawingId: 'contract:gdt', revision: 1 };
    const analyzed = analyzeShaftPartition({
      document: imported.document,
      drawingRef: ref,
      engineeringText,
      drawingSourceName: 'initial.dxf',
    });
    if (analyzed.status !== 'drafted') throw new Error('CONTRACT_PARTITION_FAILED');
    const agent = { id: 'contract:gdt' } as AutomaticGdtReviewInput['agent'];
    const review = vi.fn(async () => { throw new Error('MODEL_MUST_NOT_RUN_FOR_DOCUMENTED_GOLDEN_FIXTURE'); });
    const runner = createAnnotationRecognitionRunner({ review } as RecognitionModelPort, {
      getSnapshot: () => ({
        version: 1,
        ref,
        document: imported.document,
        capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
      }),
      renderObservation: async () => { throw new Error('MODEL_MUST_NOT_RUN_FOR_DOCUMENTED_GOLDEN_FIXTURE'); },
    });

    const report = await runner.evaluate<AutomaticGdtReviewInput, GdtRecommendation>({
      id: 'golden-shaft-gdt-v1',
      pipelineId: GDT_SEMANTIC_PIPELINE_ID,
      input: { agent, partition: analyzed.draft },
      attempts: 3,
      fixtureDigest: recognitionDigest({ fixture: 'golden-shaft-001', scope: 'gdt-and-surface-texture' }),
      policyDigests: [recognitionDigest('shaft-gdt-semantic-review@1')],
      assert: (output) => compareGoldenSemantics(output),
    });

    expect(report.attempts.map(({ failures }) => failures)).toEqual([[], [], []]);
    expect(report.passed).toBe(true);
    expect(report.attempts).toHaveLength(3);
    expect(report.attempts.every(({ trace }) => trace.map(({ id }) => id).join(',') === 'gdt-local-resolution')).toBe(true);
    expect(report.attempts.every(({ modelObservations }) => modelObservations.length === 0)).toBe(true);
    expect(review).not.toHaveBeenCalled();
  });
});

function compareGoldenSemantics(output: GdtRecommendation): string[] {
  const failures: string[] = [];
  if (JSON.stringify(output.datums.map(({ name }) => name)) !== JSON.stringify(['A', 'B'])) {
    failures.push('datum order changed');
  }
  const characteristicCounts = count(output.controls.map(({ characteristic }) => characteristic));
  const expectedCounts = {
    circularity: 2,
    cylindricity: 2,
    'total-runout': 2,
    'circular-runout': 2,
  };
  if (JSON.stringify(characteristicCounts) !== JSON.stringify(expectedCounts)) {
    failures.push(`control set changed: ${JSON.stringify(characteristicCounts)}`);
  }
  const referencedControls = output.controls.filter(({ datumNames }) => datumNames.length > 0);
  if (referencedControls.some(({ datumNames }) => JSON.stringify(datumNames) !== JSON.stringify(['A', 'B']))) {
    failures.push('referenced control datum frame changed');
  }
  const textures = (output.surfaceTextures ?? []).map(({ parameter, value, materialRemoval }) => ({
    parameter,
    value,
    materialRemoval,
  }));
  if (JSON.stringify(textures) !== JSON.stringify([
    { parameter: 'Ra', value: 0.8, materialRemoval: 'required' },
    { parameter: 'Ra', value: 0.8, materialRemoval: 'required' },
  ])) {
    failures.push(`surface-texture set changed: ${JSON.stringify(textures)}`);
  }
  const textureGeometryIds = (output.surfaceTextures ?? [])
    .flatMap(({ geometryIds }) => geometryIds)
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort();
  const controlledCylinderIds = output.controls
    .filter(({ characteristic }) => characteristic === 'circularity' || characteristic === 'cylindricity')
    .flatMap(({ geometryIds }) => geometryIds)
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort();
  if (JSON.stringify(textureGeometryIds) !== JSON.stringify(controlledCylinderIds)) {
    failures.push(`surface-texture attachment changed: ${JSON.stringify(textureGeometryIds)}`);
  }
  if (output.coverage?.complete !== true) failures.push('coverage is not complete');
  return failures;
}

function count(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] ?? 0) + 1;
    return result;
  }, {});
}
