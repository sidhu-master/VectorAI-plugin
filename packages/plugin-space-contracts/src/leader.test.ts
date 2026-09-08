// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type LeaderAnnotation } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';
import { drawingDocumentSchema, drawingWorkspaceCommitRequestSchema } from './index';

const leader: LeaderAnnotation = {
  id: 'leader-1' as never, type: 'leader', visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
  target: { geometryId: 'edge-1' as never, anchor: { kind: 'start' } },
  points: [[0, 0], [10, 0]], content: 'R1', textHeight: 3.5,
  branches: [{ target: { geometryId: 'edge-2' as never, anchor: { kind: 'end' } }, points: [[0, 8], [10, 0]] }],
  callout: { type: 'detail', radius: 4 },
  arrowhead: 'closed-filled',
};

describe('leader wire contract', () => {
  it('accepts creation and restores all branch targets and detail metadata from JSON', () => {
    const request = { expectedRevision: 1, commands: [{ type: 'node.create', plane: 'annotation', node: leader }] };
    expect(drawingWorkspaceCommitRequestSchema.parse(JSON.parse(JSON.stringify(request)))).toEqual(request);
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing' }, now: () => 1 });
    document.annotations = [leader];
    expect(drawingDocumentSchema.parse(JSON.parse(JSON.stringify(document))).annotations).toEqual([leader]);
  });

  it('rejects invalid circle radii and incomplete branches while accepting legacy leaders', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing' }, now: () => 1 });
    const parse = (node: unknown) => drawingDocumentSchema.safeParse({ ...document, annotations: [node] }).success;
    const { branches, callout, ...legacy } = leader;
    expect(parse(legacy)).toBe(true);
    expect(parse({ ...leader, callout: { type: 'detail', radius: -4 } })).toBe(false);
    expect(parse({ ...leader, branches: [{ target: leader.target, points: [[0, 0]] }] })).toBe(false);
    expect(parse({ ...leader, branches: [{ points: [[0, 0], [1, 1]] }] })).toBe(false);
  });
});
