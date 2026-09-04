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

  it('persists clarification questions instead of presenting low-confidence coverage as complete', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-2' }, now: () => 1 });
    document.geometry = [{
      id: 'edge:form' as GeometryId, type: 'line', start: [0, 4], end: [12, 4], visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }];
    const ref = { drawingId: 'drawing-2', revision: 1 };
    const service = new GdtService({
      getSnapshot: () => ({
        version: 1, ref, document,
        capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
      }),
    }, new DimensionPlanStore());

    const result = service.start({ id: 'session-2' } as Agent, {
      datums: [],
      controls: [{
        id: 'gdt:form', characteristic: 'cylindricity', geometryIds: ['edge:form'],
        datumNames: [], toleranceZoneShape: 'linear',
      }],
      coverage: {
        complete: false, requiredDatumCount: 0, requiredControlCount: 1,
        status: 'needs-user-input',
        questions: [{
          code: 'GDT_AXIS_SUPPORT_PAIR_REQUIRED',
          prompt: '请确认哪两个轴段共同建立旋转基准轴线。',
          segmentIds: ['segment:axis-support'],
        }],
      },
    });

    expect(result.draft?.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'GDT_USER_INPUT_REQUIRED' }),
      expect.objectContaining({
        code: 'GDT_AXIS_SUPPORT_PAIR_REQUIRED',
        message: '请确认哪两个轴段共同建立旋转基准轴线。',
        segmentIds: ['segment:axis-support'],
      }),
    ]));
  });

  it('preserves existing annotations when automatic review needs user input', async () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-3' }, now: () => 1 });
    document.geometry = [{
      id: 'edge:existing' as GeometryId, type: 'line', start: [0, 4], end: [12, 4], visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }];
    const ref = { drawingId: 'drawing-3', revision: 1 };
    const store = new DimensionPlanStore();
    const reviewer = vi.fn(async () => ({
      datums: [], controls: [], surfaceTextures: [],
      coverage: {
        complete: false, requiredDatumCount: 0, requiredControlCount: 0,
        status: 'needs-user-input' as const,
        questions: [{
          code: 'GDT_ENGINEERING_REQUIREMENTS_REQUIRED' as const,
          prompt: '请确认工程要求。', segmentIds: [],
        }],
      },
    }));
    const service = new GdtService({
      getSnapshot: () => ({
        version: 1, ref, document,
        capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
      }),
    }, store, reviewer);
    const agent = { id: 'session-3' } as Agent;
    service.start(agent, {
      datums: [],
      controls: [{
        id: 'gdt:existing', characteristic: 'circularity', geometryIds: ['edge:existing'],
        datumNames: [], toleranceZoneShape: 'linear',
      }],
    });
    const partition = {
      version: 1, drawingRef: ref,
      axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 20, orientation: 'forward' },
      segments: [], semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
    } as unknown as PartitionDraft;

    const result = await service.startAutomatic(agent, partition);

    expect(result.draft?.geometricTolerances.map(({ id }) => id)).toContain('gdt:existing');
    expect(result.draft?.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'GDT_ENGINEERING_REQUIREMENTS_REQUIRED' }),
    ]));
  });
});
