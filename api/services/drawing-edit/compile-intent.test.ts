import { describe, expect, it } from 'vitest';

import type { EditIntent } from '../../../src/contracts/drawing-spatial-agent.js';
import type {
  DrawingDocument,
  GeometryId,
  GeometryNode,
} from '../../../src/drawing/index.js';
import { compileEditIntent } from './compile-intent.js';

describe('compileEditIntent', () => {
  it('compiles an exact rotation into an incremental geometry update', () => {
    const document = documentWith([
      geometry({ id: 'arm', type: 'line', start: [10, 10], end: [40, 10] }),
      geometry({ id: 'body', type: 'circle', center: [0, 0], radius: 20 }),
    ]);

    const compiled = compileEditIntent(intent({
      operation: 'transform',
      targetNodeIds: ['arm'],
      preserveNodeIds: ['body'],
      transform: { kind: 'rotate', center: [10, 10], angleDegrees: 90 },
    }), { document });

    expect(compiled.commands).toEqual([{
      type: 'geometry.update',
      id: 'arm',
      changes: { end: [10, 40] },
      expected: { end: [40, 10] },
    }]);
    expect(compiled).toMatchObject({
      targetNodeIds: ['arm'], preserveNodeIds: ['body'], strategy: 'exact-transform',
    });
  });

  it('replaces only the authorized local target and snaps a candidate endpoint to its anchor', () => {
    const document = documentWith([
      geometry({ id: 'old_hand', type: 'line', start: [10, 10], end: [20, 10] }),
      geometry({ id: 'body', type: 'circle', center: [0, 0], radius: 20 }),
    ]);
    const candidate = geometry({
      id: 'raised_hand', type: 'line', start: [10.2, 10.1], end: [10, 35],
    });

    const compiled = compileEditIntent(intent({
      operation: 'local-redraw',
      targetNodeIds: ['old_hand'],
      preserveNodeIds: ['body'],
      anchors: [{ nodeId: 'body', role: 'wrist', point: [10, 10] }],
      confidence: 0.5,
    }), { document, candidateGeometry: [candidate], anchorTolerance: 1 });

    expect(compiled.commands).toEqual([{
      type: 'geometry.delete', id: 'old_hand',
    }, {
      type: 'geometry.create', value: expect.objectContaining({
        id: 'raised_hand', start: [10, 10], end: [10, 35],
        quality: expect.objectContaining({ status: 'candidate', confidence: 0.5 }),
      }),
    }]);
    expect(compiled.strategy).toBe('local-replacement');
  });

  it('keeps deformation candidates inside the authorized target bounds', () => {
    const document = documentWith([
      geometry({ id: 'arm', type: 'line', start: [10, 10], end: [20, 10] }),
      geometry({ id: 'body', type: 'circle', center: [0, 0], radius: 5 }),
    ]);
    const edit = intent({
      operation: 'deform', targetNodeIds: ['arm'], preserveNodeIds: ['body'],
    });

    const valid = compileEditIntent(edit, {
      document,
      candidateGeometry: [geometry({
        id: 'arm', type: 'line', start: [10, 10], end: [22, 12],
      })],
    });
    expect(valid).toMatchObject({
      strategy: 'bounded-deform',
      commands: [{ type: 'geometry.update', id: 'arm', changes: { end: [22, 12] } }],
    });

    expect(() => compileEditIntent(edit, {
      document,
      candidateGeometry: [geometry({
        id: 'arm', type: 'line', start: [10, 10], end: [100, 100],
      })],
    })).toThrow('EDIT_DEFORM_OUTSIDE_ALLOWED_BOUNDS:arm');
  });

  it('rejects candidate ids that would overwrite protected geometry', () => {
    const document = documentWith([
      geometry({ id: 'old_hand', type: 'line', start: [10, 10], end: [20, 10] }),
      geometry({ id: 'body', type: 'circle', center: [0, 0], radius: 20 }),
    ]);

    expect(() => compileEditIntent(intent({
      operation: 'local-redraw', targetNodeIds: ['old_hand'], preserveNodeIds: ['body'],
    }), {
      document,
      candidateGeometry: [geometry({ id: 'body', type: 'line', start: [0, 0], end: [1, 1] })],
    })).toThrow('EDIT_CANDIDATE_ID_COLLISION:body');
  });
});

function intent(overrides: Partial<EditIntent>): EditIntent {
  return {
    operation: 'local-redraw', targetFeatureIds: ['right_hand'], targetNodeIds: ['old_hand'],
    anchors: [], preserveNodeIds: [], preserveRules: [{ type: 'outside-target-unchanged' }],
    desiredRelations: [], confidence: 0.9, evidenceRefs: ['view_detail'],
    ...overrides,
  };
}

function geometry(input: Record<string, unknown> & { id: string; type: GeometryNode['type'] }): GeometryNode {
  return {
    ...input,
    id: input.id as GeometryId,
    visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
  } as unknown as GeometryNode;
}

function documentWith(geometryItems: GeometryNode[]): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0',
    id: 'drawing_edit' as DrawingDocument['id'], metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: geometryItems, annotations: [], relations: [], features: [],
  };
}
