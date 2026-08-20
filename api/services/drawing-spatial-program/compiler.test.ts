import { describe, expect, it } from 'vitest';

import type {
  DrawingDocument,
  DrawingId,
  GeometryId,
  RevisionId,
} from '../../../src/drawing/index.js';
import { compileSpatialEditProgram } from './compiler.js';
import { parseSpatialEditProgram } from './parser.js';

describe('compileSpatialEditProgram', () => {
  it('translates explicit geometry while leaving every unmentioned node unchanged', () => {
    const document = fixtureDocument();
    const untouchedBefore = structuredClone(document.geometry.find((node) => node.id === 'context_line'));
    const program = parseSpatialEditProgram({
      baseRevision: 'revision_1', summary: 'move carrier', intent: 'move one target',
      targets: [{ id: 'carrier', description: 'selected carrier', nodeRefs: ['carrier_circle'] }],
      operations: [{
        kind: 'translate', nodeIds: ['carrier_circle'],
        from: { kind: 'node_anchor', nodeId: 'carrier_circle', anchor: 'center' },
        to: { kind: 'world', frameId: 'frame_document', point: [40, 30] },
      }],
      preserveNodeRefs: ['context_line'],
    });

    const result = compileSpatialEditProgram(program, {
      document,
      drawingId: document.id,
      revision: 'revision_1' as RevisionId,
      readObservationView: () => null,
    });

    expect(result.commands).toEqual([{
      type: 'geometry.update', id: 'carrier_circle',
      changes: { center: [40, 30] },
    }]);
    expect(result.document.geometry.find((node) => node.id === 'carrier_circle'))
      .toMatchObject({ center: [40, 30], radius: 5 });
    expect(result.document.geometry.find((node) => node.id === 'context_line'))
      .toEqual(untouchedBefore);
    expect(document.geometry.find((node) => node.id === 'carrier_circle'))
      .toMatchObject({ center: [10, 10] });
  });

  it('applies an additive world-space translation delta', () => {
    const document = fixtureDocument();
    const program = parseSpatialEditProgram({
      baseRevision: 'revision_1', summary: 'move by delta', intent: 'move upward',
      targets: [{ id: 'carrier', description: 'selected carrier', nodeRefs: ['carrier_circle'] }],
      operations: [{
        kind: 'translate', nodeIds: ['carrier_circle'],
        delta: { x: 0, y: 120 },
      }],
    });

    const result = compileSpatialEditProgram(program, context(document));

    expect(result.document.geometry.find((node) => node.id === 'carrier_circle'))
      .toMatchObject({ center: [10, 130] });
  });

  it('rejects a spatial program that produces no Drawing IR change', () => {
    const document = fixtureDocument();
    const program = parseSpatialEditProgram({
      baseRevision: 'revision_1', summary: 'no-op', intent: 'move target',
      targets: [{ id: 'carrier', description: 'selected carrier', nodeRefs: ['carrier_circle'] }],
      operations: [{
        kind: 'translate', nodeIds: ['carrier_circle'],
        from: { kind: 'node_anchor', nodeId: 'carrier_circle', anchor: 'center' },
        to: { kind: 'node_anchor', nodeId: 'carrier_circle', anchor: 'center' },
      }],
    });

    expect(() => compileSpatialEditProgram(program, context(document))).toThrow(
      expect.objectContaining({ code: 'SPATIAL_PROGRAM_INVALID' }),
    );
  });

  it('moves a closed carrier while code preserves every connected external anchor', () => {
    const document = connectedFixtureDocument();
    const program = parseSpatialEditProgram({
      baseRevision: 'revision_1', summary: 'move connected carrier',
      intent: 'move the selected carrier and keep its surrounding connection anchored',
      targets: [{
        id: 'connected_part', description: 'closed carrier and connector',
        nodeRefs: ['carrier_circle', 'connector_line'],
      }],
      operations: [
        {
          kind: 'set_endpoint', nodeId: 'connector_line', endpoint: 'end',
          point: world(30, 20),
        },
        {
          kind: 'translate', nodeIds: ['carrier_circle'],
          from: { kind: 'node_anchor', nodeId: 'carrier_circle', anchor: 'center' },
          to: world(30, 20),
        },
      ],
      preserveNodeRefs: ['connector_lower', 'body_line'],
    });

    const result = compileSpatialEditProgram(program, context(document));
    const carrier = result.document.geometry.find((node) => node.id === 'carrier_circle');
    const connector = result.document.geometry.find((node) => node.id === 'connector_line');
    const lowerConnector = result.document.geometry.find((node) => node.id === 'connector_lower');

    expect(carrier).toMatchObject({ type: 'circle', center: [30, 20], radius: 5 });
    expect(connector).toMatchObject({ type: 'line', end: [20, 0] });
    expect(lowerConnector).toMatchObject({ type: 'line', end: [20, 20] });
    expect(result.document.geometry.find((node) => node.id === 'body_line'))
      .toEqual(document.geometry.find((node) => node.id === 'body_line'));
    if (carrier?.type !== 'circle' || connector?.type !== 'line'
      || lowerConnector?.type !== 'line') {
      throw new Error('expected connected circle and lines');
    }
    expect(Math.hypot(
      connector.start[0] - carrier.center[0],
      connector.start[1] - carrier.center[1],
    )).toBeCloseTo(carrier.radius, 6);
    expect(Math.hypot(
      lowerConnector.start[0] - carrier.center[0],
      lowerConnector.start[1] - carrier.center[1],
    )).toBeCloseTo(carrier.radius, 6);
    expect(result.commands.map((command) => (
      command.type === 'geometry.update' ? command.id : null
    )))
      .toEqual(['carrier_circle', 'connector_line', 'connector_lower']);
  });

  it('rejects a connected carrier translation that mixes unrelated surrounding geometry', () => {
    const document = connectedFixtureDocument();
    const program = parseSpatialEditProgram({
      baseRevision: 'revision_1', summary: 'unsafe mixed translate',
      intent: 'move one connected part',
      targets: [{
        id: 'mixed_part', description: 'carrier mixed with surrounding geometry',
        nodeRefs: ['carrier_circle', 'connector_line', 'body_line'],
      }],
      operations: [{
        kind: 'translate', nodeIds: ['carrier_circle', 'connector_line', 'body_line'],
        from: { kind: 'node_anchor', nodeId: 'carrier_circle', anchor: 'center' },
        to: world(30, 20),
      }],
    });

    expect(() => compileSpatialEditProgram(program, context(document))).toThrow(
      expect.objectContaining({ code: 'SPATIAL_PROGRAM_INVALID' }),
    );
  });

  it('sets endpoints on open line, polyline, spline and arc geometry', () => {
    const document = fixtureDocument();
    document.geometry.push(
      {
        id: 'polyline_1' as GeometryId, type: 'polyline', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] }, closed: false,
        vertices: [{ point: [0, 0] }, { point: [10, 0] }, { point: [20, 0] }],
      },
      {
        id: 'spline_1' as GeometryId, type: 'spline', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] }, closed: false, periodic: false,
        degree: 1, controlPoints: [[0, 0], [4, 4]], knots: [0, 0, 1, 1],
      },
      {
        id: 'arc_1' as GeometryId, type: 'arc', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
        center: [100, 100], radius: 10, startAngle: 0, endAngle: 180,
        counterClockwise: true,
      },
    );
    const program = parseSpatialEditProgram({
      baseRevision: 'revision_1', summary: 'reconnect endpoints', intent: 'set interfaces',
      targets: [{
        id: 'interfaces', description: 'open path interfaces',
        nodeRefs: ['context_line', 'polyline_1', 'spline_1', 'arc_1'],
      }],
      operations: [
        { kind: 'set_endpoint', nodeId: 'context_line', endpoint: 'end', point: world(50, 60) },
        { kind: 'set_endpoint', nodeId: 'polyline_1', endpoint: 'start', point: world(-5, -5) },
        { kind: 'set_endpoint', nodeId: 'spline_1', endpoint: 'end', point: world(9, 9) },
        { kind: 'set_endpoint', nodeId: 'arc_1', endpoint: 'start', point: world(100, 110) },
      ],
    });

    const result = compileSpatialEditProgram(program, context(document));

    expect(result.document.geometry.find((node) => node.id === 'context_line'))
      .toMatchObject({ start: [0, 0], end: [50, 60] });
    expect(result.document.geometry.find((node) => node.id === 'polyline_1'))
      .toMatchObject({ vertices: [{ point: [-5, -5] }, { point: [10, 0] }, { point: [20, 0] }] });
    expect(result.document.geometry.find((node) => node.id === 'spline_1'))
      .toMatchObject({ controlPoints: [[0, 0], [9, 9]] });
    expect(result.document.geometry.find((node) => node.id === 'arc_1'))
      .toMatchObject({ startAngle: 90, endAngle: 180 });
  });

  it('atomically creates explicit paths and deletes replaced geometry', () => {
    const document = fixtureDocument();
    const program = parseSpatialEditProgram({
      baseRevision: 'revision_1', summary: 'replace paths', intent: 'replace boundaries',
      targets: [{ id: 'paths', description: 'boundary paths', nodeRefs: ['context_line'] }],
      operations: [
        {
          kind: 'create_path', geometry: 'line', nodeId: 'new_line',
          points: [world(0, 10), world(20, 10)],
        },
        {
          kind: 'create_path', geometry: 'polyline', nodeId: 'new_polyline', closed: false,
          points: [world(0, 20), world(10, 30), world(20, 20)],
        },
        { kind: 'delete_nodes', nodeIds: ['context_line'] },
      ],
      evidenceRefs: ['view_1'], confidence: 0.55,
    });

    const result = compileSpatialEditProgram(program, context(document));

    expect(result.commands.map((command) => command.type)).toEqual([
      'geometry.create', 'geometry.create', 'geometry.delete',
    ]);
    expect(result.document.geometry.find((node) => node.id === 'new_line')).toMatchObject({
      type: 'line', start: [0, 10], end: [20, 10],
      quality: { status: 'candidate', confidence: 0.55, evidenceRefs: ['view_1'] },
    });
    expect(result.document.geometry.find((node) => node.id === 'new_polyline')).toMatchObject({
      type: 'polyline', closed: false,
      vertices: [{ point: [0, 20] }, { point: [10, 30] }, { point: [20, 20] }],
    });
    expect(result.document.geometry.some((node) => node.id === 'context_line')).toBe(false);
    expect(document.geometry.some((node) => node.id === 'context_line')).toBe(true);
  });

  it('rejects a program that contradicts its own preserve contract', () => {
    const document = fixtureDocument();
    const program = parseSpatialEditProgram({
      baseRevision: 'revision_1', summary: 'contradiction', intent: 'invalid plan',
      targets: [{ id: 'target', description: 'target', nodeRefs: ['context_line'] }],
      operations: [{
        kind: 'translate', nodeIds: ['context_line'],
        from: { kind: 'node_anchor', nodeId: 'context_line', anchor: 'start' },
        to: world(5, 5),
      }],
      preserveNodeRefs: ['context_line'],
    });

    expect(() => compileSpatialEditProgram(program, context(document))).toThrow(
      expect.objectContaining({ code: 'SPATIAL_PROGRAM_PRESERVE_CONFLICT' }),
    );
    expect(document.geometry.find((node) => node.id === 'context_line'))
      .toMatchObject({ start: [0, 0], end: [100, 0] });
  });

  it('reports declared postconditions as diagnostics without hiding a failed check', () => {
    const document = fixtureDocument();
    const target = world(40, 30);
    const program = parseSpatialEditProgram({
      baseRevision: 'revision_1', summary: 'move and check', intent: 'move target',
      targets: [{ id: 'carrier', description: 'carrier', nodeRefs: ['carrier_circle'] }],
      operations: [{
        kind: 'translate', nodeIds: ['carrier_circle'],
        from: { kind: 'node_anchor', nodeId: 'carrier_circle', anchor: 'center' },
        to: target,
      }],
      postconditions: [
        {
          kind: 'anchor_at',
          anchor: { kind: 'node_anchor', nodeId: 'carrier_circle', anchor: 'center' },
          point: target,
        },
        {
          kind: 'anchors_coincident',
          first: { kind: 'node_anchor', nodeId: 'carrier_circle', anchor: 'center' },
          second: target,
        },
        { kind: 'nodes_unchanged', nodeIds: ['context_line'] },
        { kind: 'path_closed', nodeId: 'context_line' },
      ],
    });

    const result = compileSpatialEditProgram(program, context(document));

    expect(result.diagnostics.map((diagnostic) => [diagnostic.kind, diagnostic.status])).toEqual([
      ['anchor_at', 'passed'],
      ['anchors_coincident', 'passed'],
      ['nodes_unchanged', 'passed'],
      ['path_closed', 'failed'],
    ]);
  });

  it('rejects a program compiled against a different Drawing IR revision', () => {
    const document = fixtureDocument();
    const program = parseSpatialEditProgram({
      baseRevision: 'revision_stale', summary: 'stale', intent: 'move target',
      targets: [{ id: 'carrier', description: 'carrier', nodeRefs: ['carrier_circle'] }],
      operations: [{
        kind: 'translate', nodeIds: ['carrier_circle'],
        from: { kind: 'node_anchor', nodeId: 'carrier_circle', anchor: 'center' },
        to: world(20, 20),
      }],
    });

    expect(() => compileSpatialEditProgram(program, context(document))).toThrow(
      expect.objectContaining({ code: 'SPATIAL_PROGRAM_REVISION_MISMATCH' }),
    );
  });

  it('uses the injected Drawing IR id factory for an unnamed created path', () => {
    const document = fixtureDocument();
    const program = parseSpatialEditProgram({
      baseRevision: 'revision_1', summary: 'create path', intent: 'add a path',
      targets: [{ id: 'new_path', description: 'new path', nodeRefs: [] }],
      operations: [{ kind: 'create_path', geometry: 'line', points: [world(0, 0), world(1, 1)] }],
    });

    const result = compileSpatialEditProgram(program, {
      ...context(document),
      idFactory: { next: (kind) => `${kind}_deterministic` },
    });

    expect(result.document.geometry).toContainEqual(expect.objectContaining({
      id: 'geometry_deterministic', type: 'line',
    }));
  });
});

function world(x: number, y: number) {
  return { kind: 'world', frameId: 'frame_document', point: [x, y] };
}

function context(document: DrawingDocument) {
  return {
    document,
    drawingId: document.id,
    revision: 'revision_1' as RevisionId,
    readObservationView: () => null,
  };
}

function fixtureDocument(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0',
    id: 'drawing_spatial_program' as DrawingId,
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'frame_document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [
      {
        id: 'carrier_circle' as GeometryId, type: 'circle', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] }, center: [10, 10], radius: 5,
      },
      {
        id: 'context_line' as GeometryId, type: 'line', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] }, start: [0, 0], end: [100, 0],
      },
    ],
    annotations: [], relations: [], features: [],
  };
}

function connectedFixtureDocument(): DrawingDocument {
  const document = fixtureDocument();
  document.geometry = [
    document.geometry[0],
    {
      id: 'connector_line' as GeometryId, type: 'line', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] }, start: [10, 5], end: [20, 0],
    },
    {
      id: 'connector_lower' as GeometryId, type: 'line', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] }, start: [5, 10], end: [20, 20],
    },
    {
      id: 'body_line' as GeometryId, type: 'line', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] }, start: [20, 0], end: [20, -20],
    },
  ];
  return document;
}
