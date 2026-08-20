import { describe, expect, it } from 'vitest';

import { parseSpatialEditProgram } from './parser.js';

describe('parseSpatialEditProgram', () => {
  it('normalizes a bounded task-specific edit program', () => {
    const program = parseSpatialEditProgram({
      baseRevision: 'revision_1',
      summary: '移动目标并重连边界',
      intent: '保持未提及内容不变，将目标载体移动到视觉点',
      targets: [{
        id: 'target_1',
        description: '用户指令指向的视觉载体',
        nodeRefs: ['circle_1'],
        interfaceRefs: [{
          kind: 'node_anchor', nodeId: 'connector_1', anchor: 'end',
        }],
      }],
      operations: [{
        kind: 'translate',
        nodeIds: ['circle_1'],
        from: { kind: 'node_anchor', nodeId: 'circle_1', anchor: 'center' },
        to: { kind: 'observation', observationId: 'view_1', normalized: [0.75, 0.2] },
      }],
      preserveNodeRefs: ['context_1'],
      postconditions: [{
        kind: 'anchor_at',
        anchor: { kind: 'node_anchor', nodeId: 'circle_1', anchor: 'center' },
        point: { kind: 'observation', observationId: 'view_1', normalized: [0.75, 0.2] },
      }],
      evidenceRefs: ['view_1'],
      confidence: 0.82,
    });

    expect(program).toMatchObject({
      baseRevision: 'revision_1',
      summary: '移动目标并重连边界',
      targets: [{ id: 'target_1', nodeRefs: ['circle_1'] }],
      operations: [{ kind: 'translate', nodeIds: ['circle_1'] }],
      confidence: 0.82,
    });
  });

  it('normalizes a model supplied translation delta into a world-space vector', () => {
    const program = parseSpatialEditProgram({
      baseRevision: 'revision_1', summary: 'move by vector', intent: 'translate target upward',
      targets: [{ id: 'target', description: 'selected target', nodeRefs: ['circle_1'] }],
      operations: [{
        kind: 'translate', nodeIds: ['circle_1'],
        delta: { x: 0, y: 120 },
      }],
    });

    expect(program.operations).toEqual([expect.objectContaining({
      kind: 'translate', delta: [0, 120],
    })]);
  });

  it('rejects a translation that provides neither a delta nor a complete from/to pair', () => {
    expect(() => parseSpatialEditProgram({
      baseRevision: 'revision_1', summary: 'invalid move', intent: 'missing displacement',
      targets: [{ id: 'target', description: 'selected target', nodeRefs: ['circle_1'] }],
      operations: [{ kind: 'translate', nodeIds: ['circle_1'] }],
    })).toThrow('translate requires either delta or both from and to');
  });

  it('rejects observation points outside the normalized image bounds', () => {
    expect(() => parseSpatialEditProgram({
      baseRevision: 'revision_1', summary: 'move', intent: 'move target',
      targets: [{ id: 'target', description: 'target', nodeRefs: ['circle_1'] }],
      operations: [{
        kind: 'translate', nodeIds: ['circle_1'],
        from: { kind: 'node_anchor', nodeId: 'circle_1', anchor: 'center' },
        to: { kind: 'observation', observationId: 'view_1', normalized: [1.2, 0.5] },
      }],
    })).toThrow(expect.objectContaining({ code: 'SPATIAL_PROGRAM_INVALID' }));
  });

  it('accepts the generic endpoint, path creation and deletion operations', () => {
    const program = parseSpatialEditProgram({
      baseRevision: 'revision_1', summary: 'rebuild interfaces', intent: 'edit paths',
      targets: [{ id: 'target', description: 'target', nodeRefs: ['line_1'] }],
      operations: [
        {
          kind: 'set_endpoint', nodeId: 'line_1', endpoint: 'end',
          point: { kind: 'world', frameId: 'frame_document', point: [10, 20] },
        },
        {
          kind: 'create_path', geometry: 'polyline', nodeId: 'new_path', closed: false,
          points: [
            { kind: 'world', frameId: 'frame_document', point: [0, 0] },
            { kind: 'world', frameId: 'frame_document', point: [5, 5] },
            { kind: 'world', frameId: 'frame_document', point: [10, 0] },
          ],
        },
        { kind: 'delete_nodes', nodeIds: ['old_path'] },
      ],
      postconditions: [
        {
          kind: 'anchors_coincident',
          first: { kind: 'node_anchor', nodeId: 'line_1', anchor: 'end' },
          second: { kind: 'world', frameId: 'frame_document', point: [10, 20] },
        },
        { kind: 'nodes_unchanged', nodeIds: ['context_1'] },
        { kind: 'path_closed', nodeId: 'closed_path' },
      ],
    });

    expect(program.operations.map((operation) => operation.kind)).toEqual([
      'set_endpoint', 'create_path', 'delete_nodes',
    ]);
    expect(program.postconditions.map((condition) => condition.kind)).toEqual([
      'anchors_coincident', 'nodes_unchanged', 'path_closed',
    ]);
  });

  it('rejects a program without a target or executable operation', () => {
    expect(() => parseSpatialEditProgram({
      baseRevision: 'revision_1', summary: 'empty', intent: 'empty',
      targets: [], operations: [],
    })).toThrow(expect.objectContaining({ code: 'SPATIAL_PROGRAM_INVALID' }));
  });

  it('bounds the operation list before it reaches geometry compilation', () => {
    expect(() => parseSpatialEditProgram({
      baseRevision: 'revision_1', summary: 'too large', intent: 'too large',
      targets: [{ id: 'target', description: 'target', nodeRefs: ['node_1'] }],
      operations: Array.from({ length: 65 }, (_, index) => ({
        kind: 'delete_nodes', nodeIds: [`node_${index}`],
      })),
    })).toThrow(expect.objectContaining({ code: 'SPATIAL_PROGRAM_INVALID' }));
  });

  it('bounds targets and reference lists before they enter model context or geometry work', () => {
    expect(() => parseSpatialEditProgram({
      baseRevision: 'revision_1', summary: 'too many targets', intent: 'bounded input',
      targets: Array.from({ length: 33 }, (_, index) => ({
        id: `target_${index}`, description: 'target', nodeRefs: [`node_${index}`],
      })),
      operations: [{ kind: 'delete_nodes', nodeIds: ['node_1'] }],
    })).toThrow(expect.objectContaining({ code: 'SPATIAL_PROGRAM_INVALID' }));

    expect(() => parseSpatialEditProgram({
      baseRevision: 'revision_1', summary: 'too many refs', intent: 'bounded input',
      targets: [{ id: 'target', description: 'target', nodeRefs: ['node_1'] }],
      operations: [{
        kind: 'delete_nodes',
        nodeIds: Array.from({ length: 129 }, (_, index) => `node_${index}`),
      }],
    })).toThrow(expect.objectContaining({ code: 'SPATIAL_PROGRAM_INVALID' }));
  });
});
