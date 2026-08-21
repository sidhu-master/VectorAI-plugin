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

  it('rejects a forced collision and an impossible containment without a partial candidate', () => {
    const before = collisionFixture();
    const semanticBefore = canonicalSemanticString(before);
    expect(() => solveSpatialIntent({
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
    })).toThrow('EDIT_SPATIAL_NO_SOLUTION');
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
