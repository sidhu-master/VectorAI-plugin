import type { DrawingResponseSchema } from '../ai-gateway.js';

const STRING = { type: 'string', minLength: 1 } as const;
const NUMBER = { type: 'number' } as const;
const CONFIDENCE = { type: 'number', minimum: 0, maximum: 1 } as const;
const VEC2 = {
  type: 'array', items: NUMBER, minItems: 2, maxItems: 2,
} as const;
const BOUNDS = {
  type: 'object', additionalProperties: false,
  required: ['minX', 'minY', 'maxX', 'maxY'],
  properties: { minX: NUMBER, minY: NUMBER, maxX: NUMBER, maxY: NUMBER },
} as const;
const STRING_ARRAY = { type: 'array', items: STRING } as const;

const NORMALIZED_COORDINATE = {
  type: 'number', minimum: 0, maximum: 1,
} as const;
const NORMALIZED_POINT = {
  type: 'array',
  items: NORMALIZED_COORDINATE,
  minItems: 2,
  maxItems: 2,
} as const;
const NORMALIZED_POLYGON = {
  type: 'array',
  minItems: 3,
  items: NORMALIZED_POINT,
} as const;

export const SEMANTIC_REGION_RESPONSE_SCHEMA: DrawingResponseSchema = {
  name: 'drawing_semantic_region',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'label', 'sourceViewId', 'contours', 'holes', 'anchors', 'confidence', 'evidenceRefs',
    ],
    properties: {
      label: STRING,
      sourceViewId: STRING,
      contours: { type: 'array', minItems: 1, items: NORMALIZED_POLYGON },
      holes: { type: 'array', items: NORMALIZED_POLYGON },
      anchors: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'role', 'point', 'confidence'],
          properties: {
            id: STRING,
            role: STRING,
            point: NORMALIZED_POINT,
            confidence: CONFIDENCE,
          },
        },
      },
      confidence: CONFIDENCE,
      evidenceRefs: STRING_ARRAY,
    },
  },
};

const SPATIAL_EDIT_MODES = [
  'geometric-edit', 'generative-redraw', 'hybrid-edit',
] as const;

export const SPATIAL_STRATEGY_RESPONSE_SCHEMA: DrawingResponseSchema = {
  name: 'drawing_spatial_edit_strategy',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'mode', 'regionId', 'preserveRegionIds', 'boundaryAnchorIds',
      'requiredGuarantees', 'primaryReason',
    ],
    properties: {
      mode: { type: 'string', enum: SPATIAL_EDIT_MODES },
      regionId: STRING,
      preserveRegionIds: STRING_ARRAY,
      boundaryAnchorIds: STRING_ARRAY,
      requiredGuarantees: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'outside-region-unchanged',
            'protected-region-unchanged',
            'maintain-connectivity',
            'preserve-analytic-geometry',
            'avoid-visible-seams',
          ],
        },
      },
      primaryReason: STRING,
      fallbackMode: { type: 'string', enum: SPATIAL_EDIT_MODES },
    },
  },
};

const SPATIAL_TRANSFORM = {
  oneOf: [
    {
      type: 'object', additionalProperties: false, required: ['kind', 'offset'],
      properties: { kind: { const: 'translate' }, offset: VEC2 },
    },
    {
      type: 'object', additionalProperties: false,
      required: ['kind', 'center', 'angleDegrees'],
      properties: { kind: { const: 'rotate' }, center: VEC2, angleDegrees: NUMBER },
    },
    {
      type: 'object', additionalProperties: false, required: ['kind', 'center', 'factor'],
      properties: { kind: { const: 'scale' }, center: VEC2, factor: NUMBER },
    },
  ],
} as const;

export const SPATIAL_EDIT_DESIGN_RESPONSE_SCHEMA: DrawingResponseSchema = {
  name: 'drawing_spatial_edit_design',
  schema: {
    oneOf: [
      {
        type: 'object', additionalProperties: false,
        required: ['kind', 'transform', 'confidence', 'evidenceRefs'],
        properties: {
          kind: { const: 'transform' },
          transform: SPATIAL_TRANSFORM,
          confidence: CONFIDENCE,
          evidenceRefs: STRING_ARRAY,
        },
      },
      {
        type: 'object', additionalProperties: false,
        required: ['kind', 'geometry', 'confidence', 'evidenceRefs'],
        properties: {
          kind: { const: 'replacement' },
          geometry: { type: 'array', minItems: 1, items: { type: 'object' } },
          confidence: CONFIDENCE,
          evidenceRefs: STRING_ARRAY,
        },
      },
    ],
  },
};

const SELECTOR = {
  type: 'object', additionalProperties: false,
  properties: {
    plane: { type: 'string', enum: ['geometry', 'annotation', 'relation', 'feature'] },
    ids: STRING_ARRAY, types: STRING_ARRAY,
    qualityStatus: { type: 'string', enum: ['confirmed', 'candidate'] },
    bounds: BOUNDS, relationKind: STRING,
    limit: { type: 'integer', minimum: 1 },
  },
} as const;

const ASSERTION = {
  oneOf: [
    {
      type: 'object', additionalProperties: false, required: ['type', 'nodeId'],
      properties: {
        type: { type: 'string', enum: ['node.exists', 'node.absent'] }, nodeId: STRING,
      },
    },
    {
      type: 'object', additionalProperties: false,
      required: ['type', 'nodeId', 'path', 'value'],
      properties: {
        type: { const: 'property.equals' }, nodeId: STRING, path: STRING, value: {},
      },
    },
    {
      type: 'object', additionalProperties: false, required: ['type'],
      properties: { type: { const: 'document.valid' } },
    },
    {
      type: 'object', additionalProperties: false,
      required: ['type', 'selector', 'equals'],
      properties: {
        type: { const: 'selection.count' }, selector: SELECTOR,
        equals: { type: 'integer', minimum: 0 },
      },
    },
    {
      type: 'object', additionalProperties: false,
      required: ['type', 'selector', 'min'],
      properties: {
        type: { const: 'selection.count' }, selector: SELECTOR,
        min: { type: 'integer', minimum: 0 },
      },
    },
  ],
} as const;

export const PLANNER_RESPONSE_SCHEMA: DrawingResponseSchema = {
  name: 'drawing_agent_plan',
  schema: {
    type: 'object', additionalProperties: false, required: ['goal', 'workflow', 'summary'],
    properties: {
      goal: {
        type: 'object', additionalProperties: false,
        required: ['id', 'objective', 'scope', 'acceptanceCriteria', 'riskPolicy'],
        properties: {
          id: STRING, objective: STRING, scope: SELECTOR,
          acceptanceCriteria: { type: 'array', minItems: 1, items: ASSERTION },
          riskPolicy: {
            type: 'object', additionalProperties: false,
            required: ['candidateAllowed', 'maxCommits'],
            properties: {
              candidateAllowed: { type: 'boolean' },
              maxCommits: { type: 'integer', minimum: 1 },
            },
          },
        },
      },
      workflow: {
        type: 'array', minItems: 1,
        items: {
          type: 'object', additionalProperties: false,
          required: ['id', 'capability', 'dependsOn', 'completionCriteria', 'status'],
          properties: {
            id: STRING,
            capability: {
              type: 'string',
              enum: ['query_entities', 'inspect_entity', 'edit_entities', 'verify_goal'],
            },
            dependsOn: STRING_ARRAY,
            completionCriteria: { type: 'array', items: ASSERTION },
            status: { const: 'pending' },
          },
        },
      },
      summary: STRING,
    },
  },
};

export function decisionResponseSchema(
  capability: 'query_entities' | 'inspect_entity' | 'edit_entities' | 'verify_goal',
): DrawingResponseSchema | undefined {
  if (capability === 'query_entities') return {
    name: 'drawing_agent_decision_query_entities',
    schema: {
      type: 'object', additionalProperties: false,
      required: ['type', 'toolCallId', 'selector'],
      properties: { type: { const: 'query' }, toolCallId: STRING, selector: SELECTOR },
    },
  };
  if (capability === 'inspect_entity') return {
    name: 'drawing_agent_decision_inspect_entity',
    schema: {
      type: 'object', additionalProperties: false,
      required: ['type', 'toolCallId', 'nodeId'],
      properties: { type: { const: 'inspect' }, toolCallId: STRING, nodeId: STRING },
    },
  };
  return undefined;
}
