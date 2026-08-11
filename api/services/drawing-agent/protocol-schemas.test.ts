import { describe, expect, it } from 'vitest';

import {
  FRAGMENT_SELECTION_RESPONSE_SCHEMA,
  SEMANTIC_REGION_RESPONSE_SCHEMA,
  SPATIAL_STRATEGY_RESPONSE_SCHEMA,
} from './protocol-schemas';

describe('region-first response schemas', () => {
  it('requires contour-based region fields and does not expose node selection', () => {
    const schema = SEMANTIC_REGION_RESPONSE_SCHEMA.schema;
    const serialized = JSON.stringify(schema);

    expect(schema).toMatchObject({ type: 'object', additionalProperties: false });
    expect(serialized).toContain('sourceViewId');
    expect(serialized).toContain('contours');
    expect(serialized).not.toContain('targetNodeIds');
    expect(serialized).not.toContain('nodeIds');
  });

  it('keeps strategy choice internal and strictly enumerated', () => {
    expect(SPATIAL_STRATEGY_RESPONSE_SCHEMA.schema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      properties: {
        mode: {
          type: 'string',
          enum: ['geometric-edit', 'generative-redraw', 'hybrid-edit'],
        },
      },
    });
  });

  it('requires exact fragment ids, anchors, evidence, and confidence', () => {
    expect(FRAGMENT_SELECTION_RESPONSE_SCHEMA).toMatchObject({
      name: 'drawing_fragment_selection',
      schema: {
        type: 'object', additionalProperties: false,
        required: ['editableFragmentIds', 'anchorIds', 'evidence', 'confidence'],
      },
    });
    expect(JSON.stringify(FRAGMENT_SELECTION_RESPONSE_SCHEMA.schema))
      .not.toContain('"minItems":1,"items":{"type":"string"');
  });
});
