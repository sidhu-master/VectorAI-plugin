// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument, GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import {
  applyDrawingTransaction,
  canonicalSemanticString,
  compileMultiPartTransform,
  type GroundedEditTarget,
} from './index';

const quality = { status: 'confirmed' as const, evidenceRefs: [] };

function multiCarrierFixture(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0',
    id: 'drawing-multi' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'frame-document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [
      { id: 'carrier-a' as GeometryId, type: 'circle', center: [-20, 0], radius: 5, visible: true, quality },
      { id: 'connector-a-1' as GeometryId, type: 'line', start: [-15, 0], end: [-5, 4], visible: true, quality },
      { id: 'connector-a-2' as GeometryId, type: 'line', start: [-20, -5], end: [-5, -10], visible: true, quality },
      { id: 'carrier-b' as GeometryId, type: 'circle', center: [20, 0], radius: 5, visible: true, quality },
      { id: 'connector-b-1' as GeometryId, type: 'line', start: [15, 0], end: [5, 4], visible: true, quality },
      { id: 'connector-b-2' as GeometryId, type: 'line', start: [20, -5], end: [5, -10], visible: true, quality },
      { id: 'carrier-c' as GeometryId, type: 'circle', center: [0, 25], radius: 3, visible: true, quality },
      { id: 'unrelated' as GeometryId, type: 'circle', center: [0, 50], radius: 4, visible: true, quality },
    ],
    annotations: [], relations: [], features: [],
  };
}

function target(
  handle: string,
  nodeId: string,
  interfaces: GroundedEditTarget['interfaces'] = [],
): GroundedEditTarget {
  return { targetHandle: handle, targetNodeIds: [nodeId], interfaces, sourceStatus: 'confirmed' };
}

const targetA = target('target-a', 'carrier-a', [
  { interfaceId: 'connector-a-1:start', nodeId: 'connector-a-1', endpoint: 'start' },
  { interfaceId: 'connector-a-2:start', nodeId: 'connector-a-2', endpoint: 'start' },
]);
const targetB = target('target-b', 'carrier-b', [
  { interfaceId: 'connector-b-1:start', nodeId: 'connector-b-1', endpoint: 'start' },
  { interfaceId: 'connector-b-2:start', nodeId: 'connector-b-2', endpoint: 'start' },
]);

const ports = {
  digest: (value: string) => `test:${value.length}:${checksum(value)}`,
  id: (kind: string) => `${kind}-1`,
  now: () => 7,
};

describe('multi-part spatial compiler', () => {
  it('atomically moves independent connected carriers in opposing directions', () => {
    const before = multiCarrierFixture();
    const compiled = compileMultiPartTransform({
      document: before,
      baseRef: { drawingId: before.id, revision: 0 },
      objective: 'Move independent components toward the center',
      summary: 'Two component pose',
      parts: [
        { groundingId: 'ground-a', grounding: targetA, translation: [4, -3] },
        { groundingId: 'ground-b', grounding: targetB, translation: [-4, -3] },
      ],
      ports,
    });

    expect(compiled.actualEffect.updatedNodeIds).toEqual([
      'carrier-a', 'carrier-b',
      'connector-a-1', 'connector-a-2', 'connector-b-1', 'connector-b-2',
    ]);
    expect(compiled.candidate.geometry.find(({ id }) => id === 'carrier-a')).toMatchObject({ center: [-16, -3] });
    expect(compiled.candidate.geometry.find(({ id }) => id === 'carrier-b')).toMatchObject({ center: [16, -3] });
    expect(compiled.candidate.geometry.find(({ id }) => id === 'unrelated')).toEqual(
      before.geometry.find(({ id }) => id === 'unrelated'),
    );

    const restored = applyDrawingTransaction(compiled.candidate, compiled.inverse, 8);
    expect(canonicalSemanticString(restored)).toBe(canonicalSemanticString(before));
  });

  it('supports three generic parts without a domain-specific operation', () => {
    const compiled = compileMultiPartTransform({
      document: multiCarrierFixture(),
      baseRef: { drawingId: 'drawing-multi', revision: 0 },
      objective: 'Reposition three independent components',
      summary: 'Three component pose',
      parts: [
        { groundingId: 'ground-a', grounding: targetA, translation: [1, 0] },
        { groundingId: 'ground-b', grounding: targetB, translation: [-1, 0] },
        { groundingId: 'ground-c', grounding: target('target-c', 'carrier-c'), translation: [0, -2] },
      ],
      ports,
    });

    expect(compiled.candidate.geometry.find(({ id }) => id === 'carrier-c')).toMatchObject({ center: [0, 23] });
    expect(compiled.forward.length).toBeGreaterThanOrEqual(7);
  });

  it('fails closed when grounded target node sets overlap', () => {
    expect(() => compileMultiPartTransform({
      document: multiCarrierFixture(),
      baseRef: { drawingId: 'drawing-multi', revision: 0 },
      objective: 'Invalid overlap', summary: 'Invalid overlap',
      parts: [
        { groundingId: 'ground-a', grounding: targetA, translation: [1, 0] },
        { groundingId: 'ground-b', grounding: target('target-overlap', 'carrier-a'), translation: [-1, 0] },
      ],
      ports,
    })).toThrowError('EDIT_PART_TARGET_OVERLAP');
  });

  it('fails closed when two grounded parts claim the same connector endpoint', () => {
    const shared = {
      interfaceId: 'connector-a-1:start', nodeId: 'connector-a-1', endpoint: 'start' as const,
    };
    expect(() => compileMultiPartTransform({
      document: multiCarrierFixture(),
      baseRef: { drawingId: 'drawing-multi', revision: 0 },
      objective: 'Invalid interface conflict', summary: 'Invalid interface conflict',
      parts: [
        { groundingId: 'ground-a', grounding: target('target-a', 'carrier-a', [shared]), translation: [1, 0] },
        { groundingId: 'ground-b', grounding: target('target-b', 'carrier-b', [shared]), translation: [-1, 0] },
      ],
      ports,
    })).toThrowError('EDIT_PART_INTERFACE_CONFLICT');
  });

  it('rejects a foreign Drawing before compiling any part and never mutates the input', () => {
    const before = multiCarrierFixture();
    const semanticBefore = canonicalSemanticString(before);
    expect(() => compileMultiPartTransform({
      document: before,
      baseRef: { drawingId: 'drawing-foreign', revision: 0 },
      objective: 'Foreign edit', summary: 'Foreign edit',
      parts: [
        { groundingId: 'ground-a', grounding: targetA, translation: [1, 0] },
        { groundingId: 'ground-missing', grounding: target('target-missing', 'missing'), translation: [-1, 0] },
      ],
      ports,
    })).toThrowError('EDIT_DRAWING_MISMATCH');
    expect(canonicalSemanticString(before)).toBe(semanticBefore);
  });

  it('keeps candidate identity deterministic for the same ordered multi-part intent', () => {
    const input = () => ({
      document: multiCarrierFixture(),
      baseRef: { drawingId: 'drawing-multi', revision: 0 },
      objective: 'Move components', summary: 'Display text does not control identity',
      parts: [
        { groundingId: 'ground-a', grounding: targetA, translation: [2, -1] as [number, number] },
        { groundingId: 'ground-b', grounding: targetB, translation: [-2, -1] as [number, number] },
      ],
      ports,
    });
    expect(compileMultiPartTransform(input()).candidateDigest).toBe(
      compileMultiPartTransform(input()).candidateDigest,
    );
  });
});

function checksum(value: string): number {
  let result = 0;
  for (const character of value) result = (result * 31 + character.charCodeAt(0)) >>> 0;
  return result;
}
