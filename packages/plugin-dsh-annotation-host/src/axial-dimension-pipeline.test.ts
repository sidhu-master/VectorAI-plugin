// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type GeometryId } from '@vectorai/drawing-core';
import type { PartitionDraft } from '@vectorai/engineering-annotation';
import type { DrawingWorkspaceSnapshot } from '@vectorai/plugin-space-contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  AXIAL_DIMENSION_PIPELINE_ID,
  createAxialDimensionInference,
  createAxialDimensionPipeline,
} from './axial-dimension-pipeline';
import { partitionGeometryFingerprint } from './partition-geometry-fingerprint';
import { RecognitionPipelineRunner, type RecognitionModelPort } from './recognition-runtime';

describe('axial dimension inference pipeline', () => {
  it('owns validation, document normalization, topology, candidates, inference and projection', async () => {
    const drawing = drawingFixture();
    const partition = partitionFixture(drawing);
    const review = vi.fn(async () => { throw new Error('MODEL_MUST_NOT_RUN'); });
    const runner = new RecognitionPipelineRunner({ review } as RecognitionModelPort);
    runner.register(createAxialDimensionPipeline());
    const input = {
      drawing,
      partition,
      engineeringText: `[drawing]\nunit=cm\n[region:bearing:B02]\nname=centimetre source bearing\ncenter_z=1.75\nwidth=1.5`,
      policyId: 'shaft-hierarchical-dimensioning-v1' as const,
    };

    const projection = await createAxialDimensionInference(runner)(input);

    expect(projection.axialScheme).toMatchObject({
      policy: { id: 'shaft-hierarchical-dimensioning-v1', version: '1' },
    });
    expect(projection.axialScheme?.candidates).toContainEqual(expect.objectContaining({
      nominalValue: 15,
      required: true,
      evidenceIds: expect.arrayContaining(['document:region:B02']),
    }));
    expect(projection.intents).toContainEqual(expect.objectContaining({ nominalValue: 15, unit: 'mm' }));
    expect(review).not.toHaveBeenCalled();

    const run = await runner.run(AXIAL_DIMENSION_PIPELINE_ID, input);
    expect(run.trace.map(({ id }) => id)).toEqual([
      'dimension-partition-validation',
      'dimension-document-normalization',
      'dimension-topology',
      'dimension-candidates',
      'dimension-inference',
      'dimension-projection',
    ]);
    expect(run.modelObservations).toEqual([]);
  });
});

function drawingFixture(): DrawingWorkspaceSnapshot {
  const document = createEmptyDrawing({ idFactory: { next: () => 'drawing:shaft' }, now: () => 1 });
  document.geometry = [{
    id: 'geometry:shaft' as GeometryId,
    type: 'line',
    start: [0, 0],
    end: [25, 0],
    visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
  }];
  return {
    version: 1,
    ref: { drawingId: 'drawing:shaft', revision: 1 },
    document,
    capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: false },
  };
}

function partitionFixture(drawing: DrawingWorkspaceSnapshot): PartitionDraft {
  const segment = (id: string, zStart: number, zEnd: number) => ({
    id,
    zStart,
    zEnd,
    profile: { minRadius: 5, maxRadius: 5, sampleCount: 2 },
    boundaryConfidence: 1,
    geometryNodeIds: ['geometry:shaft'],
    boundaryEvidenceIds: [],
    semanticEvidenceIds: [],
    diagnosticIds: [],
  });
  return {
    version: 1,
    drawingRef: drawing.ref,
    geometryFingerprint: partitionGeometryFingerprint(drawing.document),
    axis: {
      origin: [0, 0], direction: [1, 0], normal: [0, 1],
      zMin: 0, zMax: 25, orientation: 'forward', geometryNodeIds: ['geometry:shaft'],
    },
    segments: [segment('segment:a', 0, 10), segment('segment:b', 10, 25)],
    semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
  };
}
