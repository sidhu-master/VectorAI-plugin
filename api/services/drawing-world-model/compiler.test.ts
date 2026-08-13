import { describe, expect, it } from 'vitest';

import {
  createEmptyDrawing,
  type DrawingDocument,
  type GeometryId,
  type RelationId,
  type RevisionId,
} from '../../../src/drawing/index.js';
import { WorldModelCompiler } from './compiler.js';

describe('WorldModelCompiler', () => {
  it('compiles a requested line into revision-bound source spans and directed half-edges', () => {
    const document = drawing();
    document.geometry.push(line('line_a', [0, 0], [10, 0]));
    const revision = 'revision_a' as RevisionId;

    const slice = new WorldModelCompiler().compile(document, revision, {
      nodeIds: ['line_a'],
    });

    expect(slice).toMatchObject({
      drawingId: document.id,
      revision,
      knowledge: { state: 'resolved', unresolvedBoundaryRefs: [] },
    });
    expect(slice.sourceSpans).toEqual([
      expect.objectContaining({
        sourceNodeId: 'line_a',
        parameterRange: [0, 1],
        derivation: 'analytic',
      }),
    ]);
    expect(slice.halfEdges).toHaveLength(2);
    expect(slice.halfEdges[0]).toMatchObject({
      twinId: slice.halfEdges[1].id,
      sourceSpanId: slice.sourceSpans[0].id,
    });
    expect(slice.halfEdges[1].twinId).toBe(slice.halfEdges[0].id);
  });

  it('preserves polyline parameter ranges without materializing splits into Drawing IR', () => {
    const document = drawing();
    document.geometry.push({
      id: 'polyline_a' as GeometryId,
      type: 'polyline',
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      vertices: [
        { point: [0, 0] },
        { point: [10, 0] },
        { point: [10, 10] },
      ],
      closed: false,
    });

    const slice = new WorldModelCompiler().compile(
      document,
      'revision_polyline' as RevisionId,
      { nodeIds: ['polyline_a'] },
    );

    expect(slice.sourceSpans.map((span) => span.parameterRange)).toEqual([
      [0, 0.5],
      [0.5, 1],
    ]);
    expect(slice.sourceSpans.every((span) => span.derivation === 'polyline-exact')).toBe(true);
    expect(document.geometry).toHaveLength(1);
    expect(document.geometry[0].type).toBe('polyline');
  });

  it('marks bounded truncation as partial and never presents omitted geometry as empty', () => {
    const document = drawing();
    document.geometry.push(
      line('line_a', [0, 0], [10, 0]),
      line('line_b', [20, 0], [30, 0]),
    );

    const slice = new WorldModelCompiler().compile(
      document,
      'revision_partial' as RevisionId,
      { limit: 1 },
    );

    expect(slice.knowledge).toMatchObject({ state: 'partial' });
    expect(slice.knowledge.unresolvedBoundaryRefs).toContain('node:line_b');
    expect(slice.continuationToken).toBeTruthy();
    expect(slice.sourceSpans).toHaveLength(1);
  });

  it('marks an unsupported local node as unknown instead of resolved empty space', () => {
    const document = drawing();
    document.geometry.push({
      id: 'ray_a' as GeometryId,
      type: 'ray',
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      origin: [0, 0],
      direction: [1, 0],
    });

    const slice = new WorldModelCompiler().compile(
      document,
      'revision_unknown' as RevisionId,
      { nodeIds: ['ray_a'] },
    );

    expect(slice.knowledge).toMatchObject({
      state: 'unknown',
      unresolvedBoundaryRefs: ['node:ray_a'],
    });
    expect(slice.diagnostics).toEqual([
      expect.objectContaining({ code: 'WORLD_MODEL_UNBOUNDED_GEOMETRY', nodeIds: ['ray_a'] }),
    ]);
  });

  it('keeps geometric incidence separate from authored connectivity', () => {
    const document = drawing();
    document.geometry.push(
      line('horizontal', [-10, 0], [10, 0]),
      line('vertical', [0, -10], [0, 10]),
    );

    const compiler = new WorldModelCompiler();
    const incidenceOnly = compiler.compile(
      document,
      'revision_crossing' as RevisionId,
      { nodeIds: ['horizontal', 'vertical'] },
    );

    expect(incidenceOnly.incidenceEdges).toEqual([
      expect.objectContaining({ kind: 'crossing', point: [0, 0] }),
    ]);
    expect(incidenceOnly.connectedEdges).toEqual([]);

    document.relations.push({
      id: 'connected_relation' as RelationId,
      type: 'topology',
      plane: 'topology',
      kind: 'connected',
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      nodeIds: ['horizontal', 'vertical'],
    });
    const authored = compiler.compile(
      document,
      'revision_connected' as RevisionId,
      { nodeIds: ['horizontal', 'vertical'] },
    );
    expect(authored.connectedEdges).toEqual([
      expect.objectContaining({ source: 'authored', nodeIds: ['horizontal', 'vertical'] }),
    ]);
  });
});

function drawing(): DrawingDocument {
  return createEmptyDrawing({
    idFactory: {
      next: (kind) => kind === 'drawing' ? 'drawing_world_model' : `${kind}_unused`,
    },
    now: () => 1,
  });
}

function line(
  id: string,
  start: readonly [number, number],
  end: readonly [number, number],
) {
  return {
    id: id as GeometryId,
    type: 'line' as const,
    visible: true,
    quality: { status: 'confirmed' as const, evidenceRefs: [] },
    start,
    end,
  };
}
