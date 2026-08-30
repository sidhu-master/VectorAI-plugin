// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import { createEmptyDrawing, type GeometryId } from '@vectorai/drawing-core';
import type { PartitionDraft } from '@vectorai/engineering-annotation';
import { describe, expect, it, vi } from 'vitest';
import { DimensionPlanStore } from './dimension-plan-store';
import { GdtService } from './gdt-service';

describe('automatic GD&T service', () => {
  it('runs the bounded reviewer and grounds its semantic recommendation into the shared preview draft', async () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    document.geometry = [{
      id: 'edge:datum' as GeometryId, type: 'line', start: [0, 5], end: [20, 5], visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }, {
      id: 'edge:controlled' as GeometryId, type: 'line', start: [20, -5], end: [20, 5], visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }];
    const ref = { drawingId: 'drawing-1', revision: 1 };
    const reviewer = vi.fn(async () => ({
      datums: [{ name: 'A', geometryId: 'edge:datum', role: 'primary' as const }],
      controls: [{
        id: 'gdt:1', characteristic: 'perpendicularity' as const, geometryIds: ['edge:controlled'],
        datumNames: ['A'], toleranceZoneShape: 'linear' as const,
      }],
      coverage: { complete: true, requiredDatumCount: 1, requiredControlCount: 1 },
    }));
    const service = new GdtService({
      getSnapshot: () => ({
        version: 1, ref, document,
        capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
      }),
    }, new DimensionPlanStore(), reviewer);
    const partition = {
      version: 1, drawingRef: ref,
      axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 20, orientation: 'forward' },
      segments: [], semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
    } as unknown as PartitionDraft;

    const result = await service.startAutomatic({ id: 'session-1' } as Agent, partition);

    expect(reviewer).toHaveBeenCalledWith(expect.objectContaining({ partition }));
    expect(result.draft).toMatchObject({
      datums: [{ id: 'datum:A', geometryId: 'edge:datum', source: 'ai-candidate' }],
      geometricTolerances: [{ id: 'gdt:1', characteristic: 'perpendicularity', computed: { status: 'pending' } }],
      diagnostics: [{ code: 'GDT_COVERAGE_COMPLETE' }],
    });
  });
});
