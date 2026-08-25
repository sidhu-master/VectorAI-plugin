// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument, DrawingId } from './types';

export interface IdFactory {
  next(
    kind:
      | 'drawing'
      | 'geometry'
      | 'annotation'
      | 'relation'
      | 'feature'
      | 'transaction'
      | 'revision'
      | 'commit',
  ): string;
}

export const randomIdFactory: IdFactory = {
  next: (kind) => `${kind}_${globalThis.crypto.randomUUID()}`,
};

export function createEmptyDrawing(input: {
  unit?: 'mm' | 'cm' | 'm';
  idFactory?: IdFactory;
  now?: () => number;
} = {}): DrawingDocument {
  const idFactory = input.idFactory ?? randomIdFactory;
  const now = (input.now ?? Date.now)();

  return {
    protocol: 'VectorAI-Drawing',
    schemaVersion: '1.0',
    id: idFactory.next('drawing') as DrawingId,
    metadata: { createdAt: now, updatedAt: now },
    unitSystem: { length: input.unit ?? 'mm', angle: 'deg' },
    sources: [],
    coordinateFrames: [
      {
        id: 'frame_document',
        kind: 'document',
        transform: [1, 0, 0, 1, 0, 0],
      },
    ],
    geometry: [],
    annotations: [],
    relations: [],
    features: [],
  };
}
