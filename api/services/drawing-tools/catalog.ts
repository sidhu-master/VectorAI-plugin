const schema = (
  required: string[],
  properties: Record<string, unknown>,
  optional: string[] = [],
) => ({
  type: 'object',
  additionalProperties: false,
  required,
  properties: Object.fromEntries([...required, ...optional].map((key) => [key, properties[key]])),
});

const schemaRef = (name: string) => ({ $ref: `#/$defs/${name}` });

const schemaWithDefs = (
  required: string[],
  properties: Record<string, unknown>,
  optional: string[],
  definitions: Record<string, unknown>,
) => ({ ...schema(required, properties, optional), $defs: definitions });

const point = { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number' } };
const translationDelta = {
  oneOf: [
    point,
    schema(['x', 'y'], { x: { type: 'number' }, y: { type: 'number' } }),
  ],
};
const stringArray = { type: 'array', items: { type: 'string' } };
const spatialRefArray = { type: 'array', maxItems: 128, items: { type: 'string' } };
const drawingNode = {
  type: 'object',
  required: ['type', 'visible', 'quality'],
  properties: {
    id: { type: 'string' },
    type: { type: 'string' },
    visible: { type: 'boolean' },
    quality: { type: 'object' },
  },
};
const drawingCommand = {
  oneOf: [
    ...(['geometry', 'annotation', 'relation', 'feature'] as const).map((plane) => (
      schema(['type', 'value'], {
        type: { const: `${plane}.create` }, value: schemaRef('drawingNode'),
      })
    )),
    ...(['geometry', 'annotation', 'relation', 'feature'] as const).flatMap((plane) => [
      schema(['type', 'id', 'changes'], {
        type: { const: `${plane}.update` }, id: { type: 'string' },
        changes: { type: 'object', minProperties: 1 }, expected: { type: 'object' },
      }, ['expected']),
      schema(['type', 'id'], { type: { const: `${plane}.delete` }, id: { type: 'string' } }),
    ]),
  ],
};
const selector = schema([], {
  plane: { enum: ['geometry', 'annotation', 'relation', 'feature'] },
  ids: stringArray, types: stringArray,
  qualityStatus: { enum: ['confirmed', 'candidate'] },
  bounds: schema(['minX', 'minY', 'maxX', 'maxY'], {
    minX: { type: 'number' }, minY: { type: 'number' },
    maxX: { type: 'number' }, maxY: { type: 'number' },
  }),
  relationKind: { type: 'string' }, limit: { type: 'integer', minimum: 1 },
}, ['plane', 'ids', 'types', 'qualityStatus', 'bounds', 'relationKind', 'limit']);
const drawingAssertion = {
  oneOf: [
    ...(['node.exists', 'node.absent'] as const).map((type) => schema(['type', 'nodeId'], {
      type: { const: type }, nodeId: { type: 'string' },
    })),
    schema(['type', 'nodeId', 'path', 'value'], {
      type: { const: 'property.equals' }, nodeId: { type: 'string' },
      path: { type: 'string' }, value: {},
    }),
    schema(['type'], { type: { const: 'document.valid' } }),
    schema(['type', 'selector', 'equals'], {
      type: { const: 'selection.count' }, selector: schemaRef('drawingSelector'),
      equals: { type: 'integer', minimum: 0 },
    }),
    schema(['type', 'selector', 'min'], {
      type: { const: 'selection.count' }, selector: schemaRef('drawingSelector'),
      min: { type: 'integer', minimum: 0 },
    }),
  ],
};
const drawingSchemaDefinitions = {
  drawingNode,
  drawingSelector: selector,
  drawingCommand,
  drawingAssertion,
};
const spatialPointRef = {
  oneOf: [
    schema(['kind', 'observationId', 'normalized'], {
      kind: { const: 'observation' }, observationId: { type: 'string' },
      normalized: {
        type: 'array', minItems: 2, maxItems: 2,
        items: { type: 'number', minimum: 0, maximum: 1 },
      },
    }),
    schema(['kind', 'frameId', 'point'], {
      kind: { const: 'world' }, frameId: { type: 'string' }, point,
    }),
    schema(['kind', 'nodeId', 'anchor'], {
      kind: { const: 'node_anchor' }, nodeId: { type: 'string' },
      anchor: { enum: ['center', 'start', 'end', 'vertex'] },
      index: { type: 'integer', minimum: 0 },
    }, ['index']),
  ],
};
const spatialOperation = {
  oneOf: [
    {
      ...schema(['kind', 'nodeIds'], {
        kind: { const: 'translate' }, nodeIds: spatialRefArray,
        from: schemaRef('spatialPointRef'), to: schemaRef('spatialPointRef'),
        delta: translationDelta,
      }, ['from', 'to', 'delta']),
      anyOf: [{ required: ['delta'] }, { required: ['from', 'to'] }],
    },
    schema(['kind', 'nodeId', 'endpoint', 'point'], {
      kind: { const: 'set_endpoint' }, nodeId: { type: 'string' },
      endpoint: { enum: ['start', 'end'] }, point: schemaRef('spatialPointRef'),
    }),
    schema(['kind', 'geometry', 'points'], {
      kind: { const: 'create_path' }, geometry: { enum: ['line', 'polyline'] },
      points: {
        type: 'array', minItems: 2, maxItems: 256, items: schemaRef('spatialPointRef'),
      },
      nodeId: { type: 'string' }, closed: { type: 'boolean' },
    }, ['nodeId', 'closed']),
    schema(['kind', 'nodeIds'], {
      kind: { const: 'delete_nodes' }, nodeIds: spatialRefArray,
    }),
  ],
};
const spatialPostcondition = {
  oneOf: [
    schema(['kind', 'anchor', 'point'], {
      kind: { const: 'anchor_at' },
      anchor: schemaRef('spatialPointRef'), point: schemaRef('spatialPointRef'),
      toleranceRatio: { type: 'number', exclusiveMinimum: 0, maximum: 0.1 },
    }, ['toleranceRatio']),
    schema(['kind', 'first', 'second'], {
      kind: { const: 'anchors_coincident' },
      first: schemaRef('spatialPointRef'), second: schemaRef('spatialPointRef'),
      toleranceRatio: { type: 'number', exclusiveMinimum: 0, maximum: 0.1 },
    }, ['toleranceRatio']),
    schema(['kind', 'nodeIds'], {
      kind: { const: 'nodes_unchanged' }, nodeIds: spatialRefArray,
    }),
    schema(['kind', 'nodeId'], {
      kind: { const: 'path_closed' }, nodeId: { type: 'string' },
    }),
  ],
};
const spatialSchemaDefinitions = {
  spatialPointRef,
  spatialOperation,
  spatialPostcondition,
};

export const MODEL_DRAWING_TOOL_GUIDES: Record<
  string,
  { description: string; inputSchema: Record<string, unknown> }
> = {
  render_drawing: {
    description: 'Render current Drawing IR as overview, focus, viewport, or all views. Use selectedIds only as visual focus, never as write authorization.',
    inputSchema: schema(['view'], {
      view: { enum: ['overview', 'focus', 'viewport', 'all'] },
      selectedIds: stringArray,
      includeAnnotations: { type: 'boolean' },
      viewport: schema(['scale', 'offsetX', 'offsetY', 'width', 'height'], {
        scale: { type: 'number' }, offsetX: { type: 'number' }, offsetY: { type: 'number' },
        width: { type: 'number' }, height: { type: 'number' },
      }),
    }, ['selectedIds', 'includeAnnotations', 'viewport']),
  },
  query_nodes: {
    description: 'Query canonical Drawing IR nodes using a DrawingSelector.',
    inputSchema: schema(['selector'], { selector: { type: 'object' } }),
  },
  inspect_nodes: {
    description: 'Inspect exact Drawing IR nodes and their referenced relations/features.',
    inputSchema: schema(['nodeIds'], { nodeIds: stringArray }),
  },
  measure_geometry: {
    description: 'Measure distance, angle, bounds, closure, intersections, or nearest point in world coordinates.',
    inputSchema: schema(['measurements'], {
      measurements: { type: 'array', minItems: 1, items: { type: 'object' } },
    }),
  },
  inspect_source_overview: {
    description: 'Inspect a stored raster source with server-bounded CV and return page size, foreground bounds, and component count.',
    inputSchema: schema(['sourceId'], { sourceId: { type: 'string' } }),
  },
  create_observation_region: {
    description: 'Create one model-chosen source-pixel region for CV inspection. Regions may overlap and are evidence scopes, never edit authorization.',
    inputSchema: schema([
      'sourceId', 'regionId', 'bounds', 'purpose', 'targetSlotIds', 'resolutionLevel', 'attempt',
    ], {
      sourceId: { type: 'string' }, regionId: { type: 'string' }, bounds: { type: 'object' },
      purpose: { enum: ['inventory', 'geometry', 'topology', 'annotation', 'verification'] },
      targetSlotIds: stringArray, resolutionLevel: { type: 'integer' }, attempt: { type: 'integer' },
      parentRegionId: { type: 'string' },
    }, ['parentRegionId']),
  },
  inspect_source_crop: {
    description: 'Create a bounded crop handle for a previously created observation region without putting media bytes in tool results.',
    inputSchema: schema(['sourceId', 'regionId'], {
      sourceId: { type: 'string' }, regionId: { type: 'string' },
    }),
  },
  extract_cv_evidence: {
    description: 'Extract bounded line/curve/endpoint evidence and suggested primitive fits from one model-chosen observation region.',
    inputSchema: schema(['sourceId', 'regionId'], {
      sourceId: { type: 'string' }, regionId: { type: 'string' },
    }),
  },
  read_cv_evidence: {
    description: 'Read one bounded page of source-pixel samples from a server-side CV evidence handle.',
    inputSchema: schema(['handle', 'offset', 'limit'], {
      handle: { type: 'string' }, offset: { type: 'integer' }, limit: { type: 'integer' },
    }),
  },
  build_world_slice: {
    description: 'Compile a bounded, revision-bound 2D World Model slice from Drawing IR. Use nodeIds or bounds for local work; continuationToken enables real paging for large drawings. Resolved facts are observations, never write authorization.',
    inputSchema: schema([], {
      nodeIds: stringArray,
      bounds: schema(['minX', 'minY', 'maxX', 'maxY'], {
        minX: { type: 'number' }, minY: { type: 'number' },
        maxX: { type: 'number' }, maxY: { type: 'number' },
      }),
      limit: { type: 'integer', minimum: 1, maximum: 500 },
      continuationToken: { type: 'string' },
      curveSamples: { type: 'integer', minimum: 8, maximum: 512 },
      tolerance: { type: 'number', exclusiveMinimum: 0 },
    }, ['nodeIds', 'bounds', 'limit', 'continuationToken', 'curveSamples', 'tolerance']),
  },
  inspect_world_slice: {
    description: 'Inspect exact SourceSpan, half-edge, vertex, face, incidence, or connection references from one episode-scoped World Model slice; or consume its continuation token for the next page.',
    inputSchema: schema(['sliceHandle', 'refs', 'includeSamples'], {
      sliceHandle: { type: 'string' }, refs: stringArray,
      includeSamples: { type: 'boolean' }, continuationToken: { type: 'string' },
    }, ['continuationToken']),
  },
  ground_semantic_entities: {
    description: 'Record model-selected semantic candidates against explicit World Model supports and optionally create a temporary task-relevant view. sliceHandle must be copied from a successful build_world_slice output in this episode; world/evidence/hash refs are not slice handles. Relation endpoints should reference selected candidate ids; relations to external semantic labels are returned as ignored evidence instead of rejecting the grounding. This is evidence memory, not a persistent Drawing IR feature or write permission.',
    inputSchema: schema([
      'sliceHandle', 'goalDescription', 'referringExpression', 'evidenceRefs',
      'candidates', 'selectedCandidateIds', 'abstraction', 'relations',
    ], {
      sliceHandle: { type: 'string' }, goalDescription: { type: 'string' },
      referringExpression: { type: 'string' }, evidenceRefs: stringArray,
      candidates: {
        type: 'array', minItems: 1, maxItems: 20, items: schema([
          'id', 'label', 'confidence', 'observationRefs', 'regionRefs', 'supports',
          'excludedSupports', 'interfaceRefs',
        ], {
          id: { type: 'string' }, label: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          observationRefs: stringArray, regionRefs: stringArray,
          supports: {
            type: 'array', items: schema(['kind', 'ref', 'weight', 'role'], {
              kind: { enum: ['node', 'source-span', 'half-edge', 'face'] },
              ref: { type: 'string' }, weight: { type: 'number', minimum: 0, maximum: 1 },
              role: { enum: ['interior', 'boundary', 'interface', 'context'] },
            }),
          },
          excludedSupports: stringArray, interfaceRefs: stringArray,
        }),
      },
      selectedCandidateIds: stringArray,
      abstraction: { enum: ['detail', 'part', 'object', 'region'] },
      relations: {
        type: 'array', items: schema(['kind', 'from', 'to', 'confidence', 'evidenceRefs'], {
          kind: { enum: [
            'part-of', 'contains', 'connected-to', 'boundary-of', 'interface-with', 'context-for',
          ] },
          from: { type: 'string' }, to: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 }, evidenceRefs: stringArray,
        }),
      },
    }),
  },
  refine_semantic_entity: {
    description: 'Append evidence, support changes, confidence, or state to an existing episode-scoped semantic hypothesis. It cannot mutate Drawing IR.',
    inputSchema: schema([
      'hypothesisId', 'kind', 'addedSupports', 'removedSupportRefs', 'evidenceRefs', 'reasonCode',
    ], {
      hypothesisId: { type: 'string' },
      kind: { enum: ['selected', 'refined', 'rejected', 'superseded', 'promoted'] },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      addedSupports: {
        type: 'array', items: schema(['kind', 'ref', 'weight', 'role'], {
          kind: { enum: ['node', 'source-span', 'half-edge', 'face'] }, ref: { type: 'string' },
          weight: { type: 'number', minimum: 0, maximum: 1 },
          role: { enum: ['interior', 'boundary', 'interface', 'context'] },
        }),
      },
      removedSupportRefs: stringArray, evidenceRefs: stringArray, reasonCode: { type: 'string' },
    }, ['confidence']),
  },
  propose_spatial_actions: {
    description: 'Compute deterministic transform/deform/solve/replace/redraw/hybrid/raw affordances for model-selected World Model refs. Proposals expose feasibility and virtual split needs but do not select a method or authorize edits.',
    inputSchema: schema([
      'sliceHandle', 'goalDescription', 'targetRefs', 'preserveRefs', 'interfaceRefs',
    ], {
      sliceHandle: { type: 'string' }, goalDescription: { type: 'string' },
      targetRefs: stringArray, preserveRefs: stringArray, interfaceRefs: stringArray,
      methods: {
        type: 'array', items: { enum: ['transform', 'deform', 'solve', 'replace', 'redraw', 'hybrid', 'raw'] },
      },
    }, ['methods']),
  },
  inspect_counterfactual_world: {
    description: 'Inspect the local before/after World Model delta of the current run and episode Preview branch without rendering or committing it.',
    inputSchema: schema(['branchId'], { branchId: { type: 'string' } }),
  },
  build_topology: {
    description: 'Build a revision-bound topology graph. Returns facts, not an accepted selection.',
    inputSchema: schema([], {
      curveSamples: { type: 'integer' }, tolerance: { type: 'number' },
    }, ['curveSamples', 'tolerance']),
  },
  trace_paths: {
    description: 'Trace ranked connected path candidates from world-coordinate seeds toward optional stops. Candidates are evidence, not authorization.',
    inputSchema: schema(['seedPoints', 'stopPoints', 'directionHints', 'maxDepth', 'maxCandidates'], {
      seedPoints: { type: 'array', items: point },
      stopPoints: { type: 'array', items: point },
      directionHints: { type: 'array', items: point },
      maxDepth: { type: 'integer' }, maxCandidates: { type: 'integer' },
      tolerance: { type: 'number' },
    }, ['tolerance']),
  },
  find_interfaces: {
    description: 'Find connection interfaces and branching facts for candidate node IDs.',
    inputSchema: schema(['nodeIds'], {
      nodeIds: stringArray, tolerance: { type: 'number' },
    }, ['tolerance']),
  },
  inspect_fragment: {
    description: 'Sample a local parameter range of one geometry node.',
    inputSchema: schema(['nodeId', 'range', 'samples'], {
      nodeId: { type: 'string' }, range: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number' } },
      samples: { type: 'integer' },
    }),
  },
  materialize_split: {
    description: 'Materialize explicit parameter ranges into a revision-bound Preview candidate; does not commit.',
    inputSchema: schema(['summary', 'splitPlans', 'evidenceRefs'], {
      summary: { type: 'string' }, splitPlans: { type: 'array', items: { type: 'object' } },
      evidenceRefs: stringArray, confidence: { type: 'number' },
    }, ['confidence']),
  },
  preview_connected_transform: {
    description: 'Move a model-selected closed circle/ellipse carrier while code automatically discovers every contacting open connector, transports only the connector endpoint on the carrier, and keeps each opposite external anchor fixed. Provide exactly one destination form: delta for a relative directional move (Drawing IR uses +X right and +Y visually up), or targetCenter for an absolute world-space destination. A no-effect request is rejected for replanning. Use this instead of translate/set_endpoint when a closed carrier moves but attached open paths must remain connected to fixed surrounding geometry. Omit rotationDegrees to use the minimum-deformation reference. Returns a revision-bound Preview and never commits automatically.',
    inputSchema: {
      ...schema(['summary', 'carrierNodeId', 'evidenceRefs'], {
        summary: { type: 'string' }, carrierNodeId: { type: 'string' },
        delta: point, targetCenter: point, rotationDegrees: { type: 'number' },
        evidenceRefs: stringArray, confidence: { type: 'number', minimum: 0, maximum: 1 },
      }, ['delta', 'targetCenter', 'rotationDegrees', 'confidence']),
      oneOf: [{ required: ['delta'] }, { required: ['targetCenter'] }],
    },
  },
  preview_spatial_program: {
    description: 'Compile one task-driven SpatialEditProgram into a revision-bound Preview. translate rigidly moves every coordinate of every listed whole node; it does not preserve an external anchor or reconnect a path. Never translate an attached connector whose opposite endpoint must stay fixed: use preview_connected_transform for a closed carrier with open connectors, or express a complete reconnect/rebuild. Use this fast path only after target nodes and interfaces are resolved. Set replacesPreviewHandle only when continuing from that exact Preview. It never commits automatically.',
    inputSchema: schemaWithDefs(['baseRevision', 'summary', 'intent', 'targets', 'operations'], {
      baseRevision: { const: '$current' }, replacesPreviewHandle: { type: 'string' },
      summary: { type: 'string' }, intent: { type: 'string' },
      targets: {
        type: 'array', minItems: 1, maxItems: 32,
        items: schema(['id', 'description', 'nodeRefs'], {
          id: { type: 'string' }, description: { type: 'string' }, nodeRefs: spatialRefArray,
          visualAnchors: {
            type: 'array', maxItems: 256, items: schemaRef('spatialPointRef'),
          },
          interfaceRefs: {
            type: 'array', maxItems: 256, items: schemaRef('spatialPointRef'),
          },
        }, ['visualAnchors', 'interfaceRefs']),
      },
      operations: {
        type: 'array', minItems: 1, maxItems: 64, items: schemaRef('spatialOperation'),
      },
      preserveNodeRefs: spatialRefArray,
      postconditions: {
        type: 'array', maxItems: 64, items: schemaRef('spatialPostcondition'),
      },
      evidenceRefs: spatialRefArray,
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    }, [
      'replacesPreviewHandle', 'preserveNodeRefs', 'postconditions', 'evidenceRefs', 'confidence',
    ], spatialSchemaDefinitions),
  },
  preview_transaction: {
    description: 'Start a COMPLETE Preview from the explicit canonical baseRevision. If a current Preview exists, pass its exact handle as replacesPreviewHandle to deliberately discard it and restart. Commands are <plane>.update{id,changes}, <plane>.delete{id}, or <plane>.create{value}; planes: geometry|annotation|relation|feature. Geometry create values: point{x,y}; line{start,end}; ray/xline{origin,direction}; circle{center,radius}; arc{center,radius,startAngle,endAngle,counterClockwise}; ellipse{center,majorAxis,ratio,startParam?,endParam?}; polyline{vertices:[{point,bulge?}],closed}; spline{degree,controlPoints,knots,weights?,closed,periodic}. Every create value also requires type,visible,quality:{status,evidenceRefs,confidence?}.',
    inputSchema: schemaWithDefs([
      'baseRevision', 'summary', 'commands', 'preconditions', 'postconditions', 'evidenceRefs',
    ], {
      baseRevision: { const: '$current' }, replacesPreviewHandle: { type: 'string' },
      summary: { type: 'string' },
      commands: { type: 'array', minItems: 1, items: schemaRef('drawingCommand') },
      preconditions: { type: 'array', items: schemaRef('drawingAssertion') },
      postconditions: { type: 'array', items: schemaRef('drawingAssertion') },
      evidenceRefs: stringArray,
      confidence: { type: 'number' }, lineage: { type: 'array', items: { type: 'object' } },
      decisionGrantRefs: stringArray,
    }, [
      'replacesPreviewHandle', 'confidence', 'lineage', 'decisionGrantRefs',
    ], drawingSchemaDefinitions),
  },
  revise_preview: {
    description: 'Apply bounded Drawing Command corrections relative to the exact current Preview identified by handle and transaction digest. Optional postconditions accept DrawingAssertion only (node.exists, node.absent, property.equals, document.valid, selection.count); SpatialEditProgram anchor conditions do not belong here and should be omitted. The server preserves the parent candidate, composes a standalone canonical transaction, validates equivalence, and returns a new current Preview.',
    inputSchema: schemaWithDefs([
      'basePreviewHandle', 'baseTransactionDigest', 'summary', 'corrections', 'evidenceRefs',
    ], {
      basePreviewHandle: { type: 'string' }, baseTransactionDigest: { type: 'string' },
      summary: { type: 'string' },
      corrections: { type: 'array', minItems: 1, items: schemaRef('drawingCommand') },
      postconditions: { type: 'array', items: schemaRef('drawingAssertion') },
      evidenceRefs: stringArray,
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    }, ['postconditions', 'confidence'], drawingSchemaDefinitions),
  },
  evaluate_preview: {
    description: 'Evaluate and optionally render a current Preview. Returns diagnostics and an incremental geometry/annotation delta without committing.',
    inputSchema: schema(['previewHandle'], {
      previewHandle: { type: 'string' }, includeRender: { type: 'boolean' }, selectedIds: stringArray,
    }, ['includeRender', 'selectedIds']),
  },
  commit_preview: {
    description: 'Internal atomic commit tool for a revision-bound Preview after model acceptance and any required candidate grant.',
    inputSchema: schema(['previewHandle'], {
      previewHandle: { type: 'string' }, decisionGrantRefs: stringArray,
    }, ['decisionGrantRefs']),
  },
  redraw_region: {
    description: 'Generate a clean redraw candidate from a model-chosen semantic region in Drawing IR world coordinates. The server renders pixels and masks; contours guide generation but never grant or limit IR write authority.',
    inputSchema: schema(['prompt', 'contours', 'holes'], {
      prompt: { type: 'string' },
      contours: { type: 'array', minItems: 1, items: { type: 'array', minItems: 3, items: point } },
      holes: { type: 'array', items: { type: 'array', minItems: 3, items: point } },
      selectedIds: stringArray,
      seed: { type: 'integer' },
      maxPixels: { type: 'integer' },
    }, ['selectedIds', 'seed', 'maxPixels']),
  },
  vectorize_image: {
    description: 'Vectorize a stored source once into a bounded inventory of deterministic Drawing IR batches. The result omits raw samples; inspect its batch summaries, then preview batches in order.',
    inputSchema: schema(['sourceId'], { sourceId: { type: 'string' } }),
  },
  preview_vectorization_batch: {
    description: 'Preview one deterministic vectorization batch from a vectorize_image candidate. Start at batchIndex 0 and continue in order after each commit; do not call vectorize_image again for the same candidate.',
    inputSchema: schema(['candidateHandle', 'batchIndex'], {
      candidateHandle: { type: 'string' },
      batchIndex: { type: 'integer', minimum: 0 },
    }),
  },
  fit_geometry: {
    description: 'Fit a line, circle, arc, ellipse, polyline, or spline candidate from CV evidence.',
    inputSchema: schema(['evidenceHandle', 'primitiveType'], {
      evidenceHandle: { type: 'string' }, primitiveType: { type: 'string' },
    }),
  },
  recompute_annotations: {
    description: 'Propose, reassociate, or remove derived annotations. Proposals never constrain geometry edits.',
    inputSchema: schema(['geometry', 'existingAnnotations', 'mode'], {
      geometry: { type: 'array', items: { type: 'object' } },
      existingAnnotations: { type: 'array', items: { type: 'object' } },
      mode: { enum: ['propose', 'reassociate', 'remove-derived'] },
    }),
  },
};

export function guideModelDrawingTool<T extends {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}>(tool: T): T {
  const guide = MODEL_DRAWING_TOOL_GUIDES[tool.name];
  return guide ? { ...tool, ...guide } : tool;
}
