// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument, GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import {
  applyDrawingTransaction,
  canonicalSemanticString,
  solveSpatialIntent,
  type GroundedEditTarget,
} from './index';

const quality = { status: 'confirmed' as const, evidenceRefs: [] };
const ports = {
  digest: (value: string) => `sha256:${value.length}:${checksum(value)}`,
  id: (kind: string) => `${kind}-1`,
  now: () => 7,
};

function fixture(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0', id: 'drawing-solver' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [
      { id: 'part-a' as GeometryId, type: 'circle', center: [-20, 0], radius: 4, visible: true, quality },
      { id: 'connector-a' as GeometryId, type: 'line', start: [-30, 0], end: [-24, 0], visible: true, quality },
      { id: 'part-b' as GeometryId, type: 'circle', center: [20, 10], radius: 5, visible: true, quality },
      { id: 'connector-b' as GeometryId, type: 'line', start: [30, 10], end: [25, 10], visible: true, quality },
      { id: 'untouched' as GeometryId, type: 'circle', center: [-35, 30], radius: 2, visible: true, quality },
    ],
    annotations: [], relations: [], features: [],
  };
}

function target(nodeId: string, connectorId?: string): GroundedEditTarget {
  return {
    targetHandle: `target-${nodeId}`,
    targetNodeIds: [nodeId],
    interfaces: connectorId ? [{
      interfaceId: `${connectorId}:end`, nodeId: connectorId, endpoint: 'end',
    }] : [],
    sourceStatus: 'confirmed',
  };
}

function circleCenter(document: DrawingDocument, nodeId: string): [number, number] {
  const node = document.geometry.find(({ id }) => id === nodeId);
  if (!node || node.type !== 'circle') throw new Error(`missing circle ${nodeId}`);
  return [...node.center];
}

describe('solveSpatialIntent', () => {
  it('solves a qualitative direction and transports connected endpoints exactly', () => {
    const before = fixture();
    const solved = solveSpatialIntent({
      document: before,
      baseRef: { drawingId: before.id, revision: 1 },
      parts: { hand: target('part-a', 'connector-a') },
      intent: {
        summary: 'move the selected part upward',
        goals: [{ kind: 'direction', subject: 'hand', direction: 'up', magnitude: 'moderate' }],
        preserve: [{ kind: 'connectivity', partKey: 'hand' }, { kind: 'protected_scope' }],
      },
      numericConstraints: [], ports,
    });

    const beforeCenter = circleCenter(before, 'part-a');
    const afterCenter = circleCenter(solved.candidate, 'part-a');
    expect(afterCenter[1]).toBeGreaterThan(beforeCenter[1]);
    const connector = solved.candidate.geometry.find(({ id }) => id === 'connector-a');
    if (!connector || connector.type !== 'line') throw new Error('missing connector');
    expect(Math.hypot(connector.end[0] - afterCenter[0], connector.end[1] - afterCenter[1])).toBeCloseTo(4, 8);
    expect(solved.candidate.geometry.find(({ id }) => id === 'untouched')).toEqual(
      before.geometry.find(({ id }) => id === 'untouched'),
    );
    expect(solved.solver.inputsContainModelCoordinates).toBe(false);
    expect(solved.inverse.length).toBeGreaterThan(0);
    expect(canonicalSemanticString(applyDrawingTransaction(solved.candidate, solved.inverse, 9)))
      .toBe(canonicalSemanticString(before));
  });

  it('moves disconnected geometry as one semantic part without requiring a connected carrier', () => {
    const before = fixture();
    const solved = solveSpatialIntent({
      document: before,
      baseRef: { drawingId: before.id, revision: 1 },
      parts: {
        composite: {
          targetHandle: 'target-disconnected-composite',
          targetNodeIds: ['part-a', 'untouched'],
          interfaces: [],
          sourceStatus: 'confirmed',
        },
      },
      intent: {
        summary: 'move the two disconnected contours upward as one semantic part',
        goals: [{ kind: 'direction', subject: 'composite', direction: 'up', magnitude: 'moderate' }],
        preserve: [{ kind: 'part_shape', partKey: 'composite' }, { kind: 'minimum_deformation' }],
      },
      numericConstraints: [], ports,
    });

    expect(circleCenter(solved.candidate, 'part-a')[1] - circleCenter(before, 'part-a')[1])
      .toBeGreaterThan(0);
    expect(circleCenter(solved.candidate, 'untouched')[1] - circleCenter(before, 'untouched')[1])
      .toBeCloseTo(circleCenter(solved.candidate, 'part-a')[1] - circleCenter(before, 'part-a')[1], 8);
    expect(solved.actualEffect.updatedNodeIds).toEqual(['part-a', 'untouched']);
  });

  it('decomposes a semantic carrier-and-connector selection into carrier motion and endpoint transport', () => {
    const before = fixture();
    const beforeConnector = before.geometry.find(({ id }) => id === 'connector-a');
    if (!beforeConnector || beforeConnector.type !== 'line') throw new Error('missing connector');

    const solved = solveSpatialIntent({
      document: before,
      baseRef: { drawingId: before.id, revision: 1 },
      parts: {
        articulated: {
          targetHandle: 'target-articulated-composite',
          targetNodeIds: ['part-a', 'connector-a'],
          interfaces: [],
          sourceStatus: 'confirmed',
        },
      },
      intent: {
        summary: 'raise the articulated semantic part while keeping its fixed attachment',
        goals: [{ kind: 'direction', subject: 'articulated', direction: 'up', magnitude: 'moderate' }],
        preserve: [{ kind: 'connectivity', partKey: 'articulated' }, { kind: 'minimum_deformation' }],
      },
      numericConstraints: [], ports,
    });

    const afterConnector = solved.candidate.geometry.find(({ id }) => id === 'connector-a');
    if (!afterConnector || afterConnector.type !== 'line') throw new Error('missing connector');
    expect(afterConnector.start).toEqual(beforeConnector.start);
    expect(afterConnector.end).not.toEqual(beforeConnector.end);
    expect(afterConnector.end[1]).toBeGreaterThan(beforeConnector.end[1]);
    expect(solved.actualEffect.updatedNodeIds).toEqual(['connector-a', 'part-a']);
  });

  it('rejects an articulated selection that mixes a carrier and its connector with unrelated geometry', () => {
    const before = fixture();
    before.geometry.push({
      id: 'shoulder-detail' as GeometryId,
      type: 'arc',
      center: [-8, 0],
      radius: 2,
      startAngle: 0,
      endAngle: Math.PI,
      counterClockwise: true,
      visible: true,
      quality,
    });

    let failure: unknown;
    try {
      solveSpatialIntent({
        document: before,
        baseRef: { drawingId: before.id, revision: 1 },
        parts: {
          articulated: {
            targetHandle: 'target-articulated-with-unrelated-detail',
            targetNodeIds: ['part-a', 'connector-a', 'shoulder-detail'],
            interfaces: [],
            sourceStatus: 'confirmed',
          },
        },
        intent: {
          summary: 'raise the articulated semantic part while keeping its fixed attachment',
          goals: [{ kind: 'direction', subject: 'articulated', direction: 'up', magnitude: 'moderate' }],
          preserve: [{ kind: 'connectivity', partKey: 'articulated' }, { kind: 'minimum_deformation' }],
        },
        numericConstraints: [], ports,
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({
      message: 'EDIT_ARTICULATED_SELECTION_INVALID',
      code: 'EDIT_ARTICULATED_SELECTION_INVALID',
      partKey: 'articulated',
      unexpectedNodeIds: ['shoulder-detail'],
    });
  });

  it('rejects an articulated carrier and its connectors split across primitive-sized parts', () => {
    const before = fixture();
    before.geometry.push({
      id: 'shoulder-detail' as GeometryId,
      type: 'arc',
      center: [-8, 0],
      radius: 2,
      startAngle: 0,
      endAngle: Math.PI,
      counterClockwise: true,
      visible: true,
      quality,
    });

    let failure: unknown;
    try {
      solveSpatialIntent({
        document: before,
        baseRef: { drawingId: before.id, revision: 1 },
        parts: {
          hand: target('part-a'),
          armLine: target('connector-a'),
          shoulder: target('shoulder-detail'),
        },
        intent: {
          summary: 'raise the articulated hand and arm',
          goals: [{ kind: 'direction', subject: 'hand', direction: 'up', magnitude: 'moderate' }],
          preserve: [
            { kind: 'connectivity', partKey: 'hand' },
            { kind: 'connectivity', partKey: 'armLine' },
            { kind: 'connectivity', partKey: 'shoulder' },
          ],
        },
        numericConstraints: [], ports,
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({
      message: 'EDIT_ARTICULATED_SELECTION_FRAGMENTED',
      code: 'EDIT_ARTICULATED_SELECTION_FRAGMENTED',
      partKey: 'hand',
      mergePartKeys: ['armLine'],
      mergeNodeIds: ['connector-a'],
      unexpectedPartKeys: ['shoulder'],
      unexpectedNodeIds: ['shoulder-detail'],
    });
  });

  it('rejects a non-articulated companion part even when the model invents a goal for it', () => {
    const before = fixture();
    let failure: unknown;
    try {
      solveSpatialIntent({
        document: before,
        baseRef: { drawingId: before.id, revision: 1 },
        parts: {
          hand: {
            targetHandle: 'target-articulated-hand',
            targetNodeIds: ['part-a', 'connector-a'],
            interfaces: [],
            sourceStatus: 'confirmed',
          },
          inventedArmSegment: target('connector-b'),
        },
        intent: {
          summary: 'raise the hand and an incorrectly inferred body segment',
          goals: [
            { kind: 'direction', subject: 'hand', direction: 'up', magnitude: 'moderate' },
            { kind: 'direction', subject: 'inventedArmSegment', direction: 'up', magnitude: 'moderate' },
          ],
          preserve: [
            { kind: 'connectivity', partKey: 'hand' },
            { kind: 'connectivity', partKey: 'inventedArmSegment' },
          ],
        },
        numericConstraints: [], ports,
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({
      message: 'EDIT_ARTICULATED_COMPANION_PART_INVALID',
      code: 'EDIT_ARTICULATED_COMPANION_PART_INVALID',
      unexpectedPartKeys: ['inventedArmSegment'],
      unexpectedNodeIds: ['connector-b'],
    });
  });

  it('rejects selected parts that are neither a goal subject nor a spatial reference', () => {
    const before = fixture();

    let failure: unknown;
    try {
      solveSpatialIntent({
      document: before,
      baseRef: { drawingId: before.id, revision: 1 },
      parts: {
        hand: target('part-a', 'connector-a'),
        unrelatedBodyLine: target('connector-b'),
      },
      intent: {
        summary: 'raise only the hand',
        goals: [{ kind: 'direction', subject: 'hand', direction: 'up', magnitude: 'moderate' }],
        preserve: [
          { kind: 'connectivity', partKey: 'hand' },
          { kind: 'topology', partKey: 'unrelatedBodyLine' },
        ],
      },
        numericConstraints: [], ports,
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({
      message: 'EDIT_SELECTED_PART_UNUSED',
      code: 'EDIT_SELECTED_PART_UNUSED',
      unusedPartKeys: ['unrelatedBodyLine'],
    });
  });

  it('combines relative position and alignment without a model-authored translation', () => {
    const before = fixture();
    const solved = solveSpatialIntent({
      document: before,
      baseRef: { drawingId: before.id, revision: 1 },
      parts: { moving: target('part-a', 'connector-a'), reference: target('part-b', 'connector-b') },
      intent: {
        summary: 'place the moving part below and aligned with the reference',
        goals: [{
          kind: 'relative_position', subject: 'moving',
          reference: { kind: 'part', partKey: 'reference' },
          relation: 'below', magnitude: 'slight',
        }, {
          kind: 'alignment', subject: 'moving',
          reference: { kind: 'part', partKey: 'reference' }, axis: 'x',
        }],
        preserve: [{ kind: 'minimum_deformation' }],
      },
      numericConstraints: [], ports,
    });

    const moving = circleCenter(solved.candidate, 'part-a');
    const reference = circleCenter(solved.candidate, 'part-b');
    expect(moving[0]).toBeCloseTo(reference[0], 8);
    expect(moving[1]).toBeLessThan(reference[1]);
  });

  it('uses only a Host-extracted numeric key for exact displacement', () => {
    const before = fixture();
    const solved = solveSpatialIntent({
      document: before,
      baseRef: { drawingId: before.id, revision: 1 },
      parts: { moving: target('part-a', 'connector-a') },
      intent: {
        summary: 'apply the exact vertical displacement from the instruction',
        goals: [{ kind: 'explicit_numeric', subject: 'moving', quantity: 'delta_y', numericKey: 'n1' }],
        preserve: [],
      },
      numericConstraints: [{
        numericKey: 'n1', kind: 'distance', value: 12, unit: 'mm',
        userEvidenceSpan: { start: 3, end: 8, text: '12 mm' },
      }],
      ports,
    });

    expect(circleCenter(solved.candidate, 'part-a')[1] - circleCenter(before, 'part-a')[1]).toBeCloseTo(12, 10);
    expect(() => solveSpatialIntent({
      document: before,
      baseRef: { drawingId: before.id, revision: 1 },
      parts: { moving: target('part-a', 'connector-a') },
      intent: {
        summary: 'missing exact displacement',
        goals: [{ kind: 'explicit_numeric', subject: 'moving', quantity: 'delta_y', numericKey: 'n2' }],
        preserve: [],
      },
      numericConstraints: [], ports,
    })).toThrow('EDIT_NUMERIC_EVIDENCE_MISSING');
  });

  it('solves two independent parts atomically with deterministic ranking', () => {
    const input = () => {
      const document = fixture();
      return {
        document,
        baseRef: { drawingId: document.id, revision: 1 },
        parts: { left: target('part-a', 'connector-a'), right: target('part-b', 'connector-b') },
        intent: {
          summary: 'move both parts down and align them',
          goals: [
            { kind: 'direction' as const, subject: 'left', direction: 'down' as const, magnitude: 'slight' as const },
            { kind: 'direction' as const, subject: 'right', direction: 'down' as const, magnitude: 'slight' as const },
            { kind: 'alignment' as const, subject: 'left', reference: { kind: 'part' as const, partKey: 'right' }, axis: 'y' as const },
          ],
          preserve: [{ kind: 'connectivity' as const, partKey: 'left' }, { kind: 'connectivity' as const, partKey: 'right' }],
        },
        numericConstraints: [], ports,
      };
    };
    const first = solveSpatialIntent(input());
    const second = solveSpatialIntent(input());

    expect(circleCenter(first.candidate, 'part-a')[1]).toBeCloseTo(circleCenter(first.candidate, 'part-b')[1], 8);
    expect(first.actualEffect.updatedNodeIds).toEqual(['connector-a', 'connector-b', 'part-a', 'part-b']);
    expect(first.candidateDigest).toBe(second.candidateDigest);
    expect(first.solver).toEqual(second.solver);
    expect(first.solver.candidateCount).toBeLessThanOrEqual(256);
  });

  it('keeps independent articulated parts attached when solving a multi-part intent', () => {
    const before = fixture();
    const solved = solveSpatialIntent({
      document: before,
      baseRef: { drawingId: before.id, revision: 1 },
      parts: {
        left: {
          targetHandle: 'target-left-articulated',
          targetNodeIds: ['part-a', 'connector-a'], interfaces: [], sourceStatus: 'confirmed',
        },
        right: {
          targetHandle: 'target-right-articulated',
          targetNodeIds: ['part-b', 'connector-b'], interfaces: [], sourceStatus: 'confirmed',
        },
      },
      intent: {
        summary: 'move both articulated parts downward as one atomic edit',
        goals: [
          { kind: 'direction', subject: 'left', direction: 'down', magnitude: 'slight' },
          { kind: 'direction', subject: 'right', direction: 'down', magnitude: 'slight' },
        ],
        preserve: [
          { kind: 'connectivity', partKey: 'left' },
          { kind: 'connectivity', partKey: 'right' },
        ],
      },
      numericConstraints: [], ports,
    });

    const connectorA = solved.candidate.geometry.find(({ id }) => id === 'connector-a');
    const connectorB = solved.candidate.geometry.find(({ id }) => id === 'connector-b');
    if (!connectorA || connectorA.type !== 'line' || !connectorB || connectorB.type !== 'line') {
      throw new Error('missing connectors');
    }
    expect(connectorA.start).toEqual([-30, 0]);
    expect(connectorB.start).toEqual([30, 10]);
    expect(connectorA.end[1]).toBeLessThan(0);
    expect(connectorB.end[1]).toBeLessThan(10);
  });

  it('aligns unequal parts moving in the same positive direction without cancelling either goal', () => {
    const document = fixture();
    const solved = solveSpatialIntent({
      document,
      baseRef: { drawingId: document.id, revision: 1 },
      parts: {
        upper: target('part-b', 'connector-b'),
        lower: target('part-a', 'connector-a'),
      },
      intent: {
        summary: 'move both unequal-height parts up and align them',
        goals: [
          { kind: 'direction', subject: 'upper', direction: 'up', magnitude: 'moderate' },
          { kind: 'direction', subject: 'lower', direction: 'up', magnitude: 'moderate' },
          { kind: 'alignment', subject: 'upper', reference: { kind: 'part', partKey: 'lower' }, axis: 'y' },
        ],
        preserve: [],
      },
      numericConstraints: [], ports,
    });

    const upperBefore = circleCenter(document, 'part-b');
    const lowerBefore = circleCenter(document, 'part-a');
    const upperAfter = circleCenter(solved.candidate, 'part-b');
    const lowerAfter = circleCenter(solved.candidate, 'part-a');
    expect(upperAfter[1]).toBeCloseTo(lowerAfter[1], 8);
    expect(upperAfter[1]).toBeGreaterThan(upperBefore[1]);
    expect(lowerAfter[1]).toBeGreaterThan(lowerBefore[1]);
    expect(solved.solver.goalResidual).toBe(0);
  });

  it.each(['touches', 'crosses', 'does_not_cross', 'inside'] as const)(
    'satisfies the hard %s topology relation',
    (relation) => {
      const document = topologyFixture(relation);
      const solved = solveSpatialIntent({
        document,
        baseRef: { drawingId: document.id, revision: 1 },
        parts: { moving: target('moving'), reference: target('reference') },
        intent: {
          summary: `make the parts ${relation}`,
          goals: [{
            kind: 'topology', subject: 'moving',
            reference: { kind: 'part', partKey: 'reference' }, relation,
          }],
          preserve: [{ kind: 'protected_scope' }],
        },
        numericConstraints: [], ports,
      });

      expect(solved.solver.topologyPenalty).toBe(0);
      expect(solved.solver.goalResidual).toBeLessThan(1e-6);
    },
  );

  it('returns an explicit collision warning for a solvable overlap and rejects impossible containment', () => {
    const before = collisionFixture();
    const semanticBefore = canonicalSemanticString(before);
    const overlapping = solveSpatialIntent({
      document: before,
      baseRef: { drawingId: before.id, revision: 1 },
      parts: { moving: target('moving') },
      intent: {
        summary: 'move exactly into the protected obstacle',
        goals: [{ kind: 'explicit_numeric', subject: 'moving', quantity: 'delta_x', numericKey: 'n1' }],
        preserve: [{ kind: 'protected_scope' }],
      },
      numericConstraints: [{
        numericKey: 'n1', kind: 'distance', value: 20, unit: 'mm',
        userEvidenceSpan: { start: 0, end: 5, text: '20 mm' },
      }],
      ports,
    });
    expect(overlapping.solver.collisionPenalty).toBeGreaterThan(0);
    expect(overlapping.diagnostics).toContainEqual(expect.objectContaining({
      code: 'SPATIAL_COLLISION_CANDIDATE', severity: 'warning', hard: false,
    }));
    expect(canonicalSemanticString(before)).toBe(semanticBefore);

    const impossible = impossibleInsideFixture();
    expect(() => solveSpatialIntent({
      document: impossible,
      baseRef: { drawingId: impossible.id, revision: 1 },
      parts: { moving: target('moving'), reference: target('reference') },
      intent: {
        summary: 'put a larger part inside a smaller one',
        goals: [{ kind: 'topology', subject: 'moving', reference: { kind: 'part', partKey: 'reference' }, relation: 'inside' }],
        preserve: [],
      },
      numericConstraints: [], ports,
    })).toThrow('EDIT_SPATIAL_NO_SOLUTION');
  });

  it('returns an already-satisfied terminal instead of inventing motion for a satisfied topology goal', () => {
    const document = topologyFixture('does_not_cross');
    const moving = document.geometry[0];
    if (!moving || moving.type !== 'line') throw new Error('missing moving line');
    moving.start = [-20, 0];
    moving.end = [-10, 0];

    expect(() => solveSpatialIntent({
      document,
      baseRef: { drawingId: document.id, revision: 1 },
      parts: { moving: target('moving'), reference: target('reference') },
      intent: {
        summary: 'keep the paths from crossing',
        goals: [{
          kind: 'topology', subject: 'moving',
          reference: { kind: 'part', partKey: 'reference' }, relation: 'does_not_cross',
        }],
        preserve: [],
      },
      numericConstraints: [], ports,
    })).toThrow('EDIT_SPATIAL_ALREADY_SATISFIED');
  });
});

function topologyFixture(relation: 'touches' | 'crosses' | 'does_not_cross' | 'inside'): DrawingDocument {
  const lineRelation = relation === 'crosses' || relation === 'does_not_cross';
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0', id: `drawing-${relation}` as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 }, unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: lineRelation ? [
      {
        id: 'moving' as GeometryId, type: 'line',
        start: relation === 'does_not_cross' ? [-5, 0] : [-20, 0],
        end: relation === 'does_not_cross' ? [5, 0] : [-10, 0],
        visible: true, quality,
      },
      {
        id: 'reference' as GeometryId, type: 'line',
        start: [relation === 'does_not_cross' ? 0 : 10, -8],
        end: [relation === 'does_not_cross' ? 0 : 10, 8],
        visible: true, quality,
      },
    ] : [
      { id: 'moving' as GeometryId, type: 'circle', center: [-20, 0], radius: relation === 'inside' ? 3 : 5, visible: true, quality },
      { id: 'reference' as GeometryId, type: 'circle', center: [10, 0], radius: relation === 'inside' ? 12 : 5, visible: true, quality },
    ],
    annotations: [], relations: [], features: [],
  };
}

function collisionFixture(): DrawingDocument {
  const document = topologyFixture('touches');
  document.id = 'drawing-collision' as DrawingDocument['id'];
  document.geometry = [
    { id: 'moving' as GeometryId, type: 'circle', center: [0, 0], radius: 4, visible: true, quality },
    { id: 'obstacle' as GeometryId, type: 'circle', center: [20, 0], radius: 5, visible: true, quality },
  ];
  return document;
}

function impossibleInsideFixture(): DrawingDocument {
  const document = topologyFixture('inside');
  const moving = document.geometry[0];
  const reference = document.geometry[1];
  if (moving?.type === 'circle') moving.radius = 10;
  if (reference?.type === 'circle') reference.radius = 2;
  return document;
}

function checksum(value: string): number {
  let result = 0;
  for (const character of value) result = (result * 31 + character.charCodeAt(0)) >>> 0;
  return result;
}
