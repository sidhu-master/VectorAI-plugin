import { describe, expect, it } from 'vitest';

import {
  SEMANTIC_REGION_RESPONSE_SCHEMA,
  SPATIAL_STRATEGY_RESPONSE_SCHEMA,
} from './protocol-schemas';

describe('topology-grounded response schemas', () => {
  it('requires operation, edit mode, envelope, and generic anchors without node selection', () => {
    const schema = SEMANTIC_REGION_RESPONSE_SCHEMA.schema;
    const serialized = JSON.stringify(schema);

    expect(schema).toMatchObject({ type: 'object', additionalProperties: false });
    expect(serialized).toContain('sourceViewId');
    expect(serialized).toContain('contours');
    expect(serialized).toContain('modify-existing');
    expect(serialized).toContain('target-seed');
    expect(serialized).toContain('protected-seed');
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

  it('does not expose a second fragment-selection response contract', () => {
    expect(JSON.stringify(SEMANTIC_REGION_RESPONSE_SCHEMA.schema)).not.toContain('fragmentId');
    expect(JSON.stringify(SEMANTIC_REGION_RESPONSE_SCHEMA.schema)).not.toContain('editableFragmentIds');
  });
});
