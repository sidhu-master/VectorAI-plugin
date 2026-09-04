// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type DimensionAnnotation, type GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it, vi } from 'vitest';
import {
  createDeterministicAnnotationPipeline,
  createEngineeringAnnotationPlanner,
  DETERMINISTIC_ANNOTATION_PIPELINE_ID,
} from './deterministic-annotation-pipeline';
import { RecognitionPipelineRunner, type RecognitionModelPort } from './recognition-runtime';

describe('deterministic engineering annotation pipeline', () => {
  it('runs the authoritative annotation planner without a model stage', async () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing:pipeline' }, now: () => 1 });
    const quality = { status: 'confirmed' as const, evidenceRefs: [] };
    document.geometry = [
      { id: 'top' as GeometryId, type: 'line', start: [0, 10], end: [100, 10], visible: true, quality },
      { id: 'bottom' as GeometryId, type: 'line', start: [0, -10], end: [100, -10], visible: true, quality },
      { id: 'fillet' as GeometryId, type: 'arc', center: [20, 8], radius: 2, startAngle: 0, endAngle: 90, counterClockwise: true, visible: true, quality },
      { id: 'fillet-vertical' as GeometryId, type: 'line', start: [22, 8], end: [22, 0], visible: true, quality },
      { id: 'fillet-horizontal' as GeometryId, type: 'line', start: [20, 10], end: [10, 10], visible: true, quality },
    ];
    const review = vi.fn(async () => { throw new Error('MODEL_MUST_NOT_RUN'); });
    const runner = new RecognitionPipelineRunner({ review } as RecognitionModelPort);
    runner.register(createDeterministicAnnotationPipeline());

    const output = await createEngineeringAnnotationPlanner(runner)({
      document,
      ref: { drawingId: 'drawing:pipeline', revision: 1 },
      objective: '标注中心线和圆角',
      annotationKinds: ['centerline', 'radius'],
    });

    expect(runner.list()).toEqual([DETERMINISTIC_ANNOTATION_PIPELINE_ID]);
    expect(output.annotations.filter(({ type }) => type === 'centerline')).toHaveLength(1);
    expect(output.annotations.filter((item): item is DimensionAnnotation => (
      item.type === 'dimension' && item.dimensionKind === 'radius'
    )).map(({ displayText, computedValue, targets }) => ({
      displayText, computedValue, geometryIds: targets.map(({ geometryId }) => geometryId),
    }))).toEqual([{
      displayText: 'R2', computedValue: 2, geometryIds: ['fillet'],
    }]);
    expect(output.program?.operations).toHaveLength(1);
    expect(review).not.toHaveBeenCalled();

    const run = await runner.run(DETERMINISTIC_ANNOTATION_PIPELINE_ID, {
      document,
      ref: { drawingId: 'drawing:pipeline', revision: 1 },
      objective: '标注中心线和圆角',
      annotationKinds: ['centerline', 'radius'],
    });
    expect(run.trace).toEqual([expect.objectContaining({
      id: 'deterministic-annotation-plan',
      kind: 'deterministic',
      status: 'completed',
    })]);
    expect(run.normalized).toMatchObject({
      hasProgram: true,
      annotations: expect.arrayContaining([
        expect.objectContaining({ type: 'centerline' }),
        expect.objectContaining({ type: 'dimension', dimensionKind: 'radius', computedValue: 2 }),
      ]),
    });
  });
});
