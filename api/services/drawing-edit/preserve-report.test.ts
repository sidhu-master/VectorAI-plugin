import { describe, expect, it } from 'vitest';

import type { DrawingDocument, GeometryId } from '../../../src/drawing/index.js';
import { comparePreservedNodes } from './preserve-report.js';

describe('comparePreservedNodes', () => {
  it('reports changed and missing protected nodes independently', () => {
    const before = documentWith(5, true);
    const after = documentWith(6, false);

    expect(comparePreservedNodes(before, after, ['body', 'label'])).toEqual({
      satisfied: false,
      changedNodeIds: ['body'],
      missingNodeIds: ['label'],
    });
  });
});

function documentWith(radius: number, label: boolean): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0',
    id: 'drawing_preserve' as DrawingDocument['id'], metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [{
      id: 'body' as GeometryId, type: 'circle', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] }, center: [0, 0], radius,
    }],
    annotations: label ? [{
      id: 'label' as DrawingDocument['annotations'][number]['id'], type: 'text', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] }, content: 'body', position: [0, 0],
      height: 2, rotation: 0, alignment: 'left', verticalAlignment: 'baseline',
    }] : [],
    relations: [], features: [],
  };
}
