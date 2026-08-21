// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument, GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import { compileConnectedTransform } from './index';

const quality = { status: 'confirmed' as const, evidenceRefs: [] };

function genericCarrierFixture(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing',
    schemaVersion: '1.0',
    id: 'drawing-connected-parity' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{
      id: 'frame_document', kind: 'document', transform: [1, 0, 0, 1, 0, 0],
    }],
    geometry: [
      {
        id: 'carrier' as GeometryId, type: 'circle', center: [0, 0], radius: 10,
        visible: true, quality,
      },
      {
        id: 'connector-upper' as GeometryId, type: 'line', start: [10, 0], end: [25, 8],
        visible: true, quality,
      },
      {
        id: 'connector-lower' as GeometryId, type: 'line', start: [0, -10], end: [20, -25],
        visible: true, quality,
      },
      {
        id: 'nearby-not-contacting' as GeometryId, type: 'line', start: [12.1, 0], end: [30, 0],
        visible: true, quality,
      },
      {
        id: 'opposite-end-nearby' as GeometryId, type: 'line', start: [-25, 0], end: [-12.1, 0],
        visible: true, quality,
      },
      {
        id: 'unrelated' as GeometryId, type: 'circle', center: [80, 80], radius: 5,
        visible: true, quality,
      },
    ],
    annotations: [], relations: [], features: [],
  };
}

describe('connected transform production parity', () => {
  it('moves only true contacted endpoint slots and chooses minimum-deformation orientation', () => {
    const document = genericCarrierFixture();

    const result = compileConnectedTransform({
      document,
      carrierNodeId: 'carrier',
      targetCenter: [15, 20],
    });

    expect(result.audit.orientationMode).toBe('minimum-deformation');
    expect(result.audit.connectorNodeIds).toEqual(['connector-lower', 'connector-upper']);
    expect(result.audit.ports.map(({ connectorNodeId, endpointRole }) => (
      `${connectorNodeId}:${endpointRole}`
    ))).toEqual(['connector-lower:start', 'connector-upper:start']);
    expect(result.commands.map((command) => 'id' in command ? command.id : command.node.id)).toEqual([
      'carrier', 'connector-lower', 'connector-upper',
    ]);
    expect(result.commands).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'nearby-not-contacting' }),
      expect.objectContaining({ id: 'opposite-end-nearby' }),
      expect.objectContaining({ id: 'unrelated' }),
    ]));
    expect(result.audit.rotationDegrees).not.toBe(0);
  });
});
