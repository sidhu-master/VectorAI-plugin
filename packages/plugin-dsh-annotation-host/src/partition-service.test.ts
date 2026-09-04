// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import { createEmptyDrawing, type GeometryId } from '@vectorai/drawing-core';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { AnnotationSessionStateStore } from './session-state';
import { PartitionSessionStore } from './partition-store';
import { PartitionWorkflowService } from './partition-service';

function drawing() {
  const document = createEmptyDrawing({ idFactory: { next: () => 'd' }, now: () => 1 });
  const lines: Array<[[number, number], [number, number]]> = [[[0, 5], [10, 5]], [[0, -5], [10, -5]], [[0, -5], [0, 5]], [[10, -5], [10, 5]]];
  document.geometry = lines.map(([start, end], index) => ({ id: `l${index}` as GeometryId, type: 'line', start, end, visible: true, quality: { status: 'confirmed', evidenceRefs: [] } }));
  return document;
}

describe('PartitionWorkflowService', () => {
  it('imports a DXF for viewing without claiming or starting partition analysis', async () => {
    const document = drawing();
    document.sources = [{ id: 'source:dxf', kind: 'dxf', mediaType: 'application/dxf', digest: `sha256:${'a'.repeat(64)}`, name: 'shaft.dxf' }];
    const bytes = new TextEncoder().encode('DXF bytes');
    const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    const annotations = new AnnotationSessionStateStore(undefined, { now: () => 4 });
    annotations.start('s', 'old-partition');
    const partitions = new PartitionSessionStore();
    const service = new PartitionWorkflowService({
      importDxf: vi.fn(async () => ({ status: 'imported' as const, ref: { drawingId: 'd', revision: 1 }, provisional: false })),
      getSnapshot: () => ({ version: 1 as const, ref: { drawingId: 'd', revision: 1 }, document, capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: false } }),
    } as never, partitions, annotations);

    const result = await service.importDrawing({ id: 's' } as Agent, {
      name: 'shaft.dxf', digest, base64: Buffer.from(bytes).toString('base64'),
    });

    expect(result).toMatchObject({ phase: 'idle', drawingRef: { drawingId: 'd', revision: 1 } });
    expect(annotations.get('s').workspaceClaimed).toBe(false);
  });

  it('stages extracted documents without claiming the workspace and consumes them only on explicit analysis', async () => {
    const document = drawing();
    document.sources = [{ id: 'source:dxf', kind: 'dxf', mediaType: 'application/dxf', digest: `sha256:${'a'.repeat(64)}`, name: 'shaft.dxf' }];
    const bytes = new TextEncoder().encode('document');
    const extract = vi.fn(async () => ({
      documents: [{ name: 'notes.txt', format: 'txt', text: '[region:bearing:B01]\nname=轴承位\ncenter_z=5\nwidth=4', warnings: [] }],
      combinedText: '[region:bearing:B01]\nname=轴承位\ncenter_z=5\nwidth=4',
    }));
    const annotations = new AnnotationSessionStateStore();
    const service = new PartitionWorkflowService({
      importDxf: vi.fn(),
      getSnapshot: () => ({ version: 1 as const, ref: { drawingId: 'd', revision: 1 }, document, capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: false } }),
    } as never, new PartitionSessionStore(), annotations, undefined, extract);

    const staged = await service.stageDocuments({ id: 's' } as Agent, [{
      name: 'notes.txt', digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`, base64: Buffer.from(bytes).toString('base64'),
    }]);
    expect(staged.phase).toBe('idle');
    expect(annotations.get('s').workspaceClaimed).toBe(false);
    expect(service.getStagedEngineeringText({ id: 's' } as Agent)).toContain('name=轴承位');
    expect(service.getStagedEngineeringText({ id: 'other-session' } as Agent)).toBeUndefined();

    const result = await service.analyzeCurrent({ id: 's' } as Agent);
    expect(result.phase).toBe('editing');
    expect(result.draft?.evidence.some(({ origin }) => origin === 'document')).toBe(true);
  });

  it('enforces cumulative document limits and duplicate names across staging calls', async () => {
    const extract = vi.fn(async (inputs: Array<{ name: string }>) => ({
      documents: inputs.map(({ name }) => ({ name, format: 'txt', text: 'x', warnings: [] })),
      combinedText: 'x',
    }));
    const service = new PartitionWorkflowService({ getSnapshot: () => null } as never, new PartitionSessionStore(), new AnnotationSessionStateStore(), undefined, extract as never);
    const input = (name: string) => ({ name, digest: `sha256:${'a'.repeat(64)}`, base64: 'eA==' });
    await service.stageDocuments({ id: 's' } as Agent, Array.from({ length: 16 }, (_, index) => input(`part-${index}.txt`)));

    await expect(service.stageDocuments({ id: 's' } as Agent, [input('part-16.txt')]))
      .rejects.toThrow('ENGINEERING_DOCUMENT_COUNT_LIMIT');
    await expect(service.stageDocuments({ id: 's' } as Agent, [input('part-0.txt')]))
      .rejects.toThrow('ENGINEERING_DOCUMENT_DUPLICATE_NAME');
    await expect(service.stageDocuments({ id: 'same-call' } as Agent, [input('notes.txt'), input('NOTES.TXT')]))
      .rejects.toThrow('ENGINEERING_DOCUMENT_DUPLICATE_NAME');
  });

  it('clears context bound to an older drawing when a replacement DXF is opened', async () => {
    const document = drawing();
    document.sources = [{ id: 'source:dxf', kind: 'dxf', mediaType: 'application/dxf', digest: `sha256:${'a'.repeat(64)}`, name: 'shaft.dxf' }];
    let ref = { drawingId: 'a', revision: 1 };
    const bytes = new TextEncoder().encode('DXF bytes');
    const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    const extract = vi.fn(async () => ({ documents: [{ name: 'notes.txt', format: 'txt', text: '[region:bearing:B01]\nname=旧轴承位\ncenter_z=5\nwidth=4', warnings: [] }], combinedText: '[region:bearing:B01]\nname=旧轴承位\ncenter_z=5\nwidth=4' }));
    const service = new PartitionWorkflowService({
      importDxf: vi.fn(async () => { ref = { drawingId: 'b', revision: 1 }; return { status: 'imported', ref, provisional: false }; }),
      getSnapshot: () => ({ version: 1 as const, ref, document, capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: false } }),
    } as never, new PartitionSessionStore(), new AnnotationSessionStateStore(), undefined, extract);
    await service.stageDocuments({ id: 's' } as Agent, [{ name: 'notes.txt', digest: `sha256:${'a'.repeat(64)}`, base64: 'eA==' }]);

    await service.importDrawing({ id: 's' } as Agent, { name: 'replacement.dxf', digest, base64: Buffer.from(bytes).toString('base64') });
    const result = await service.analyzeCurrent({ id: 's' } as Agent);

    expect(result.draft?.semanticGroups.some(({ name }) => name === '旧轴承位')).toBe(false);
  });

  it('keeps staged document context across revisions of the same drawing', async () => {
    const document = drawing();
    document.sources = [{ id: 'source:dxf', kind: 'dxf', mediaType: 'application/dxf', digest: `sha256:${'a'.repeat(64)}`, name: 'shaft.dxf' }];
    let ref = { drawingId: 'same-drawing', revision: 1 };
    const extract = vi.fn(async () => ({
      documents: [{ name: 'notes.txt', format: 'txt', text: '[region:bearing:B01]\nname=跨版本轴承位\ncenter_z=5\nwidth=4', warnings: [] }],
      combinedText: '[region:bearing:B01]\nname=跨版本轴承位\ncenter_z=5\nwidth=4',
    }));
    const service = new PartitionWorkflowService({
      getSnapshot: () => ({ version: 1 as const, ref, document, capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: false } }),
    } as never, new PartitionSessionStore(), new AnnotationSessionStateStore(), undefined, extract);
    await service.stageDocuments({ id: 's' } as Agent, [{ name: 'notes.txt', digest: `sha256:${'a'.repeat(64)}`, base64: 'eA==' }]);
    ref = { drawingId: 'same-drawing', revision: 2 };

    const result = await service.analyzeCurrent({ id: 's' } as Agent);

    expect(result.draft?.evidence.some(({ origin }) => origin === 'document')).toBe(true);
  });

  it('runs only through explicit DXF import and invokes bounded review for uncovered IDs', async () => {
    const bytes = new TextEncoder().encode('DXF bytes');
    const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    const importDxf = vi.fn(async () => ({ status: 'imported' as const, ref: { drawingId: 'd', revision: 1 }, provisional: false }));
    const reviewer = vi.fn(async ({ draft }: { draft: unknown }) => ({ draft }));
    const space = {
      importDxf,
      getSnapshot: () => ({ version: 1 as const, ref: { drawingId: 'd', revision: 1 }, document: drawing(), capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: false } }),
    };
    const annotations = new AnnotationSessionStateStore(undefined, { now: () => 4 });
    const service = new PartitionWorkflowService(space as never, new PartitionSessionStore(), annotations, reviewer as never);
    const result = await service.importAndAnalyze({ id: 'session-1' } as Agent, { dxf: { name: 'shaft.dxf', digest, base64: Buffer.from(bytes).toString('base64') } });
    expect(importDxf).toHaveBeenCalledOnce();
    expect(reviewer).toHaveBeenCalledWith(expect.objectContaining({ segmentIds: expect.any(Array) }));
    expect(result.phase).toBe('editing');
    expect(annotations.get('session-1').workspaceClaimed).toBe(true);
  });

  it('rejects tampered bytes before touching the first layer', async () => {
    const importDxf = vi.fn();
    const service = new PartitionWorkflowService({ importDxf } as never, new PartitionSessionStore(), new AnnotationSessionStateStore());
    await expect(service.importAndAnalyze({ id: 's' } as Agent, { dxf: { name: 'x.dxf', digest: 'sha256:wrong', base64: Buffer.from('x').toString('base64') } })).rejects.toThrow('DXF_DIGEST_MISMATCH');
    expect(importDxf).not.toHaveBeenCalled();
  });

  it('extracts all document evidence before mutating the first-layer drawing', async () => {
    const order: string[] = [];
    const bytes = new TextEncoder().encode('DXF bytes');
    const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    const documentBytes = new TextEncoder().encode('document');
    const extract = vi.fn(async () => {
      order.push('extract');
      return { documents: [], combinedText: '第一轴段 0~10' };
    });
    const space = {
      importDxf: vi.fn(async () => { order.push('import'); return { status: 'imported' }; }),
      getSnapshot: () => ({ version: 1 as const, ref: { drawingId: 'd', revision: 1 }, document: drawing(), capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: false } }),
    };
    const service = new PartitionWorkflowService(
      space as never,
      new PartitionSessionStore(),
      new AnnotationSessionStateStore(),
      undefined,
      extract,
    );

    await service.importAndAnalyze({ id: 's' } as Agent, {
      dxf: { name: 'shaft.dxf', digest, base64: Buffer.from(bytes).toString('base64') },
      engineeringDocuments: [{
        name: 'notes.txt',
        digest: `sha256:${createHash('sha256').update(documentBytes).digest('hex')}`,
        base64: Buffer.from(documentBytes).toString('base64'),
      }],
    });

    expect(order).toEqual(['extract', 'import']);
    expect(extract).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ signal: undefined }));
  });

  it('does not import the DXF when document admission fails', async () => {
    const bytes = new TextEncoder().encode('DXF bytes');
    const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    const importDxf = vi.fn();
    const service = new PartitionWorkflowService(
      { importDxf } as never,
      new PartitionSessionStore(),
      new AnnotationSessionStateStore(),
      undefined,
      vi.fn(async () => { throw new Error('DOCUMENT_PARSE_FAILED:broken.pdf'); }),
    );

    await expect(service.importAndAnalyze({ id: 's' } as Agent, {
      dxf: { name: 'shaft.dxf', digest, base64: Buffer.from(bytes).toString('base64') },
      engineeringDocuments: [],
    })).rejects.toThrow('DOCUMENT_PARSE_FAILED:broken.pdf');
    expect(importDxf).not.toHaveBeenCalled();
  });

  it('reanalyzes the current drawing when engineering documents arrive after the DXF', async () => {
    const document = drawing();
    document.sources = [{
      id: 'source:dxf', kind: 'dxf', mediaType: 'application/dxf',
      digest: `sha256:${'a'.repeat(64)}`, name: 'shaft.dxf',
    }];
    const importDxf = vi.fn();
    const extract = vi.fn(async () => ({ documents: [], combinedText: '第一轴段 0~10' }));
    const space = {
      importDxf,
      getSnapshot: () => ({
        version: 1 as const,
        ref: { drawingId: 'd', revision: 1 },
        document,
        capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: false },
      }),
    };
    const service = new PartitionWorkflowService(
      space as never,
      new PartitionSessionStore(),
      new AnnotationSessionStateStore(),
      undefined,
      extract,
    );
    const bytes = new TextEncoder().encode('document');

    const result = await service.supplementDocuments({ id: 's' } as Agent, {
      expectedDrawingRef: { drawingId: 'd', revision: 1 },
      engineeringDocuments: [{
        name: 'notes.txt',
        digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
        base64: Buffer.from(bytes).toString('base64'),
      }],
    });

    expect(result.phase).toBe('editing');
    expect(importDxf).not.toHaveBeenCalled();
    expect(extract).toHaveBeenCalledOnce();
  });

  it('analyzes the active drawing from concise context only after an explicit start', async () => {
    const document = drawing();
    document.sources = [{
      id: 'source:dxf', kind: 'dxf', mediaType: 'application/dxf',
      digest: `sha256:${'a'.repeat(64)}`, name: 'shaft.dxf',
    }];
    const reviewer = vi.fn(async ({ draft }: { draft: unknown }) => ({ draft }));
    const annotations = new AnnotationSessionStateStore(undefined, { now: () => 7 });
    const service = new PartitionWorkflowService({
      importDxf: vi.fn(),
      getSnapshot: () => ({
        version: 1 as const,
        ref: { drawingId: 'd', revision: 1 },
        document,
        capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: false },
      }),
    } as never, new PartitionSessionStore(), annotations, reviewer as never);

    expect(service.getState({ id: 's' } as Agent).phase).toBe('idle');
    const result = await service.analyzeCurrent(
      { id: 's' } as Agent,
      '[region:spline:S01]\nname=外花键\ncenter_z=5\nwidth=4',
    );

    expect(result.phase).toBe('editing');
    expect(result.draft?.evidence.some(({ origin }) => origin === 'document')).toBe(true);
    expect(annotations.get('s').workspaceClaimed).toBe(true);
  });

  it('rejects explicit partitioning when the active drawing is not a DXF', async () => {
    const document = drawing();
    document.sources = [{ id: 'source:image', kind: 'image', mediaType: 'image/png', digest: `sha256:${'a'.repeat(64)}`, name: 'photo.png' }];
    const annotations = new AnnotationSessionStateStore();
    const service = new PartitionWorkflowService({
      importDxf: vi.fn(),
      getSnapshot: () => ({ version: 1 as const, ref: { drawingId: 'd', revision: 1 }, document, capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true } }),
    } as never, new PartitionSessionStore(), annotations);

    await expect(service.analyzeCurrent({ id: 's' } as Agent)).rejects.toThrow('DXF_DRAWING_REQUIRED');
    expect(annotations.get('s').workspaceClaimed).toBe(false);
  });

  it('does not commit a partition draft after external cancellation', async () => {
    const document = drawing();
    document.sources = [{ id: 'source:dxf', kind: 'dxf', mediaType: 'application/dxf', digest: `sha256:${'a'.repeat(64)}`, name: 'shaft.dxf' }];
    const controller = new AbortController();
    const reviewer = vi.fn(async () => {
      controller.abort(new Error('USER_CANCELED'));
      throw controller.signal.reason;
    });
    const annotations = new AnnotationSessionStateStore();
    const partitions = new PartitionSessionStore();
    const service = new PartitionWorkflowService({
      importDxf: vi.fn(),
      getSnapshot: () => ({ version: 1 as const, ref: { drawingId: 'd', revision: 1 }, document, capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: false } }),
    } as never, partitions, annotations, reviewer as never);

    await expect(service.analyzeCurrent({ id: 's' } as Agent, undefined, controller.signal)).rejects.toThrow('USER_CANCELED');
    expect(partitions.get('s').phase).toBe('idle');
    expect(partitions.get('s').draft).toBeUndefined();
    expect(annotations.get('s').workspaceClaimed).toBe(false);
  });

  it('rolls back partition state when a generated draft cannot be persisted', async () => {
    const document = drawing();
    document.sources = [{ id: 'source:dxf', kind: 'dxf', mediaType: 'application/dxf', digest: `sha256:${'a'.repeat(64)}`, name: 'shaft.dxf' }];
    const annotations = new AnnotationSessionStateStore();
    const partitions = new PartitionSessionStore();
    const reviewer = vi.fn(async ({ draft }: { draft: object }) => ({
      draft: { ...draft, unsupportedWireField: true },
    }));
    const service = new PartitionWorkflowService({
      importDxf: vi.fn(),
      getSnapshot: () => ({ version: 1 as const, ref: { drawingId: 'd', revision: 1 }, document, capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: false } }),
    } as never, partitions, annotations, reviewer as never);

    await expect(service.analyzeCurrent({ id: 's' } as Agent)).rejects.toThrow();

    expect(partitions.get('s').phase).toBe('idle');
    expect(partitions.get('s').draft).toBeUndefined();
    expect(annotations.get('s').workflow.status).toBe('failed');
  });
});
