import { describe, expect, it } from 'vitest';

import { createEmptyDrawing } from './create';

describe('@vectorai/drawing-core document', () => {
  it('creates a deterministic empty VectorAI Drawing document', () => {
    const document = createEmptyDrawing({
      unit: 'cm',
      idFactory: { next: () => 'drawing_package' },
      now: () => 42,
    });

    expect(document).toEqual({
      protocol: 'VectorAI-Drawing',
      schemaVersion: '1.0',
      id: 'drawing_package',
      metadata: { createdAt: 42, updatedAt: 42 },
      unitSystem: { length: 'cm', angle: 'deg' },
      sources: [],
      coordinateFrames: [{
        id: 'frame_document',
        kind: 'document',
        transform: [1, 0, 0, 1, 0, 0],
      }],
      geometry: [],
      annotations: [],
      relations: [],
      features: [],
    });
  });
});
