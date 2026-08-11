import { describe, expect, it } from 'vitest';

import {
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
});
