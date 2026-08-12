import type {
  DrawingLineageRecord,
  EvidenceId,
  GeometryId,
  GeometryNode,
  RevisionId,
  Vec2,
} from '../../../src/drawing/index.js';
import type { SpatialSelection, VirtualSplitPlan } from '../../../src/contracts/drawing-spatial-region.js';
import type { DrawingApplication } from '../drawing-application/application.js';
import {
  buildGeometryTopologyGraph,
  type AtomicGraphSegment,
  type GeometryTopologyGraph,
  type TopologyVertex,
} from '../drawing-spatial/atomic-graph.js';
import {
  roughGeometryBounds,
  sampleGeometryRanges,
} from '../drawing-spatial/geometry-sampling.js';
import { materializeSpatialSplits } from '../drawing-spatial/split-materializer.js';
import type { DrawingModelTools } from './drawing-tools.js';
import { ModelToolInputError } from './registry.js';
import type {
  ModelDrawingToolDefinition,
  ModelDrawingToolExecutionContext,
} from './types.js';

type ToolDefinition = ModelDrawingToolDefinition<any, any>;

interface TracePathsInput {
  seedPoints: Vec2[];
  stopPoints: Vec2[];
  directionHints: Vec2[];
  maxDepth: number;
  maxCandidates: number;
  tolerance?: number;
}

interface MaterializeSplitInput {
  summary: string;
  confidence?: number;
  splitPlans: Array<{
    nodeId: string;
    ranges: Array<{ range: readonly [number, number]; role: 'target' | 'protected' }>;
  }>;
  evidenceRefs: EvidenceId[];
}

export class DrawingTopologyTools {
  readonly definitions: readonly ToolDefinition[];
  readonly #application: DrawingApplication;
  readonly #drawingTools: DrawingModelTools;

  constructor(input: { application: DrawingApplication; drawingTools: DrawingModelTools }) {
    this.#application = input.application;
    this.#drawingTools = input.drawingTools;
    this.definitions = Object.freeze([
      this.#buildTopology(),
      this.#tracePaths(),
      this.#findInterfaces(),
      this.#inspectFragment(),
      this.#materializeSplit(),
    ]);
  }

  #buildTopology(): ToolDefinition {
    return define('build_topology', 'read', 10_000, parseBuildTopology, async ({ invocation, input }) => {
      const workspace = await this.#application.open(invocation.drawingId);
      const graph = buildGeometryTopologyGraph({
        document: workspace.document,
        revision: workspace.revision,
        ...(input.curveSamples === undefined ? {} : { curveSamples: input.curveSamples }),
        ...(input.tolerance === undefined ? {} : { tolerance: input.tolerance }),
      });
      return {
        output: {
          revision: graph.revision,
          tolerance: graph.tolerance,
          segmentCount: graph.segments.length,
          vertexCount: graph.vertices.length,
          nodes: workspace.document.geometry.map((node) => ({
            nodeId: node.id,
            segmentIds: graph.segmentsFor(node.id).map((segment) => segment.id),
          })),
        },
        revisionAfter: workspace.revision,
        affectedNodeIds: workspace.document.geometry.map((node) => node.id),
      };
    });
  }

  #tracePaths(): ToolDefinition {
    return define<TracePathsInput, unknown>(
      'trace_paths', 'read', 15_000, parseTracePaths,
      async ({ invocation, input }) => {
        const workspace = await this.#application.open(invocation.drawingId);
        const graph = buildGeometryTopologyGraph({
          document: workspace.document,
          revision: workspace.revision,
          ...(input.tolerance === undefined ? {} : { tolerance: input.tolerance }),
        });
        const tolerance = input.tolerance ?? graph.tolerance;
        const seeds = input.seedPoints.flatMap((pointValue) => {
          const nearest = nearestSegment(graph, pointValue);
          return nearest && nearest.distance <= Math.max(tolerance * 8, graph.tolerance * 8)
            ? [nearest.segment]
            : [];
        });
        const scoredPaths = uniqueBy(
          seeds.flatMap((seed) => enumeratePaths(graph, seed, input.maxDepth, input.stopPoints, tolerance)),
          (path) => path.segments.map((segment) => segment.id).join('/'),
        )
          .map((path) => scorePath(path, input.stopPoints, input.directionHints, tolerance));
        const directionConsistent = input.directionHints.length === 0
          ? scoredPaths
          : scoredPaths.filter((path) => path.directionAlignment >= -0.05);
        const candidates = (directionConsistent.length > 0 ? directionConsistent : scoredPaths)
          .sort((left, right) => right.score - left.score)
          .slice(0, input.maxCandidates)
          .map((path, index) => ({
            rank: index + 1,
            score: path.score,
            segmentIds: path.segments.map((segment) => segment.id),
            nodeIds: unique(path.segments.map((segment) => segment.nodeId)),
            vertexIds: path.vertexIds,
            start: path.start,
            end: path.end,
            reachedStop: path.reachedStop,
            branchCount: path.branchCount,
            evidence: path.evidence,
          }));
        return {
          output: {
            revision: workspace.revision,
            candidates,
            uncertainty: {
              ambiguous: candidates.length > 1,
              alternateCount: Math.max(0, candidates.length - 1),
              unresolvedSeedCount: Math.max(0, input.seedPoints.length - seeds.length),
              notes: candidates.length === 0
                ? ['No path candidate could be grounded to the current topology.']
                : candidates.length > 1
                  ? ['Multiple topology paths remain plausible; visual inspection is recommended.']
                  : [],
            },
          },
          revisionAfter: workspace.revision,
          affectedNodeIds: unique(candidates.flatMap((candidate) => candidate.nodeIds)),
        };
      },
    );
  }

  #findInterfaces(): ToolDefinition {
    return define('find_interfaces', 'read', 10_000, parseFindInterfaces, async ({ invocation, input }) => {
      const workspace = await this.#application.open(invocation.drawingId);
      const graph = buildGeometryTopologyGraph({
        document: workspace.document,
        revision: workspace.revision,
        ...(input.tolerance === undefined ? {} : { tolerance: input.tolerance }),
      });
      const nodeIds = new Set(input.nodeIds);
      const interfaces = graph.vertices.flatMap((vertex) => {
        const connectedSegments = vertex.incidentSegmentIds
          .map((id) => graph.segment(id))
          .filter((segment): segment is AtomicGraphSegment => Boolean(segment));
        const connectedNodeIds = unique(connectedSegments.map((segment) => segment.nodeId));
        if (!connectedNodeIds.some((id) => nodeIds.has(id))) return [];
        return [{
          vertexId: vertex.id,
          point: vertex.point,
          degree: connectedSegments.length,
          segmentIds: connectedSegments.map((segment) => segment.id),
          connectedNodeIds: connectedNodeIds.sort(),
          boundary: connectedNodeIds.some((id) => nodeIds.has(id))
            && connectedNodeIds.some((id) => !nodeIds.has(id)),
          uncertain: connectedSegments.length > 2,
        }];
      });
      return {
        output: { revision: workspace.revision, interfaces },
        revisionAfter: workspace.revision,
        affectedNodeIds: unique(interfaces.flatMap((item) => item.connectedNodeIds)),
      };
    });
  }

  #inspectFragment(): ToolDefinition {
    return define('inspect_fragment', 'read', 10_000, parseInspectFragment, async ({ invocation, input }) => {
      const workspace = await this.#application.open(invocation.drawingId);
      const node = workspace.document.geometry.find((item) => item.id === input.nodeId);
      if (!node) invalid('nodeId does not reference geometry');
      const samples = fragmentSamples(node, input.range, input.samples);
      return {
        output: {
          revision: workspace.revision,
          nodeId: node.id,
          sourceType: node.type,
          range: input.range,
          samples,
          start: samples[0],
          end: samples.at(-1),
          bounds: samplesBounds(samples),
        },
        revisionAfter: workspace.revision,
        affectedNodeIds: [node.id],
      };
    });
  }

  #materializeSplit(): ToolDefinition {
    return define<MaterializeSplitInput, unknown>(
      'materialize_split', 'write', 15_000, parseMaterializeSplit,
      async ({ invocation, input }) => {
        const workspace = await this.#application.open(invocation.drawingId);
        const selection = selectionForPlans(workspace.revision, input.splitPlans);
        const materialized = materializeSpatialSplits({
          document: workspace.document,
          selection,
        });
        const lineage: DrawingLineageRecord[] = materialized.lineage.map((entry) => ({
          sourceIds: [entry.sourceNodeId],
          resultIds: [entry.fragmentId],
          operation: 'split',
          sourceRanges: [{ nodeId: entry.sourceNodeId, range: [...entry.sourceRange] }],
          evidenceRefs: structuredClone(input.evidenceRefs),
        }));
        const preview = await this.#drawingTools.previewCandidate({
          runId: invocation.runId,
          episodeId: invocation.episodeId,
          drawingId: invocation.drawingId,
          revision: invocation.revision,
          summary: input.summary,
          commands: materialized.commands,
          evidenceRefs: input.evidenceRefs,
          confidence: input.confidence,
          lineage,
        });
        return {
          output: {
            ...preview,
            lineage: materialized.lineage,
            fidelityWarnings: materialized.fidelityWarnings,
          },
          affectedNodeIds: preview.status === 'ready' ? preview.affectedNodeIds : [],
        };
      },
    );
  }
}

interface EnumeratedPath {
  segments: AtomicGraphSegment[];
  vertexIds: string[];
  start: Vec2;
  end: Vec2;
  reachedStop: boolean;
  branchCount: number;
}

function enumeratePaths(
  graph: GeometryTopologyGraph,
  seed: AtomicGraphSegment,
  maxDepth: number,
  stopPoints: Vec2[],
  tolerance: number,
): EnumeratedPath[] {
  const results: EnumeratedPath[] = [];
  const startOptions = [
    { vertexId: seed.startVertexId, point: seed.start, exitVertexId: seed.endVertexId, end: seed.end },
    { vertexId: seed.endVertexId, point: seed.end, exitVertexId: seed.startVertexId, end: seed.start },
  ];
  for (const option of startOptions) {
    const walk = (
      segments: AtomicGraphSegment[],
      visited: Set<string>,
      entryVertexId: string,
      currentEnd: Vec2,
      vertexIds: string[],
      branchCount: number,
    ) => {
      const reachedStop = stopPoints.some((pointValue) => distance(pointValue, currentEnd) <= tolerance * 8);
      const current = segments.at(-1)!;
      const exitVertexId = current.startVertexId === entryVertexId
        ? current.endVertexId
        : current.startVertexId;
      const nextIds = (graph.vertex(exitVertexId)?.incidentSegmentIds ?? [])
        .filter((id) => !visited.has(id));
      if (reachedStop || segments.length >= maxDepth || nextIds.length === 0) {
        results.push({
          segments: [...segments], vertexIds: [...vertexIds, exitVertexId],
          start: option.point, end: currentEnd, reachedStop, branchCount,
        });
        return;
      }
      for (const nextId of nextIds) {
        const next = graph.segment(nextId);
        if (!next) continue;
        const nextEnd = next.startVertexId === exitVertexId ? next.end : next.start;
        walk(
          [...segments, next], new Set([...visited, next.id]), exitVertexId, nextEnd,
          [...vertexIds, exitVertexId], branchCount + Math.max(0, nextIds.length - 1),
        );
      }
    };
    walk([seed], new Set([seed.id]), option.vertexId, option.end, [option.vertexId], 0);
  }
  return results;
}

function scorePath(
  path: EnumeratedPath,
  stopPoints: Vec2[],
  directionHints: Vec2[],
  tolerance: number,
) {
  const stopDistance = stopPoints.length === 0
    ? 0
    : Math.min(...stopPoints.map((pointValue) => distance(path.end, pointValue)));
  const vector: Vec2 = [path.end[0] - path.start[0], path.end[1] - path.start[1]];
  const directionScore = directionHints.length === 0
    ? 0
    : Math.max(...directionHints.map((hint) => cosine(vector, hint)));
  const score = (path.reachedStop ? 4 : 0)
    + directionScore
    - stopDistance / Math.max(tolerance * 8, 1)
    - path.branchCount * 0.05;
  return {
    ...path,
    score: round(score),
    directionAlignment: directionScore,
    evidence: [
      `stop-distance:${round(stopDistance)}`,
      `direction-cosine:${round(directionScore)}`,
      `branches:${path.branchCount}`,
    ],
  };
}

function nearestSegment(graph: GeometryTopologyGraph, pointValue: Vec2) {
  return graph.segments.reduce<{ segment: AtomicGraphSegment; distance: number } | null>((best, segment) => {
    const current = distanceToSamples(pointValue, segment.samples);
    return !best || current < best.distance ? { segment, distance: current } : best;
  }, null);
}

function distanceToSamples(pointValue: Vec2, samples: Vec2[]): number {
  if (samples.length < 2) return samples[0] ? distance(pointValue, samples[0]) : Number.POSITIVE_INFINITY;
  return Math.min(...samples.slice(1).map((end, index) => (
    distanceToSegment(pointValue, samples[index], end)
  )));
}

function distanceToSegment(pointValue: Vec2, start: Vec2, end: Vec2): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const denominator = dx * dx + dy * dy;
  const t = denominator <= 1e-18 ? 0 : Math.max(0, Math.min(1, (
    (pointValue[0] - start[0]) * dx + (pointValue[1] - start[1]) * dy
  ) / denominator));
  return distance(pointValue, [start[0] + t * dx, start[1] + t * dy]);
}

function fragmentSamples(node: GeometryNode, range: readonly [number, number], samples: number): Vec2[] {
  const bounds = roughGeometryBounds(node) ?? { minX: -1, minY: -1, maxX: 1, maxY: 1 };
  const sampled = sampleGeometryRanges(node, { curveSamples: Math.max(samples, 64), localBounds: bounds });
  const domain = node.type === 'polyline'
    ? Math.max(1, node.closed ? node.vertices.length : node.vertices.length - 1)
    : 1;
  const at = (parameter: number): Vec2 => {
    const normalized = Math.max(0, Math.min(domain, parameter));
    const piece = sampled.find((item) => {
      const identity = item.vertexRange ?? item.parameterRange ?? [0, 1];
      return normalized >= identity[0] && normalized <= identity[1] + 1e-12;
    }) ?? sampled.at(-1)!;
    const identity = piece.vertexRange ?? piece.parameterRange ?? [0, 1];
    const local = identity[1] === identity[0] ? 0 : (normalized - identity[0]) / (identity[1] - identity[0]);
    return [
      piece.start[0] + (piece.end[0] - piece.start[0]) * local,
      piece.start[1] + (piece.end[1] - piece.start[1]) * local,
    ];
  };
  return Array.from({ length: samples }, (_, index) => (
    at(range[0] + (range[1] - range[0]) * index / Math.max(1, samples - 1))
  ));
}

function selectionForPlans(
  revision: RevisionId,
  plans: MaterializeSplitInput['splitPlans'],
): SpatialSelection {
  const splitPlan: VirtualSplitPlan[] = plans.map((plan) => ({
    nodeId: plan.nodeId as GeometryId,
    revision,
    ranges: plan.ranges.map((range) => ({ role: range.role, range: [...range.range] })),
    cutParameters: plan.ranges.slice(1).map((range) => range.range[0]),
  }));
  return {
    regionId: 'model-split-candidate', revision,
    wholeNodes: [], partialSegments: [],
    crossingNodes: splitPlan.map((plan) => plan.nodeId),
    protectedNodes: [], boundaryAnchors: [], classifications: [], uncertainParts: [],
    splitPlan,
  };
}

function parseBuildTopology(value: unknown) {
  const input = strictRecord(value, [], ['curveSamples', 'tolerance']);
  return {
    ...(input.curveSamples === undefined ? {} : { curveSamples: positiveInteger(input.curveSamples, 'curveSamples') }),
    ...(input.tolerance === undefined ? {} : { tolerance: positiveNumber(input.tolerance, 'tolerance') }),
  };
}

function parseTracePaths(value: unknown): TracePathsInput {
  const input = strictRecord(
    value,
    ['seedPoints', 'stopPoints', 'directionHints', 'maxDepth', 'maxCandidates'],
    ['tolerance'],
  );
  return {
    seedPoints: points(input.seedPoints, 'seedPoints', true),
    stopPoints: points(input.stopPoints, 'stopPoints', false),
    directionHints: points(input.directionHints, 'directionHints', false),
    maxDepth: positiveInteger(input.maxDepth, 'maxDepth'),
    maxCandidates: positiveInteger(input.maxCandidates, 'maxCandidates'),
    ...(input.tolerance === undefined ? {} : { tolerance: positiveNumber(input.tolerance, 'tolerance') }),
  };
}

function parseFindInterfaces(value: unknown) {
  const input = strictRecord(value, ['nodeIds'], ['tolerance']);
  return {
    nodeIds: nonEmptyStrings(input.nodeIds, 'nodeIds'),
    ...(input.tolerance === undefined ? {} : { tolerance: positiveNumber(input.tolerance, 'tolerance') }),
  };
}

function parseInspectFragment(value: unknown) {
  const input = strictRecord(value, ['nodeId', 'range', 'samples']);
  const range = numericRange(input.range, 'range');
  if (range[1] <= range[0]) invalid('range must be ascending');
  return {
    nodeId: nonEmptyString(input.nodeId, 'nodeId'),
    range,
    samples: positiveInteger(input.samples, 'samples'),
  };
}

function parseMaterializeSplit(value: unknown): MaterializeSplitInput {
  const input = strictRecord(value, ['summary', 'splitPlans', 'evidenceRefs'], ['confidence']);
  if (!Array.isArray(input.splitPlans) || input.splitPlans.length === 0) invalid('splitPlans must not be empty');
  return {
    summary: nonEmptyString(input.summary, 'summary'),
    ...(input.confidence === undefined ? {} : { confidence: confidence(input.confidence, 'confidence') }),
    splitPlans: input.splitPlans.map((item, index) => {
      const plan = strictRecord(item, ['nodeId', 'ranges']);
      if (!Array.isArray(plan.ranges) || plan.ranges.length < 2) invalid(`splitPlans[${index}].ranges is incomplete`);
      return {
        nodeId: nonEmptyString(plan.nodeId, `splitPlans[${index}].nodeId`),
        ranges: plan.ranges.map((itemRange, rangeIndex) => {
          const parsed = strictRecord(itemRange, ['range', 'role']);
          return {
            range: numericRange(parsed.range, `splitPlans[${index}].ranges[${rangeIndex}].range`),
            role: enumValue(parsed.role, ['target', 'protected'], 'role'),
          };
        }),
      };
    }),
    evidenceRefs: strings(input.evidenceRefs, 'evidenceRefs') as EvidenceId[],
  };
}

function define<I, O>(
  name: string,
  access: 'read' | 'write',
  timeoutMs: number,
  parseInput: (value: unknown) => I,
  execute: (context: ModelDrawingToolExecutionContext<I>) => Promise<{
    output: O; revisionAfter?: RevisionId; affectedNodeIds?: string[];
  }>,
): ModelDrawingToolDefinition<I, O> {
  return { name, version: '1.0.0', access, timeoutMs, parseInput, execute };
}

function strictRecord(value: unknown, required: string[], optional: string[] = []) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid('input must be an object');
  const result = value as Record<string, unknown>;
  const allowed = new Set([...required, ...optional]);
  const unknown = Object.keys(result).find((key) => !allowed.has(key));
  if (unknown) invalid(`unsupported field ${unknown}`);
  const missing = required.find((key) => !(key in result));
  if (missing) invalid(`missing field ${missing}`);
  return result;
}

function points(value: unknown, path: string, required: boolean): Vec2[] {
  if (!Array.isArray(value) || required && value.length === 0) invalid(`${path} must be an array`);
  return value.map((item, index) => point(item, `${path}[${index}]`));
}

function point(value: unknown, path: string): Vec2 {
  if (!Array.isArray(value) || value.length !== 2) invalid(`${path} must be a point`);
  return [finite(value[0], path), finite(value[1], path)];
}

function numericRange(value: unknown, path: string): readonly [number, number] {
  if (!Array.isArray(value) || value.length !== 2) invalid(`${path} must contain two numbers`);
  return [finite(value[0], path), finite(value[1], path)];
}

function strings(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) invalid(`${path} must be an array`);
  return unique(value.map((item) => nonEmptyString(item, path)));
}

function nonEmptyStrings(value: unknown, path: string): string[] {
  const result = strings(value, path);
  if (result.length === 0) invalid(`${path} must not be empty`);
  return result;
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) invalid(`${path} must be a string`);
  return value;
}

function finite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(`${path} must be finite`);
  return value;
}

function positiveNumber(value: unknown, path: string): number {
  const result = finite(value, path);
  if (result <= 0) invalid(`${path} must be positive`);
  return result;
}

function positiveInteger(value: unknown, path: string): number {
  const result = positiveNumber(value, path);
  if (!Number.isSafeInteger(result)) invalid(`${path} must be an integer`);
  return result;
}

function confidence(value: unknown, path: string): number {
  const result = finite(value, path);
  if (result < 0 || result > 1) invalid(`${path} must be between 0 and 1`);
  return result;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) invalid(`${path} is invalid`);
  return value as T;
}

function invalid(message: string): never {
  throw new ModelToolInputError(message);
}

function samplesBounds(samples: Vec2[]) {
  return {
    minX: Math.min(...samples.map((item) => item[0])),
    minY: Math.min(...samples.map((item) => item[1])),
    maxX: Math.max(...samples.map((item) => item[0])),
    maxY: Math.max(...samples.map((item) => item[1])),
  };
}

function cosine(left: Vec2, right: Vec2): number {
  const denominator = Math.hypot(...left) * Math.hypot(...right);
  return denominator <= 1e-18 ? 0 : (left[0] * right[0] + left[1] * right[1]) / denominator;
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(right[0] - left[0], right[1] - left[1]);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function uniqueBy<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const id = key(value);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function round(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}
