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

function service(partitionValue: PartitionDraft | null = partition(), plans = new DimensionPlanStore(
  undefined, { now: () => 7, id: () => 'dimension:r1' },
)) {
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
    plans,
  );
}

describe('DimensionInferenceService', () => {
  it('defaults to the evidence-weighted hierarchical convention', () => {
    const workflow = service();
    const result = workflow.start(agent);
    expect(result.draft?.axialScheme).toMatchObject({
      policy: { id: 'shaft-hierarchical-dimensioning-v1' },
    });
  });

  it('starts only when invoked and binds the current partition draft', () => {
    const workflow = service();
    expect(workflow.getState(agent).phase).toBe('idle');

    const result = workflow.start(agent, 'shaft-hierarchical-dimensioning-v1');

    expect(result.phase).toBe('editing');
    expect(result.draft?.axialScheme).toMatchObject({ policy: { id: 'shaft-hierarchical-dimensioning-v1' } });
  });

  it('rejects a missing partition without fabricating topology', () => {
    expect(() => service(null).start(agent)).toThrow('DIMENSION_PARTITION_REQUIRED');
  });

  it('preserves existing datum and GD&T annotations when dimension inference is refreshed', () => {
    const plans = new DimensionPlanStore(undefined, { now: () => 7, id: () => 'dimension:r1' });
    const existing = {
      version: 1 as const, drawingRef: ref,
      datums: [{
        id: 'datum:A', drawingRef: ref, name: 'A', geometryId: 'geometry:shaft' as GeometryId,
        anchor: { kind: 'start' as const }, role: 'primary' as const, source: 'ai-candidate' as const,
        status: 'candidate' as const, evidenceIds: [],
      }],
      intents: [], tolerances: [],
      geometricTolerances: [{
        id: 'gdt:runout', drawingRef: ref, characteristic: 'circular-runout' as const,
        controlledTargets: [{ geometryId: 'geometry:shaft' as GeometryId, anchor: { kind: 'start' as const } }],
        toleranceZone: { shape: 'linear' as const }, datumReferenceFrame: [{ datumId: 'datum:A' }],
        computed: { status: 'pending' as const, unit: 'mm' as const, diagnostics: [] }, source: 'ai-candidate' as const,
        status: 'candidate' as const, evidenceIds: [],
      }],
      chains: [], dependencies: [], diagnostics: [{
        id: 'diagnostic:gdt:coverage', severity: 'info' as const,
        code: 'GDT_COVERAGE_COMPLETE', message: 'complete',
      }],
    };
    plans.begin(String(agent.id), ref);
    plans.setDraft(String(agent.id), existing);

    const result = service(partition(), plans).start(agent);

    expect(result.draft).toMatchObject({
      datums: existing.datums,
      geometricTolerances: existing.geometricTolerances,
      diagnostics: expect.arrayContaining(existing.diagnostics),
    });
  });
});
