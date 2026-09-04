// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DimensionAnnotation } from '@vectorai/drawing-core';
import { importDxf } from '../../dxf-import/src/index';
import { describe, expect, it, vi } from 'vitest';
import { createAnnotationRecognitionRunner } from './annotation-recognition-runtime';
import {
  DETERMINISTIC_ANNOTATION_PIPELINE_ID,
  type DeterministicAnnotationPipelineInput,
} from './deterministic-annotation-pipeline';
import { recognitionDigest, type RecognitionModelPort } from './recognition-runtime';
import type { EngineeringAnnotationPlan } from '@vectorai/engineering-annotation';

const fixtureDirectory = resolve(import.meta.dirname, '../../engineering-annotation/test/fixtures/golden-shaft-001');

describe('deterministic annotation recognition contract', () => {
  it('evaluates the production golden-shaft planner without a model request', async () => {
    const imported = importDxf({
      bytes: readFileSync(resolve(fixtureDirectory, 'initial.dxf')),
      source: { name: 'initial.dxf', digest: 'sha256:57f79b850e95e852e6ea427711e2534effeecf0f90257340504efcc3f498c1b2' },
      drawingId: 'contract:deterministic-annotations',
      now: () => 1,
    });
    if (imported.status !== 'imported') throw new Error('CONTRACT_FIXTURE_IMPORT_FAILED');
    const review = vi.fn(async () => { throw new Error('MODEL_MUST_NOT_RUN'); });
    const runner = createAnnotationRecognitionRunner({ review } as RecognitionModelPort, {} as never);
    const input: DeterministicAnnotationPipelineInput = {
      document: imported.document,
      ref: { drawingId: 'contract:deterministic-annotations', revision: 1 },
      objective: '工程图纸自动标注集',
      annotationKinds: ['opening-angle', 'diameter', 'centerline', 'radius'],
    };

    const report = await runner.evaluate<DeterministicAnnotationPipelineInput, EngineeringAnnotationPlan>({
      id: 'golden-shaft-deterministic-annotations-v1',
      pipelineId: DETERMINISTIC_ANNOTATION_PIPELINE_ID,
      input,
      attempts: 3,
      fixtureDigest: recognitionDigest({
        fixture: 'golden-shaft-001',
        sourceDigest: 'sha256:57f79b850e95e852e6ea427711e2534effeecf0f90257340504efcc3f498c1b2',
      }),
      assert: (output) => {
        const dimensions = output.annotations.filter((item): item is DimensionAnnotation => item.type === 'dimension');
        const angularValues = dimensions.filter(({ dimensionKind }) => dimensionKind === 'angular')
          .map(({ computedValue }) => computedValue ?? 0).sort((left, right) => left - right);
        const diameterValues = dimensions.filter(({ dimensionKind }) => dimensionKind === 'diameter')
          .map(({ computedValue }) => Number((computedValue ?? 0).toFixed(2))).sort((left, right) => left - right);
        const failures: string[] = [];
        if (JSON.stringify(angularValues) !== JSON.stringify([60, 60, 120, 120])) failures.push('opening-angle contract changed');
        if (JSON.stringify(diameterValues) !== JSON.stringify([20, 35, 35, 38, 40, 42.21, 44.59, 48, 51])) failures.push('diameter contract changed');
        if (output.annotations.filter(({ type }) => type === 'centerline').length !== 1) failures.push('centerline contract changed');
        if (dimensions.some(({ targets, definitionPoints }) => targets.length === 0 || definitionPoints.length < 2)) {
          failures.push('dimension grounding incomplete');
        }
        return failures;
      },
    });

    expect(report.passed).toBe(true);
    expect(report.attempts).toHaveLength(3);
    expect(report.attempts.every(({ modelObservations }) => modelObservations.length === 0)).toBe(true);
    expect(review).not.toHaveBeenCalled();
  });
});
