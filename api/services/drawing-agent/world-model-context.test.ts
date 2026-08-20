import { describe, expect, it } from 'vitest';

import {
  createEmptyDrawing,
  type GeometryId,
  type RevisionId,
} from '../../../src/drawing';
import { buildModelWorldContext } from './world-model-context';

describe('buildModelWorldContext', () => {
  it('resolves a complete medium drawing instead of forcing an unnecessary continuation turn', () => {
    const document = createEmptyDrawing({ now: () => 1 });
    for (let index = 0; index < 58; index += 1) {
      document.geometry.push({
        id: `line_${index}` as GeometryId,
        type: 'line', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
        start: [index * 2, 0], end: [index * 2 + 1, 1],
      });
    }

    const context = buildModelWorldContext({
      document,
      revision: 'revision_medium' as RevisionId,
      localGeometryNodeIds: [],
      targetGeometryNodeIds: [],
      alias: (nodeId) => nodeId,
    });

    expect(context.worldModelSlice.knowledge.state).toBe('resolved');
    expect(context.worldModelSlice.primitiveRows).toHaveLength(58);
    expect(context.worldModelSlice.primitiveColumns).toEqual([
      'ref', 'type', 'parameters', 'quality', 'sourceSpanRefs',
    ]);
    expect(context.worldModelSlice.primitiveRows[0]).toEqual([
      'line_0', 'line', [0, 0, 1, 1], 'confirmed', [expect.any(String)],
    ]);
    expect(context.worldModelSlice.continuationToken).toBeUndefined();
  });

  it('keeps a bounded continuation contract for genuinely large drawings', () => {
    const document = createEmptyDrawing({ now: () => 1 });
    for (let index = 0; index < 240; index += 1) {
      document.geometry.push({
        id: `line_${index}` as GeometryId,
        type: 'line', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
        start: [index * 2, 0], end: [index * 2 + 1, 1],
      });
    }

    const context = buildModelWorldContext({
      document,
      revision: 'revision_large' as RevisionId,
      localGeometryNodeIds: [],
      targetGeometryNodeIds: [],
      alias: (nodeId) => nodeId,
    });

    expect(context.worldModelSlice.knowledge.state).toBe('partial');
    expect(context.worldModelSlice.primitiveRows.length).toBeLessThan(240);
    expect(context.worldModelSlice.continuationToken).toMatch(/^world:/);
  });

  it('projects exact compact parameters for every supported geometry primitive', () => {
    const document = createEmptyDrawing({ now: () => 1 });
    document.geometry.push(
      {
        id: 'circle_1' as GeometryId, type: 'circle', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] }, center: [4, 5], radius: 6,
      },
      {
        id: 'arc_1' as GeometryId, type: 'arc', visible: true,
        quality: { status: 'candidate', confidence: 0.8, evidenceRefs: [] },
        center: [1, 2], radius: 3, startAngle: 0, endAngle: 1.5, counterClockwise: true,
      },
      {
        id: 'poly_1' as GeometryId, type: 'polyline', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] }, closed: false,
        vertices: [{ point: [0, 0] }, { point: [2, 3], bulge: 0.2 }],
      },
    );

    const context = buildModelWorldContext({
      document, revision: 'revision_primitives' as RevisionId,
      localGeometryNodeIds: [], targetGeometryNodeIds: [], alias: (nodeId) => nodeId,
    });

    expect(context.worldModelSlice.primitiveRows).toEqual(expect.arrayContaining([
      ['circle_1', 'circle', [4, 5, 6], 'confirmed', expect.any(Array)],
      ['arc_1', 'arc', [1, 2, 3, 0, 1.5, true], 'candidate', expect.any(Array)],
      ['poly_1', 'polyline', [false, [[0, 0, 0], [2, 3, 0.2]]], 'confirmed', expect.any(Array)],
    ]));
  });

  it('precomputes endpoint-to-curve contact anchors instead of making the model solve them', () => {
    const document = createEmptyDrawing({ now: () => 1 });
    document.geometry.push(
      {
        id: 'hand' as GeometryId, type: 'circle', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] }, center: [0, 0], radius: 20,
      },
      {
        id: 'arm' as GeometryId, type: 'line', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] }, start: [0, 20.1], end: [30, 50],
      },
    );

    const context = buildModelWorldContext({
      document, revision: 'revision_contact' as RevisionId,
      localGeometryNodeIds: [], targetGeometryNodeIds: [], alias: (nodeId) => nodeId,
    });

    expect(context.worldModelSlice.contactRows).toContainEqual([
      'arm', 'start', 'hand', 'curve', expect.arrayContaining([0, 20]),
      expect.closeTo(0.1, 5),
    ]);
  });

  it('keeps the test drawing hand-to-arm contact explicit in the model projection', () => {
    const document = createEmptyDrawing({ now: () => 1 });
    document.geometry.push(
      {
        id: 'hand' as GeometryId, type: 'circle', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
        center: [61.710477, 204.929327], radius: 41.487229,
      },
      {
        id: 'arm' as GeometryId, type: 'line', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
        start: [64.694509, 247.32261], end: [124.143616, 289.214202],
      },
      {
        id: 'drawing_extent' as GeometryId, type: 'point', visible: false,
        quality: { status: 'confirmed', evidenceRefs: [] }, x: 500, y: 650,
      },
    );

    const context = buildModelWorldContext({
      document, revision: 'revision_test2_contact' as RevisionId,
      localGeometryNodeIds: [], targetGeometryNodeIds: [], alias: (nodeId) => nodeId,
    });

    expect(context.worldModelSlice.contactRows).toContainEqual([
      'arm', 'start', 'hand', 'curve', expect.any(Array), expect.any(Number),
    ]);
    const contact = context.worldModelSlice.contactRows.find((row) => row[0] === 'arm');
    expect(contact?.[4]).not.toEqual([61.710477, 204.929327]);
    expect(contact?.[5]).toBeLessThan(1.2);
  });
});
