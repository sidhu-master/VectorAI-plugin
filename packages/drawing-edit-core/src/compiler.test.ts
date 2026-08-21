// SPDX-License-Identifier: Apache-2.0

import type {
  DrawingDocument,
  GeometryId,
} from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import {
  applyDrawingTransaction,
  canonicalSemanticString,
  compileSpatialEditProgram,
  invertDrawingTransaction,
} from './index';

const quality = { status: 'confirmed' as const, evidenceRefs: [] };

function wavingFixture(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing',
    schemaVersion: '1.0',
    id: 'drawing-wave' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'frame_document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [
      { id: 'body' as GeometryId, type: 'circle', center: [0, 0], radius: 10, visible: true, quality },
      { id: 'right-hand' as GeometryId, type: 'circle', center: [15, 0], radius: 3, visible: true, quality },
      { id: 'right-arm-top' as GeometryId, type: 'line', start: [9, 2], end: [12.316718427, 1.341640786], visible: true, quality },
      { id: 'right-arm-bottom' as GeometryId, type: 'line', start: [9, -2], end: [12.316718427, -1.341640786], visible: true, quality },
      { id: 'left-hand' as GeometryId, type: 'circle', center: [-15, 0], radius: 3, visible: true, quality },
    ],
    annotations: [],
    relations: [],
    features: [],
  };
}

const ports = {
  digest: (value: string) => `test:${value.length}:${checksum(value)}`,
  id: (kind: string) => `${kind}-1`,
  now: () => 10,
};

describe('@vectorai/drawing-edit-core compiler', () => {
  it('compiles the right-hand connected transform without moving unrelated geometry', () => {
    const before = wavingFixture();
    const compiled = compileSpatialEditProgram({
      document: before,
      program: {
        baseRef: { drawingId: 'drawing-wave', revision: 0 },
        targetHandle: 'target:right-hand',
        summary: 'Raise the right hand',
        objective: '把右手抬起来打招呼',
        operations: [{
          kind: 'connected_transform',
          translation: [-3, 11],
          rotationRadians: -Math.PI / 3,
          pivot: [15, 0],
          interfaceIds: ['right-arm-top:end', 'right-arm-bottom:end'],
        }],
        preserveScopes: [{ kind: 'node-field', nodeId: 'left-hand', fields: ['center'] }],
        postconditions: [{ kind: 'within_bounds', bounds: { minX: -30, minY: -20, maxX: 30, maxY: 30 } }],
        evidenceRefs: ['evidence:right-hand'],
      },
      grounding: {
        targetHandle: 'target:right-hand',
        targetNodeIds: ['right-hand'],
        interfaces: [
          { interfaceId: 'right-arm-top:end', nodeId: 'right-arm-top', endpoint: 'end' },
          { interfaceId: 'right-arm-bottom:end', nodeId: 'right-arm-bottom', endpoint: 'end' },
        ],
        sourceStatus: 'confirmed',
      },
      ports,
    });

    expect(compiled.actualEffect.updatedNodeIds).toEqual([
      'right-arm-bottom',
      'right-arm-top',
      'right-hand',
    ]);
    expect(compiled.candidate.geometry.find(({ id }) => id === 'left-hand')).toEqual(
      before.geometry.find(({ id }) => id === 'left-hand'),
    );
    expect(compiled.candidate.geometry.find(({ id }) => id === 'right-hand')).toMatchObject({
      center: [12, 11],
    });
    expect(compiled.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      'CONNECTED_INTERFACE_ORIENTATION_INVERTED',
      'CONNECTED_INTERFACE_EXCESSIVE_STRETCH',
    ]));
    expect(compiled.forward).toHaveLength(3);
    expect(compiled.inverse).toHaveLength(3);
  });

  it('round-trips forward and inverse commands across all four document planes', () => {
    const before = wavingFixture();
    const forward = [{
      type: 'node.update' as const,
      id: 'right-hand',
      changes: { center: [14, 5] },
      expected: { center: [15, 0] },
    }];
    const inverse = invertDrawingTransaction(before, forward);
    const changed = applyDrawingTransaction(before, forward, 9);
    const restored = applyDrawingTransaction(changed, inverse, 10);

    expect(canonicalSemanticString(restored)).toBe(canonicalSemanticString(before));
  });

  it('merges disjoint endpoint updates when both ends of one connector follow the target', () => {
    const before = wavingFixture();
    before.geometry = before.geometry.filter(({ id }) => (
      id !== 'right-arm-top' && id !== 'right-arm-bottom'
    ));
    before.geometry.push({
      id: 'hand-detail' as GeometryId,
      type: 'line', start: [12, 0], end: [18, 0], visible: true, quality,
    });
    const compiled = compileSpatialEditProgram({
      document: before,
      program: {
        baseRef: { drawingId: 'drawing-wave', revision: 0 },
        targetHandle: 'target:right-hand',
        summary: 'Raise the hand and its internal detail',
        objective: '抬手',
        operations: [{
          kind: 'connected_transform', translation: [0, 5], rotationRadians: 0,
          pivot: [15, 0], interfaceIds: ['hand-detail:start', 'hand-detail:end'],
        }],
        preserveScopes: [], postconditions: [], evidenceRefs: ['evidence:right-hand'],
      },
      grounding: {
        targetHandle: 'target:right-hand', targetNodeIds: ['right-hand'],
        interfaces: [
          { interfaceId: 'hand-detail:start', nodeId: 'hand-detail', endpoint: 'start' },
          { interfaceId: 'hand-detail:end', nodeId: 'hand-detail', endpoint: 'end' },
        ],
        sourceStatus: 'confirmed',
      },
      ports,
    });

    expect(compiled.forward).toHaveLength(2);
    expect(compiled.candidate.geometry.find(({ id }) => id === 'hand-detail')).toMatchObject({
      start: [12, 5], end: [18, 5],
    });
  });

  it('keeps semantic candidate identity independent from timestamps and summaries', () => {
    const first = wavingFixture();
    const second = wavingFixture();
    second.metadata.updatedAt = 999;

    expect(canonicalSemanticString(second)).toBe(canonicalSemanticString(first));
  });

  it('fails closed when a preserve scope is modified', () => {
    expect(() => compileSpatialEditProgram({
      document: wavingFixture(),
      program: {
        baseRef: { drawingId: 'drawing-wave', revision: 0 },
        targetHandle: 'target:right-hand',
        summary: 'Move hand',
        objective: 'Move hand',
        operations: [{ kind: 'rigid_transform', translation: [1, 0], rotationRadians: 0, pivot: [15, 0] }],
        preserveScopes: [{ kind: 'node-field', nodeId: 'right-hand', fields: ['center'] }],
        postconditions: [],
        evidenceRefs: ['evidence:right-hand'],
      },
      grounding: {
        targetHandle: 'target:right-hand',
        targetNodeIds: ['right-hand'],
        interfaces: [],
        sourceStatus: 'confirmed',
      },
      ports,
    })).toThrowError('EDIT_PRESERVE_SCOPE_CHANGED');
  });
});

function checksum(value: string): number {
  let result = 0;
  for (const character of value) result = (result * 31 + character.charCodeAt(0)) >>> 0;
  return result;
}
