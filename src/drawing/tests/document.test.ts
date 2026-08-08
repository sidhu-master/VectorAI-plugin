import { describe, expect, it } from 'vitest';

import { createEmptyDrawing } from '../document/create';

describe('createEmptyDrawing', () => {
  it('creates an empty VectorAI-Drawing 1.0 document with four planes', () => {
    const document = createEmptyDrawing({
      unit: 'mm',
      idFactory: { next: () => 'drawing_fixed' },
      now: () => 100,
    });

    expect(document).toEqual({
      protocol: 'VectorAI-Drawing',
      schemaVersion: '1.0',
      id: 'drawing_fixed',
      metadata: { createdAt: 100, updatedAt: 100 },
      unitSystem: { length: 'mm', angle: 'deg' },
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
    });
  });
});
