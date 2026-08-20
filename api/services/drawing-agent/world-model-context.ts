import type {
  DrawingDocument,
  GeometryNode,
  RevisionId,
} from '../../../src/drawing/index.js';
import {
  proposeSpatialActions,
  type SpatialActionProposal,
} from '../drawing-spatial-actions/index.js';
import { WorldModelCompiler } from '../drawing-world-model/compiler.js';
import type { WorldModelSlice } from '../drawing-world-model/types.js';

const DEFAULT_CONTEXT_NODE_LIMIT = 96;
const MAX_CONTEXT_NODE_LIMIT = 128;

export interface ModelWorldModelSlice {
  compilerVersion: WorldModelSlice['compilerVersion'];
  inputDigest: string;
  frameId: string;
  scopeBounds?: WorldModelSlice['scopeBounds'];
  knowledge: WorldModelSlice['knowledge'];
  continuationToken?: string;
  counts: {
    sourceSpans: number;
    vertices: number;
    faces: number;
    incidenceEdges: number;
    connectedEdges: number;
  };
  primitiveColumns: readonly ['ref', 'type', 'parameters', 'quality', 'sourceSpanRefs'];
  primitiveParameterSchemas: Record<string, string>;
  primitiveRows: Array<readonly [string, GeometryNode['type'], unknown, string, string[]]>;
  vertexColumns: readonly ['ref', 'x', 'y', 'degree', 'source'];
  vertexRows: Array<readonly [string, number, number, number, string]>;
  incidenceColumns: readonly ['ref', 'kind', 'leftNodeRef', 'rightNodeRef', 'point'];
  incidenceRows: Array<readonly [string, string, string, string, unknown]>;
  connectionColumns: readonly ['ref', 'source', 'nodeRefs', 'point'];
  connectionRows: Array<readonly [string, string, string[], unknown]>;
  contactColumns: readonly [
    'endpointNodeRef', 'endpointRole', 'curveNodeRef', 'curveRole', 'contactPoint', 'gap',
  ];
  contactRows: Array<readonly [string, string, string, 'curve', readonly [number, number], number]>;
  diagnostics: WorldModelSlice['diagnostics'];
}

const PRIMITIVE_PARAMETER_SCHEMAS: ModelWorldModelSlice['primitiveParameterSchemas'] = {
  point: '[x,y]',
  line: '[x1,y1,x2,y2]',
  ray: '[originX,originY,directionX,directionY]',
  xline: '[originX,originY,directionX,directionY]',
  circle: '[centerX,centerY,radius]',
  arc: '[centerX,centerY,radius,startAngle,endAngle,counterClockwise]',
  ellipse: '[centerX,centerY,majorAxisX,majorAxisY,ratio,startParam|null,endParam|null]',
  polyline: '[closed,[[x,y,bulge],...]]',
  spline: '[degree,closed,periodic,[[controlX,controlY],...],knots,weights|null]',
};

export interface ModelSpatialActionFact {
  id: string;
  method: SpatialActionProposal['method'];
  feasibility: SpatialActionProposal['feasibility'];
  affectedNodeRefs: string[];
  requiredSplits: Array<{
    sourceNodeRef: string;
    parameterRanges: Array<readonly [number, number]>;
  }>;
  diagnosticCodes: string[];
  estimatedCost: SpatialActionProposal['estimatedCost'];
}

export function buildModelWorldContext(input: {
  document: DrawingDocument;
  revision: RevisionId;
  localGeometryNodeIds: string[];
  targetGeometryNodeIds: string[];
  alias(nodeId: string): string;
  compiler?: WorldModelCompiler;
  limit?: number;
}): {
  worldModelSlice: ModelWorldModelSlice;
  actionFacts: ModelSpatialActionFact[];
  evidenceRef: string;
} {
  const compiler = input.compiler ?? new WorldModelCompiler();
  const geometryIds = new Set(input.document.geometry.map((node) => node.id as string));
  const localGeometryNodeIds = unique(input.localGeometryNodeIds)
    .filter((id) => geometryIds.has(id));
  const targetGeometryNodeIds = unique(input.targetGeometryNodeIds)
    .filter((id) => geometryIds.has(id));
  const limit = Math.max(
    1,
    Math.min(MAX_CONTEXT_NODE_LIMIT, Math.floor(input.limit ?? DEFAULT_CONTEXT_NODE_LIMIT)),
  );
  const request = localGeometryNodeIds.length > 0
    ? { nodeIds: localGeometryNodeIds.slice(0, limit), limit }
    : { limit };
  const world = compiler.compile(input.document, input.revision, request);
  const targetRefs = targetGeometryNodeIds
    .filter((id) => world.sourceSpans.some((span) => span.sourceNodeId === id))
    .map((id) => `node:${id}`);
  const proposals = targetRefs.length === 0 ? [] : proposeSpatialActions({
    goalDescription: 'model-selected-spatial-edit',
    world,
    targetRefs,
    preserveRefs: [],
    interfaceRefs: [],
  });
  return {
    worldModelSlice: projectWorld(world, input.document, input.alias),
    actionFacts: proposals.map((proposal) => projectProposal(proposal, input.alias)),
    evidenceRef: `world:${world.inputDigest}`,
  };
}

function projectWorld(
  world: WorldModelSlice,
  document: DrawingDocument,
  alias: (nodeId: string) => string,
): ModelWorldModelSlice {
  const spansByNode = new Map<string, string[]>();
  for (const span of world.sourceSpans) {
    const refs = spansByNode.get(span.sourceNodeId) ?? [];
    refs.push(span.id);
    spansByNode.set(span.sourceNodeId, refs);
  }
  const includedNodeIds = new Set(world.sourceSpans.map((span) => span.sourceNodeId));
  return {
    compilerVersion: world.compilerVersion,
    inputDigest: world.inputDigest,
    frameId: world.frameId,
    ...(world.scopeBounds ? { scopeBounds: world.scopeBounds } : {}),
    knowledge: world.knowledge,
    ...(world.continuationToken ? { continuationToken: world.continuationToken } : {}),
    counts: {
      sourceSpans: world.sourceSpans.length,
      vertices: world.vertices.length,
      faces: world.faces.length,
      incidenceEdges: world.incidenceEdges.length,
      connectedEdges: world.connectedEdges.length,
    },
    primitiveColumns: ['ref', 'type', 'parameters', 'quality', 'sourceSpanRefs'],
    primitiveParameterSchemas: PRIMITIVE_PARAMETER_SCHEMAS,
    primitiveRows: document.geometry
      .filter((node) => includedNodeIds.has(node.id))
      .map((node) => ([
        alias(node.id), node.type, geometryParameters(node), node.quality.status,
        spansByNode.get(node.id) ?? [],
      ])),
    vertexColumns: ['ref', 'x', 'y', 'degree', 'source'],
    vertexRows: world.vertices.map((vertex) => ([
      vertex.id, vertex.point[0], vertex.point[1],
      vertex.incidentHalfEdgeIds.length / 2, vertex.source,
    ])),
    incidenceColumns: ['ref', 'kind', 'leftNodeRef', 'rightNodeRef', 'point'],
    incidenceRows: world.incidenceEdges.map((edge) => ([
      edge.id, edge.kind, alias(edge.nodeIds[0]), alias(edge.nodeIds[1]), edge.point ?? null,
    ])),
    connectionColumns: ['ref', 'source', 'nodeRefs', 'point'],
    connectionRows: world.connectedEdges.map((edge) => ([
      edge.id, edge.source, edge.nodeIds.map(alias), edge.point ?? null,
    ])),
    contactColumns: [
      'endpointNodeRef', 'endpointRole', 'curveNodeRef', 'curveRole', 'contactPoint', 'gap',
    ],
    contactRows: computeEndpointCurveContacts(
      document.geometry.filter((node) => includedNodeIds.has(node.id)),
      alias,
      world.scopeBounds,
    ),
    diagnostics: world.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      nodeIds: diagnostic.nodeIds.map(alias),
    })),
  };
}

function computeEndpointCurveContacts(
  nodes: GeometryNode[],
  alias: (nodeId: string) => string,
  scopeBounds: WorldModelSlice['scopeBounds'],
): ModelWorldModelSlice['contactRows'] {
  if (nodes.length < 2) return [];
  const scale = scopeBounds
    ? Math.max(scopeBounds.maxX - scopeBounds.minX, scopeBounds.maxY - scopeBounds.minY, 1)
    : 1;
  // Vectorized line art commonly leaves about one source-pixel between a fitted endpoint
  // and a fitted curve. A drawing-relative 0.25% tolerance preserves those intended ports
  // without joining visibly separate shapes.
  const tolerance = Math.max(scale * 0.0025, Number.EPSILON * scale * 64);
  const sampled = new Map(nodes.map((node) => [node.id, geometrySamples(node)]));
  return nodes.flatMap((endpointNode) => geometryEndpoints(endpointNode).flatMap((endpoint) => (
    nodes.flatMap((curveNode) => {
      if (curveNode.id === endpointNode.id) return [];
      const nearest = nearestOnSamples(endpoint.point, sampled.get(curveNode.id) ?? []);
      if (!nearest || nearest.distance > tolerance) return [];
      return [[
        alias(endpointNode.id), endpoint.role, alias(curveNode.id), 'curve' as const,
        nearest.point, clean(nearest.distance),
      ] as const];
    })
  ))).sort((left, right) => (
    left[0].localeCompare(right[0]) || left[1].localeCompare(right[1])
      || left[2].localeCompare(right[2])
  ));
}

function geometryEndpoints(
  node: GeometryNode,
): Array<{ role: string; point: readonly [number, number] }> {
  switch (node.type) {
    case 'point': return [{ role: 'point', point: [node.x, node.y] }];
    case 'line': return [
      { role: 'start', point: node.start }, { role: 'end', point: node.end },
    ];
    case 'ray':
    case 'xline': return [{ role: 'origin', point: node.origin }];
    case 'circle': return [];
    case 'arc': {
      const samples = geometrySamples(node);
      return samples.length === 0 ? [] : [
        { role: 'start', point: samples[0] }, { role: 'end', point: samples.at(-1)! },
      ];
    }
    case 'ellipse': {
      if (node.startParam === undefined && node.endParam === undefined) return [];
      const samples = geometrySamples(node);
      return samples.length === 0 ? [] : [
        { role: 'start', point: samples[0] }, { role: 'end', point: samples.at(-1)! },
      ];
    }
    case 'polyline': return node.closed || node.vertices.length === 0 ? [] : [
      { role: 'start', point: node.vertices[0].point },
      { role: 'end', point: node.vertices.at(-1)!.point },
    ];
    case 'spline': return node.closed || node.controlPoints.length === 0 ? [] : [
      { role: 'start', point: node.controlPoints[0] },
      { role: 'end', point: node.controlPoints.at(-1)! },
    ];
  }
}

function geometrySamples(node: GeometryNode): Array<readonly [number, number]> {
  switch (node.type) {
    case 'point': return [[node.x, node.y]];
    case 'line': return [node.start, node.end];
    case 'circle': return Array.from({ length: 65 }, (_, index) => {
      const angle = index * Math.PI * 2 / 64;
      return [
        node.center[0] + node.radius * Math.cos(angle),
        node.center[1] + node.radius * Math.sin(angle),
      ] as const;
    });
    case 'arc': {
      const start = node.startAngle * Math.PI / 180;
      const end = node.endAngle * Math.PI / 180;
      let sweep = end - start;
      if (node.counterClockwise && sweep < 0) sweep += Math.PI * 2;
      if (!node.counterClockwise && sweep > 0) sweep -= Math.PI * 2;
      return Array.from({ length: 65 }, (_, index) => {
        const angle = start + sweep * index / 64;
        return [
          node.center[0] + node.radius * Math.cos(angle),
          node.center[1] + node.radius * Math.sin(angle),
        ] as const;
      });
    }
    case 'ellipse': {
      const start = node.startParam ?? 0;
      const end = node.endParam ?? Math.PI * 2;
      const minor: readonly [number, number] = [
        -node.majorAxis[1] * node.ratio, node.majorAxis[0] * node.ratio,
      ];
      return Array.from({ length: 65 }, (_, index) => {
        const parameter = start + (end - start) * index / 64;
        return [
          node.center[0] + node.majorAxis[0] * Math.cos(parameter) + minor[0] * Math.sin(parameter),
          node.center[1] + node.majorAxis[1] * Math.cos(parameter) + minor[1] * Math.sin(parameter),
        ] as const;
      });
    }
    case 'polyline': return node.vertices.map((vertex) => vertex.point);
    case 'spline': return node.controlPoints;
    case 'ray':
    case 'xline': return [
      node.origin,
      [node.origin[0] + node.direction[0], node.origin[1] + node.direction[1]],
    ];
  }
}

function nearestOnSamples(
  point: readonly [number, number],
  samples: Array<readonly [number, number]>,
): { point: readonly [number, number]; distance: number } | null {
  if (samples.length === 0) return null;
  if (samples.length === 1) return { point: samples[0], distance: distance(point, samples[0]) };
  let best: { point: readonly [number, number]; distance: number } | null = null;
  for (let index = 1; index < samples.length; index += 1) {
    const candidate = nearestOnSegment(point, samples[index - 1], samples[index]);
    if (!best || candidate.distance < best.distance) best = candidate;
  }
  return best;
}

function nearestOnSegment(
  point: readonly [number, number],
  start: readonly [number, number],
  end: readonly [number, number],
): { point: readonly [number, number]; distance: number } {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const denominator = dx * dx + dy * dy;
  const parameter = denominator <= 1e-18 ? 0 : Math.max(0, Math.min(1, (
    (point[0] - start[0]) * dx + (point[1] - start[1]) * dy
  ) / denominator));
  const projected: readonly [number, number] = [
    clean(start[0] + parameter * dx), clean(start[1] + parameter * dy),
  ];
  return { point: projected, distance: distance(point, projected) };
}

function distance(left: readonly [number, number], right: readonly [number, number]): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function clean(value: number): number {
  const rounded = Number(value.toFixed(9));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function geometryParameters(node: GeometryNode): unknown {
  switch (node.type) {
    case 'point': return [node.x, node.y];
    case 'line': return [...node.start, ...node.end];
    case 'ray':
    case 'xline': return [...node.origin, ...node.direction];
    case 'circle': return [...node.center, node.radius];
    case 'arc': return [
      ...node.center, node.radius, node.startAngle, node.endAngle, node.counterClockwise,
    ];
    case 'ellipse': return [
      ...node.center, ...node.majorAxis, node.ratio,
      node.startParam ?? null, node.endParam ?? null,
    ];
    case 'polyline': return [
      node.closed,
      node.vertices.map((vertex) => [...vertex.point, vertex.bulge ?? 0]),
    ];
    case 'spline': return [
      node.degree, node.closed, node.periodic, node.controlPoints, node.knots, node.weights ?? null,
    ];
  }
}

function projectProposal(
  proposal: SpatialActionProposal,
  alias: (nodeId: string) => string,
): ModelSpatialActionFact {
  return {
    id: proposal.id,
    method: proposal.method,
    feasibility: proposal.feasibility,
    affectedNodeRefs: proposal.affectedNodeIds.map(alias),
    requiredSplits: proposal.requiredSplits.map((split) => ({
      sourceNodeRef: alias(split.nodeId),
      parameterRanges: split.parameterRanges,
    })),
    diagnosticCodes: proposal.diagnostics.map((diagnostic) => diagnostic.code),
    estimatedCost: proposal.estimatedCost,
  };
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
