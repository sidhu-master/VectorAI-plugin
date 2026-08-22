// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument, GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import {
  resolveTranslationMotionRig,
  solveTranslationMotionRig,
  type MotionRigDefinition,
} from './index';

const quality = { status: 'confirmed' as const, evidenceRefs: [] };

function fixture(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing',
    schemaVersion: '1.0',
    id: 'drawing-motion-rig' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'frame', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [
      { id: 'hand' as GeometryId, type: 'circle', center: [20, 20], radius: 3, visible: true, quality },
      { id: 'hand-detail' as GeometryId, type: 'circle', center: [20, 20], radius: 1, visible: true, quality },
      { id: 'arm-line' as GeometryId, type: 'line', start: [0, 20], end: [17, 20], visible: true, quality },
      {
        id: 'arm-polyline' as GeometryId,
        type: 'polyline',
        vertices: [{ point: [0, 10] }, { point: [8, 12] }, { point: [20, 17] }],
        closed: false,
        visible: true,
        quality,
      },
      {
        id: 'arm-spline' as GeometryId,
        type: 'spline', degree: 2,
        controlPoints: [[0, 30], [8, 28], [17, 20]],
        knots: [0, 0, 0, 1, 1, 1], closed: false, periodic: false,
        visible: true,
        quality,
      },
      { id: 'body' as GeometryId, type: 'circle', center: [-10, 20], radius: 8, visible: true, quality },
    ],
    annotations: [], relations: [], features: [],
  };
}

function update(result: ReturnType<typeof solveTranslationMotionRig>, id: string) {
  const command = result.commands.find((candidate) => candidate.type === 'node.update' && candidate.id === id);
  if (!command || command.type !== 'node.update') throw new Error(`Missing update for ${id}`);
  return command;
}

describe('temporary translation motion rig', () => {
  it('resolves one rigid multi-node control body and disconnected connector primitives', () => {
    const rig = resolveTranslationMotionRig(fixture(), ['hand-detail', 'hand']);

    expect(rig.controlBodyNodeIds).toEqual(['hand', 'hand-detail']);
    expect(rig.connectors.map(({ nodeId, movingEndpoint }) => ({ nodeId, movingEndpoint }))).toEqual([
      { nodeId: 'arm-line', movingEndpoint: 'end' },
      { nodeId: 'arm-polyline', movingEndpoint: 'last' },
      { nodeId: 'arm-spline', movingEndpoint: 'last' },
    ]);
    expect(rig.anchor).toEqual([0, 20]);
    expect(rig.handle).toEqual([20, 20]);
    expect(rig).toMatchObject({
      keepAnchorFixed: true,
      keepControlBodyRigid: true,
      preserveConnectivity: true,
      allowControlRotation: false,
    });
  });

  it('fails closed when two selected carriers are equally plausible', () => {
    const document = fixture();
    document.geometry = document.geometry.filter(({ id }) => id === 'hand' || id === 'arm-line');
    document.geometry.push(
      { id: 'other-hand' as GeometryId, type: 'circle', center: [20, 40], radius: 3, visible: true, quality },
      { id: 'other-arm' as GeometryId, type: 'line', start: [0, 40], end: [17, 40], visible: true, quality },
    );

    expect(() => resolveTranslationMotionRig(document, ['hand', 'other-hand'])).toThrow(
      'MOTION_RIG_AMBIGUOUS',
    );
  });

  it('translates the control body without rotation and deforms every connector from its fixed end', () => {
    const document = fixture();
    const rig = resolveTranslationMotionRig(document, ['hand', 'hand-detail']);
    const solved = solveTranslationMotionRig(document, rig, [10, 5]);

    expect(update(solved, 'hand').changes).toEqual({ center: [30, 25] });
    expect(update(solved, 'hand-detail').changes).toEqual({ center: [30, 25] });
    expect(update(solved, 'arm-line').changes).toEqual({ end: [27, 25] });
    expect(update(solved, 'arm-polyline').changes).toEqual({
      vertices: [
        { point: [0, 10] },
        { point: [11.881262007, 13.940631003] },
        { point: [30, 22] },
      ],
    });
    expect(update(solved, 'arm-spline').changes).toEqual({
      controlPoints: [
        [0, 30],
        [12.064614636, 30.032307318],
        [27, 25],
      ],
    });
    expect(solved.candidate.geometry.find(({ id }) => id === 'arm-line')).toMatchObject({
      start: [0, 20], end: [27, 25],
    });
  });

  it('rejects non-finite drag deltas before producing commands', () => {
    const document = fixture();
    const rig = resolveTranslationMotionRig(document, ['hand']);

    expect(() => solveTranslationMotionRig(document, rig, [Number.NaN, 2])).toThrow(
      'MOTION_RIG_DELTA_INVALID',
    );
  });

  it('does not accept an unsupported arc as a connector', () => {
    const document = fixture();
    document.geometry = document.geometry.filter(({ id }) => !String(id).startsWith('arm-'));
    document.geometry.push({
      id: 'arc-arm' as GeometryId,
      type: 'arc', center: [10, 20], radius: 7, startAngle: 0, endAngle: 180,
      counterClockwise: true, visible: true, quality,
    });

    expect(() => resolveTranslationMotionRig(document, ['hand', 'arc-arm'])).toThrow(
      'MOTION_RIG_GEOMETRY_UNSUPPORTED',
    );
  });

  it('rejects a stale rig whose referenced control node no longer exists', () => {
    const document = fixture();
    const rig: MotionRigDefinition = resolveTranslationMotionRig(document, ['hand']);
    document.geometry = document.geometry.filter(({ id }) => id !== 'hand');

    expect(() => solveTranslationMotionRig(document, rig, [1, 1])).toThrow(
      'MOTION_RIG_CONTROL_NODE_MISSING',
    );
  });
});
