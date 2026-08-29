// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import { createEmptyDrawing, type GeometryId } from '@vectorai/drawing-core';
import type { PartitionDraft } from '@vectorai/engineering-annotation';
import { describe, expect, it } from 'vitest';
import { DimensionInferenceService } from './dimension-inference-service';
import { DimensionPlanStore } from './dimension-plan-store';

const ref = { drawingId: 'drawing:shaft', revision: 1 };
const agent = { id: 'session:shaft' } as Agent;

function partition(): PartitionDraft {
  const segment = (id: string, zStart: number, zEnd: number) => ({
    id, zStart, zEnd, profile: { minRadius: 5, maxRadius: 5, sampleCount: 2 },
    boundaryConfidence: 1, geometryNodeIds: ['geometry:shaft'], boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [],
  });
  return {
    version: 1, drawingRef: ref,
    axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 20, orientation: 'forward', geometryNodeIds: ['geometry:shaft'] },
    segments: [segment('segment:a', 0, 10), segment('segment:b', 10, 20)],
    semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
  };
}

function service(partitionValue: PartitionDraft | null = partition()) {
  const document = createEmptyDrawing({ idFactory: { next: () => 'drawing:shaft' }, now: () => 1 });
  document.geometry = [{
    id: 'geometry:shaft' as GeometryId, type: 'line', start: [0, 0], end: [20, 0], visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
  }];
  return new DimensionInferenceService(
    { getSnapshot: () => ({ version: 1, ref, document, capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: false } }) },
    { get: () => partitionValue === null
      ? { version: 1, phase: 'idle', drawingRef: ref, canUndo: false, canRedo: false, updatedAt: 0 }
      : { version: 1, phase: 'editing', drawingRef: ref, draft: partitionValue as never, canUndo: false, canRedo: false, updatedAt: 0 } },
    { getStagedEngineeringText: () => undefined },
    new DimensionPlanStore(undefined, { now: () => 7, id: () => 'dimension:r1' }),
  );
}

describe('DimensionInferenceService', () => {
  it('defaults to the reference terminal-closure convention', () => {
    const workflow = service();
    const result = workflow.start(agent);
    expect(result.draft?.axialScheme).toMatchObject({
      status: 'resolved',
      policy: { id: 'shaft-reference-terminal-closure-v1' },
    });
  });

  it('starts only when invoked and binds the current partition draft', () => {
    const workflow = service();
    expect(workflow.getState(agent).phase).toBe('idle');

    const result = workflow.start(agent, 'shaft-reference-terminal-closure-v1');

    expect(result.phase).toBe('editing');
    expect(result.draft?.axialScheme).toMatchObject({ status: 'resolved', policy: { id: 'shaft-reference-terminal-closure-v1' } });
  });

  it('rejects a missing partition without fabricating topology', () => {
    expect(() => service(null).start(agent)).toThrow('DIMENSION_PARTITION_REQUIRED');
  });
});
