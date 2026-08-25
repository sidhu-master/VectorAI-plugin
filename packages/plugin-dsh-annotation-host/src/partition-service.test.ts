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
});
