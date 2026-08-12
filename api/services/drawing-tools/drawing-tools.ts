import { randomUUID } from 'node:crypto';

import {
  parseDrawingToolAssertions,
  parseDrawingToolCommands,
  parseDrawingToolSelector,
} from '../../../src/contracts/drawing-agent.js';
import {
  randomIdFactory,
  type Bounds2D,
  type DrawingAssertion,
  type DrawingCommand,
  type DrawingDocument,
  type DrawingId,
  type DrawingLineageRecord,
  type DrawingSelector,
  type DrawingTransaction,
  type EvidenceId,
  type GeometryNode,
  type IdFactory,
  type RevisionId,
  type Vec2,
} from '../../../src/drawing/index.js';
import { geometryBounds, unionBounds } from '../../../src/drawing/query/bounds.js';
import type { DrawingApplication } from '../drawing-application/application.js';
import { evaluateDrawingPreview } from '../drawing-diagnostics/evaluate-preview.js';
import { buildGeometryTopologyGraph } from '../drawing-spatial/atomic-graph.js';
import {
  roughGeometryBounds,
  sampleGeometryRanges,
} from '../drawing-spatial/geometry-sampling.js';
import {
  ModelToolExecutionError,
  ModelToolInputError,
} from './registry.js';
import type {
  ModelDrawingToolDefinition,
  ModelDrawingToolExecutionContext,
} from './types.js';

type ToolDefinition = ModelDrawingToolDefinition<any, any>;

interface StoredCandidate {
  handle: string;
  runId: string;
  episodeId: string;
  drawingId: DrawingId;
  baseRevision: RevisionId;
  transaction: DrawingTransaction;
  affectedNodeIds: string[];
}

interface PreviewTransactionInput {
  summary: string;
  confidence?: number;
  commands: DrawingCommand[];
  preconditions: DrawingAssertion[];
  postconditions: DrawingAssertion[];
  evidenceRefs: EvidenceId[];
  lineage?: DrawingLineageRecord[];
  decisionGrantRefs?: string[];
  diagnosticAcknowledgements?: string[];
}

interface EvaluatePreviewInput {
  previewHandle: string;
  includeRender: boolean;
  selectedIds: string[];
}

interface CommitPreviewInput {
  previewHandle: string;
  decisionGrantRefs: string[];
  diagnosticAcknowledgements: string[];
}

type MeasurementRequest =
  | { id: string; kind: 'distance'; from: Vec2; to: Vec2 }
  | { id: string; kind: 'angle'; first: Vec2; vertex: Vec2; second: Vec2 }
  | { id: string; kind: 'bounds'; nodeIds: string[] }
  | { id: string; kind: 'closure'; nodeIds: string[]; tolerance?: number }
  | { id: string; kind: 'intersections'; leftNodeId: string; rightNodeId: string; tolerance?: number }
  | { id: string; kind: 'nearest-point'; nodeId: string; point: Vec2 };

export class DrawingModelTools {
  readonly definitions: readonly ToolDefinition[];
  readonly #application: DrawingApplication;
  readonly #idFactory: IdFactory;
  readonly #handleFactory: () => string;
  readonly #tolerance: number;
  readonly #candidates = new Map<string, StoredCandidate>();

  constructor(input: {
    application: DrawingApplication;
    idFactory?: IdFactory;
    handleFactory?: () => string;
    tolerance?: number;
  }) {
    this.#application = input.application;
    this.#idFactory = input.idFactory ?? randomIdFactory;
    this.#handleFactory = input.handleFactory ?? (() => `preview_${randomUUID()}`);
    this.#tolerance = positiveNumber(input.tolerance ?? 0.01, 'tolerance');
    this.definitions = Object.freeze([
      this.#queryNodes(),
      this.#inspectNodes(),
      this.#renderDrawing(),
      this.#measureGeometry(),
      this.#previewTransaction(),
      this.#evaluatePreview(),
      this.#commitPreview(),
    ]);
  }

  async currentRevision(drawingId: DrawingId): Promise<RevisionId> {
    return (await this.#application.open(drawingId)).revision;
  }

  snapshot(): { candidateCount: number; documentCount: 0 } {
    return { candidateCount: this.#candidates.size, documentCount: 0 };
  }

  discardRun(runId: string): number {
    let discarded = 0;
    for (const [handle, candidate] of this.#candidates) {
      if (candidate.runId !== runId) continue;
      this.#candidates.delete(handle);
      discarded += 1;
    }
    return discarded;
  }

  async previewCandidate(input: {
    runId: string;
    episodeId: string;
    drawingId: DrawingId;
    revision: RevisionId;
    summary: string;
    commands: DrawingCommand[];
    evidenceRefs?: EvidenceId[];
    confidence?: number;
    lineage?: DrawingLineageRecord[];
  }): Promise<{
    status: 'ready';
    previewHandle: string;
    affectedNodeIds: string[];
    candidate: boolean;
    validationValid: boolean;
  } | { status: 'already_satisfied' } | { status: 'rejected'; errors: unknown[] }> {
    const transaction: DrawingTransaction = {
      id: this.#idFactory.next('transaction'),
      baseRevision: input.revision,
      actor: { type: 'AI', id: `drawing-agent:${input.runId}` },
      commands: structuredClone(input.commands),
      preconditions: [],
      postconditions: [{ type: 'document.valid' }],
      evidenceRefs: structuredClone(input.evidenceRefs ?? []),
      metadata: {
        episodeId: input.episodeId,
        summary: input.summary,
        ...(input.confidence === undefined ? {} : { confidence: input.confidence }),
        ...(input.lineage ? { lineage: structuredClone(input.lineage) } : {}),
      },
    };
    const result = await this.#application.preview({ drawingId: input.drawingId, transaction });
    if (result.status !== 'ready') return structuredClone(result);
    const handle = this.#handleFactory();
    const affectedNodeIds = [...result.preview.affectedNodeIds];
    this.#candidates.set(handle, {
      handle,
      runId: input.runId,
      episodeId: input.episodeId,
      drawingId: input.drawingId,
      baseRevision: input.revision,
      transaction,
      affectedNodeIds,
    });
    return {
      status: 'ready', previewHandle: handle, affectedNodeIds,
      candidate: result.preview.candidate,
      validationValid: result.preview.validationReport.valid,
    };
  }

  #queryNodes(): ToolDefinition {
    return define('query_nodes', 'read', 5_000, parseQueryNodes, async ({ invocation, input }) => {
      const queried = await this.#application.query({
        drawingId: invocation.drawingId,
        selector: input.selector,
      });
      return {
        output: { revision: queried.revision, ...queried.result },
        revisionAfter: queried.revision,
        affectedNodeIds: queried.result.items.map((item) => item.id),
      };
    });
  }

  #inspectNodes(): ToolDefinition {
    return define('inspect_nodes', 'read', 5_000, parseInspectNodes, async ({ invocation, input }) => {
      const inspected = await Promise.all(input.nodeIds.map((nodeId) => (
        this.#application.inspect({ drawingId: invocation.drawingId, nodeId })
      )));
      const nodes = inspected.flatMap((result) => result.result ? [result.result] : []);
      const missingNodeIds = input.nodeIds.filter((_nodeId, index) => !inspected[index].result);
      return {
        output: { revision: inspected[0]?.revision ?? invocation.revision, nodes, missingNodeIds },
        revisionAfter: inspected[0]?.revision ?? invocation.revision,
        affectedNodeIds: nodes.map((result) => result.node.id),
      };
    });
  }

  #renderDrawing(): ToolDefinition {
    return define('render_drawing', 'read', 15_000, parseRenderDrawing, async ({ invocation, input }) => {
      const observation = await this.#application.observeForAgent({
        drawingId: invocation.drawingId,
        includeAnnotations: input.includeAnnotations,
        selectedIds: input.selectedIds,
        selectionIsTarget: input.view === 'focus',
        ...(input.viewport ? { userViewport: input.viewport } : {}),
      });
      const views = observation.views.filter((view) => {
        if (input.view === 'all') return true;
        if (input.view === 'focus') return view.purpose !== 'user-viewport';
        if (input.view === 'viewport') return view.purpose === 'user-viewport';
        return view.purpose === 'overview';
      });
      return {
        output: { ...observation, views },
        revisionAfter: observation.revision,
        affectedNodeIds: input.selectedIds,
      };
    });
  }

  #measureGeometry(): ToolDefinition {
    return define('measure_geometry', 'read', 10_000, parseMeasureGeometry, async ({ invocation, input }) => {
      const workspace = await this.#application.open(invocation.drawingId);
      const measurements = input.measurements.map((request) => (
        measure(workspace.document, workspace.revision, request, this.#tolerance)
      ));
      return {
        output: { revision: workspace.revision, measurements },
        revisionAfter: workspace.revision,
        affectedNodeIds: unique(input.measurements.flatMap(measurementNodeIds)),
      };
    });
  }

  #previewTransaction(): ToolDefinition {
    return define<PreviewTransactionInput, unknown>(
      'preview_transaction',
      'write',
      15_000,
      parsePreviewTransaction,
      async ({ invocation, input }) => {
        const transaction: DrawingTransaction = {
          id: this.#idFactory.next('transaction'),
          baseRevision: invocation.revision,
          actor: { type: 'AI', id: `drawing-agent:${invocation.runId}` },
          commands: structuredClone(input.commands),
          preconditions: structuredClone(input.preconditions),
          postconditions: structuredClone(input.postconditions),
          evidenceRefs: structuredClone(input.evidenceRefs),
          metadata: {
            episodeId: invocation.episodeId,
            summary: input.summary,
            ...(input.confidence === undefined ? {} : { confidence: input.confidence }),
            ...(input.lineage ? { lineage: structuredClone(input.lineage) } : {}),
            ...(input.decisionGrantRefs
              ? { decisionGrantRefs: structuredClone(input.decisionGrantRefs) }
              : {}),
            ...(input.diagnosticAcknowledgements
              ? { diagnosticAcknowledgements: structuredClone(input.diagnosticAcknowledgements) }
              : {}),
          },
        };
        const result = await this.#application.preview({
          drawingId: invocation.drawingId,
          transaction,
        });
        if (result.status !== 'ready') {
          return {
            output: structuredClone(result),
            affectedNodeIds: result.status === 'rejected'
              ? unique(result.errors.flatMap((error) => error.nodeIds))
              : [],
          };
        }
        const handle = this.#handleFactory();
        const candidate: StoredCandidate = {
          handle,
          runId: invocation.runId,
          episodeId: invocation.episodeId,
          drawingId: invocation.drawingId,
          baseRevision: invocation.revision,
          transaction,
          affectedNodeIds: [...result.preview.affectedNodeIds],
        };
        this.#candidates.set(handle, candidate);
        return {
          output: {
            status: 'ready',
            previewHandle: handle,
            transactionId: transaction.id,
            candidate: result.preview.candidate,
            validationValid: result.preview.validationReport.valid,
            goalSatisfied: result.preview.outcomeReport.satisfied,
            affectedNodeIds: [...result.preview.affectedNodeIds],
          },
          affectedNodeIds: candidate.affectedNodeIds,
        };
      },
    );
  }

  #evaluatePreview(): ToolDefinition {
    return define('evaluate_preview', 'read', 20_000, parseEvaluatePreview, async ({ invocation, input }) => {
      const candidate = this.#requireCandidate(invocation, input.previewHandle);
      const workspace = await this.#application.open(invocation.drawingId);
      const preview = await this.#application.preview({
        drawingId: candidate.drawingId,
        transaction: structuredClone(candidate.transaction),
      });
      if (preview.status !== 'ready') {
        throw toolError(
          preview.status === 'rejected' ? preview.errors[0]?.code ?? 'PREVIEW_INVALID' : 'PREVIEW_NO_LONGER_READY',
          'replan',
        );
      }
      const report = evaluateDrawingPreview({
        before: workspace.document,
        after: preview.resultingDocument,
        transaction: candidate.transaction,
        tolerance: this.#tolerance,
      });
      const observation = input.includeRender
        ? await this.#application.observePreviewForAgent({
            document: preview.resultingDocument,
            revision: invocation.revision,
            previewHandle: candidate.handle,
            selectedIds: input.selectedIds.length > 0
              ? input.selectedIds
              : report.changedNodeIds,
          })
        : undefined;
      return {
        output: {
          previewHandle: candidate.handle,
          ...report,
          validationReport: structuredClone(preview.preview.validationReport),
          outcomeReport: structuredClone(preview.preview.outcomeReport),
          ...(observation ? { observation } : {}),
        },
        affectedNodeIds: report.changedNodeIds,
      };
    });
  }

  #commitPreview(): ToolDefinition {
    return define<CommitPreviewInput, unknown>('commit_preview', 'write', 15_000, parseCommitPreview, async ({ invocation, input }) => {
      const candidate = this.#requireCandidate(invocation, input.previewHandle);
      const transaction = structuredClone(candidate.transaction);
      if (input.decisionGrantRefs.length > 0 || input.diagnosticAcknowledgements.length > 0) {
        transaction.metadata = {
          ...transaction.metadata!,
          decisionGrantRefs: unique([
            ...transaction.metadata?.decisionGrantRefs ?? [],
            ...input.decisionGrantRefs,
          ]),
          diagnosticAcknowledgements: unique([
            ...transaction.metadata?.diagnosticAcknowledgements ?? [],
            ...input.diagnosticAcknowledgements,
          ]),
        };
      }
      const committed = await this.#application.execute({
        drawingId: candidate.drawingId,
        transaction,
      });
      if (committed.status === 'rejected') {
        throw toolError(committed.errors[0]?.code ?? 'COMMIT_REJECTED', 'requery');
      }
      this.#candidates.delete(candidate.handle);
      if (committed.status === 'already_satisfied') {
        return {
          output: { status: 'already_satisfied', outcome: committed.outcome },
          affectedNodeIds: [],
        };
      }
      return {
        output: {
          status: 'committed', commitId: committed.commit.id,
          revision: committed.revision,
        },
        revisionAfter: committed.revision,
        affectedNodeIds: candidate.affectedNodeIds,
      };
    });
  }

  #requireCandidate(
    invocation: Omit<Parameters<ModelDrawingToolDefinition['execute']>[0]['invocation'], never>,
    handle: string,
  ): StoredCandidate {
    const candidate = this.#candidates.get(handle);
    if (!candidate) throw toolError('PREVIEW_NOT_FOUND', 'replan');
    if (
      candidate.runId !== invocation.runId
      || candidate.episodeId !== invocation.episodeId
      || candidate.drawingId !== invocation.drawingId
    ) {
      throw toolError('PREVIEW_SCOPE_MISMATCH', 'replan');
    }
    if (candidate.baseRevision !== invocation.revision) {
      this.#candidates.delete(handle);
      throw toolError('PREVIEW_STALE', 'requery');
    }
    return candidate;
  }
}

function define<I, O>(
  name: string,
  access: 'read' | 'write',
  timeoutMs: number,
  parseInput: (value: unknown) => I,
  execute: (context: ModelDrawingToolExecutionContext<I>) => Promise<{
    output: O;
    revisionAfter?: RevisionId;
    affectedNodeIds?: string[];
  }>,
): ModelDrawingToolDefinition<I, O> {
  return { name, version: '1.0.0', access, timeoutMs, parseInput, execute };
}

function parseQueryNodes(value: unknown): { selector: DrawingSelector } {
  const input = strictRecord(value, ['selector']);
  return { selector: parseDrawingToolSelector(input.selector, 'input.selector') };
}

function parseInspectNodes(value: unknown): { nodeIds: string[] } {
  const input = strictRecord(value, ['nodeIds']);
  return { nodeIds: nonEmptyStringArray(input.nodeIds, 'input.nodeIds') };
}

function parseRenderDrawing(value: unknown): {
  view: 'overview' | 'focus' | 'viewport' | 'all';
  selectedIds: string[];
  includeAnnotations: boolean;
  viewport?: { scale: number; offsetX: number; offsetY: number; width: number; height: number };
} {
  const input = strictRecord(
    value,
    ['view'],
    ['selectedIds', 'includeAnnotations', 'viewport'],
  );
  const view = enumValue(input.view, ['overview', 'focus', 'viewport', 'all'], 'input.view');
  const selectedIds = input.selectedIds === undefined
    ? []
    : stringArray(input.selectedIds, 'input.selectedIds');
  const includeAnnotations = input.includeAnnotations === undefined
    ? true
    : booleanValue(input.includeAnnotations, 'input.includeAnnotations');
  let viewport;
  if (input.viewport !== undefined) {
    const parsed = strictRecord(input.viewport, ['scale', 'offsetX', 'offsetY', 'width', 'height']);
    viewport = {
      scale: positiveNumber(parsed.scale, 'input.viewport.scale'),
      offsetX: finiteNumber(parsed.offsetX, 'input.viewport.offsetX'),
      offsetY: finiteNumber(parsed.offsetY, 'input.viewport.offsetY'),
      width: positiveInteger(parsed.width, 'input.viewport.width'),
      height: positiveInteger(parsed.height, 'input.viewport.height'),
    };
  }
  if (view === 'viewport' && !viewport) invalid('input.viewport is required for viewport view');
  return { view, selectedIds, includeAnnotations, ...(viewport ? { viewport } : {}) };
}

function parseMeasureGeometry(value: unknown): { measurements: MeasurementRequest[] } {
  const input = strictRecord(value, ['measurements']);
  if (!Array.isArray(input.measurements) || input.measurements.length === 0) {
    invalid('input.measurements must be a non-empty array');
  }
  return { measurements: input.measurements.map(parseMeasurement) };
}

function parseMeasurement(value: unknown, index: number): MeasurementRequest {
  const base = record(value, `input.measurements[${index}]`);
  const kind = enumValue(base.kind, [
    'distance', 'angle', 'bounds', 'closure', 'intersections', 'nearest-point',
  ], `input.measurements[${index}].kind`);
  const id = nonEmptyString(base.id, `input.measurements[${index}].id`);
  switch (kind) {
    case 'distance':
      exactKeys(base, ['id', 'kind', 'from', 'to']);
      return { id, kind, from: point(base.from, 'from'), to: point(base.to, 'to') };
    case 'angle':
      exactKeys(base, ['id', 'kind', 'first', 'vertex', 'second']);
      return {
        id, kind, first: point(base.first, 'first'), vertex: point(base.vertex, 'vertex'),
        second: point(base.second, 'second'),
      };
    case 'bounds':
      exactKeys(base, ['id', 'kind', 'nodeIds']);
      return { id, kind, nodeIds: nonEmptyStringArray(base.nodeIds, 'nodeIds') };
    case 'closure':
      exactKeys(base, ['id', 'kind', 'nodeIds'], ['tolerance']);
      return {
        id, kind, nodeIds: nonEmptyStringArray(base.nodeIds, 'nodeIds'),
        ...(base.tolerance === undefined ? {} : { tolerance: positiveNumber(base.tolerance, 'tolerance') }),
      };
    case 'intersections':
      exactKeys(base, ['id', 'kind', 'leftNodeId', 'rightNodeId'], ['tolerance']);
      return {
        id, kind,
        leftNodeId: nonEmptyString(base.leftNodeId, 'leftNodeId'),
        rightNodeId: nonEmptyString(base.rightNodeId, 'rightNodeId'),
        ...(base.tolerance === undefined ? {} : { tolerance: positiveNumber(base.tolerance, 'tolerance') }),
      };
    case 'nearest-point':
      exactKeys(base, ['id', 'kind', 'nodeId', 'point']);
      return {
        id, kind, nodeId: nonEmptyString(base.nodeId, 'nodeId'), point: point(base.point, 'point'),
      };
  }
}

function parsePreviewTransaction(value: unknown): PreviewTransactionInput {
  const input = strictRecord(
    value,
    ['summary', 'commands', 'preconditions', 'postconditions', 'evidenceRefs'],
    ['confidence', 'lineage', 'decisionGrantRefs', 'diagnosticAcknowledgements'],
  );
  return {
    summary: nonEmptyString(input.summary, 'input.summary'),
    ...(input.confidence === undefined
      ? {}
      : { confidence: confidence(input.confidence, 'input.confidence') }),
    commands: parseDrawingToolCommands(input.commands, 'input.commands'),
    preconditions: parseDrawingToolAssertions(input.preconditions, 'input.preconditions'),
    postconditions: parseDrawingToolAssertions(input.postconditions, 'input.postconditions'),
    evidenceRefs: stringArray(input.evidenceRefs, 'input.evidenceRefs') as EvidenceId[],
    ...(input.lineage === undefined ? {} : { lineage: parseLineage(input.lineage) }),
    ...(input.decisionGrantRefs === undefined
      ? {}
      : { decisionGrantRefs: stringArray(input.decisionGrantRefs, 'input.decisionGrantRefs') }),
    ...(input.diagnosticAcknowledgements === undefined
      ? {}
      : {
          diagnosticAcknowledgements: stringArray(
            input.diagnosticAcknowledgements,
            'input.diagnosticAcknowledgements',
          ),
        }),
  };
}

function parseEvaluatePreview(value: unknown): EvaluatePreviewInput {
  const input = strictRecord(value, ['previewHandle'], ['includeRender', 'selectedIds']);
  return {
    previewHandle: nonEmptyString(input.previewHandle, 'input.previewHandle'),
    includeRender: input.includeRender === undefined
      ? true
      : booleanValue(input.includeRender, 'input.includeRender'),
    selectedIds: input.selectedIds === undefined
      ? []
      : stringArray(input.selectedIds, 'input.selectedIds'),
  };
}

function parseCommitPreview(value: unknown): CommitPreviewInput {
  const input = strictRecord(
    value,
    ['previewHandle'],
    ['decisionGrantRefs', 'diagnosticAcknowledgements'],
  );
  return {
    previewHandle: nonEmptyString(input.previewHandle, 'input.previewHandle'),
    decisionGrantRefs: input.decisionGrantRefs === undefined
      ? []
      : stringArray(input.decisionGrantRefs, 'input.decisionGrantRefs'),
    diagnosticAcknowledgements: input.diagnosticAcknowledgements === undefined
      ? []
      : stringArray(input.diagnosticAcknowledgements, 'input.diagnosticAcknowledgements'),
  };
}

function parseLineage(value: unknown): DrawingLineageRecord[] {
  if (!Array.isArray(value)) invalid('input.lineage must be an array');
  return value.map((item, index) => {
    const path = `input.lineage[${index}]`;
    const record = strictRecord(
      item,
      ['sourceIds', 'resultIds', 'operation', 'evidenceRefs'],
      ['sourceRanges'],
    );
    const operation = enumValue(record.operation, [
      'preserve', 'transform', 'split', 'merge', 'replace', 'redraw',
    ], `${path}.operation`);
    let sourceRanges: DrawingLineageRecord['sourceRanges'];
    if (record.sourceRanges !== undefined) {
      if (!Array.isArray(record.sourceRanges)) invalid(`${path}.sourceRanges must be an array`);
      sourceRanges = record.sourceRanges.map((range, rangeIndex) => {
        const parsed = strictRecord(range, ['nodeId', 'range']);
        if (!Array.isArray(parsed.range) || parsed.range.length !== 2) {
          invalid(`${path}.sourceRanges[${rangeIndex}].range must contain two numbers`);
        }
        return {
          nodeId: nonEmptyString(parsed.nodeId, `${path}.sourceRanges[${rangeIndex}].nodeId`),
          range: [
            finiteNumber(parsed.range[0], `${path}.sourceRanges[${rangeIndex}].range[0]`),
            finiteNumber(parsed.range[1], `${path}.sourceRanges[${rangeIndex}].range[1]`),
          ],
        };
      });
    }
    return {
      sourceIds: stringArray(record.sourceIds, `${path}.sourceIds`),
      resultIds: stringArray(record.resultIds, `${path}.resultIds`),
      operation,
      ...(sourceRanges ? { sourceRanges } : {}),
      evidenceRefs: stringArray(record.evidenceRefs, `${path}.evidenceRefs`) as EvidenceId[],
    };
  });
}

function measure(
  document: DrawingDocument,
  revision: RevisionId,
  request: MeasurementRequest,
  defaultTolerance: number,
): Record<string, unknown> {
  switch (request.kind) {
    case 'distance':
      return { ...request, value: clean(distance(request.from, request.to)), unit: document.unitSystem.length };
    case 'angle': {
      const left = [request.first[0] - request.vertex[0], request.first[1] - request.vertex[1]] as Vec2;
      const right = [request.second[0] - request.vertex[0], request.second[1] - request.vertex[1]] as Vec2;
      const denominator = Math.max(Number.MIN_VALUE, Math.hypot(...left) * Math.hypot(...right));
      const cosine = Math.max(-1, Math.min(1, (left[0] * right[0] + left[1] * right[1]) / denominator));
      return { ...request, value: clean(Math.acos(cosine) * 180 / Math.PI), unit: 'deg' };
    }
    case 'bounds': {
      const bounds = selectedBounds(document, request.nodeIds);
      return { ...request, bounds };
    }
    case 'closure': {
      const graph = buildGeometryTopologyGraph({
        document, revision, tolerance: request.tolerance ?? defaultTolerance,
      });
      const segmentIds = new Set(request.nodeIds.flatMap((nodeId) => (
        graph.segmentsFor(nodeId).map((segment) => segment.id)
      )));
      const vertices = graph.vertices.filter((vertex) => (
        vertex.incidentSegmentIds.some((id) => segmentIds.has(id))
      ));
      const openVertices = vertices.filter((vertex) => (
        vertex.incidentSegmentIds.filter((id) => segmentIds.has(id)).length !== 2
      ));
      return {
        ...request,
        closed: segmentIds.size > 0 && openVertices.length === 0,
        openPoints: openVertices.map((vertex) => vertex.point),
      };
    }
    case 'intersections': {
      const left = requireGeometry(document, request.leftNodeId);
      const right = requireGeometry(document, request.rightNodeId);
      return {
        ...request,
        points: sampledIntersections(left, right, request.tolerance ?? defaultTolerance),
      };
    }
    case 'nearest-point': {
      const node = requireGeometry(document, request.nodeId);
      const nearest = nearestPoint(node, request.point);
      return { ...request, nearest: nearest.point, distance: clean(nearest.distance) };
    }
  }
}

function selectedBounds(document: DrawingDocument, nodeIds: string[]): Bounds2D | null {
  const ids = new Set(nodeIds);
  const bounds = document.geometry.flatMap((node) => {
    if (!ids.has(node.id)) return [];
    const item = geometryBounds(node);
    return item ? [item] : [];
  });
  return unionBounds(bounds) ?? null;
}

function sampledIntersections(left: GeometryNode, right: GeometryNode, tolerance: number): Vec2[] {
  const leftSegments = sampledSegments(left);
  const rightSegments = sampledSegments(right);
  const points = leftSegments.flatMap(([a, b]) => rightSegments.flatMap(([c, d]) => {
    const exact = segmentIntersection(a, b, c, d);
    if (exact) return [exact];
    const candidates = [a, b, c, d].filter((point, index) => {
      const segment = index < 2 ? [c, d] as const : [a, b] as const;
      return distanceToSegment(point, segment[0], segment[1]).distance <= tolerance;
    });
    return candidates;
  }));
  return uniquePoints(points, tolerance);
}

function nearestPoint(node: GeometryNode, pointValue: Vec2): { point: Vec2; distance: number } {
  const segments = sampledSegments(node);
  if (segments.length === 0) {
    const fallback: Vec2 = node.type === 'point' ? [node.x, node.y] : [0, 0];
    return { point: fallback, distance: distance(pointValue, fallback) };
  }
  return segments.map(([start, end]) => distanceToSegment(pointValue, start, end))
    .sort((left, right) => left.distance - right.distance)[0];
}

function sampledSegments(node: GeometryNode): Array<readonly [Vec2, Vec2]> {
  const bounds = roughGeometryBounds(node) ?? { minX: -1, minY: -1, maxX: 1, maxY: 1 };
  return sampleGeometryRanges(node, { curveSamples: 128, localBounds: bounds })
    .flatMap((range) => {
      const points = range.samples.length >= 2 ? range.samples : [range.start, range.end];
      return points.slice(0, -1).map((start, index) => [start, points[index + 1]] as const);
    });
}

function segmentIntersection(a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2 | null {
  const r: Vec2 = [b[0] - a[0], b[1] - a[1]];
  const s: Vec2 = [d[0] - c[0], d[1] - c[1]];
  const cross = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(cross) <= 1e-12) return null;
  const offset: Vec2 = [c[0] - a[0], c[1] - a[1]];
  const t = (offset[0] * s[1] - offset[1] * s[0]) / cross;
  const u = (offset[0] * r[1] - offset[1] * r[0]) / cross;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [clean(a[0] + t * r[0]), clean(a[1] + t * r[1])];
}

function distanceToSegment(pointValue: Vec2, start: Vec2, end: Vec2) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const denominator = dx * dx + dy * dy;
  const t = denominator <= 1e-18
    ? 0
    : Math.max(0, Math.min(1, (
        (pointValue[0] - start[0]) * dx + (pointValue[1] - start[1]) * dy
      ) / denominator));
  const projected: Vec2 = [start[0] + t * dx, start[1] + t * dy];
  return { point: projected, distance: distance(pointValue, projected) };
}

function uniquePoints(points: Vec2[], tolerance: number): Vec2[] {
  return points.reduce<Vec2[]>((result, item) => {
    if (!result.some((existing) => distance(existing, item) <= tolerance)) result.push(item);
    return result;
  }, []);
}

function measurementNodeIds(request: MeasurementRequest): string[] {
  if ('nodeIds' in request) return request.nodeIds;
  if ('nodeId' in request) return [request.nodeId];
  if ('leftNodeId' in request) return [request.leftNodeId, request.rightNodeId];
  return [];
}

function requireGeometry(document: DrawingDocument, nodeId: string): GeometryNode {
  const node = document.geometry.find((item) => item.id === nodeId);
  if (!node) throw toolError('GEOMETRY_NOT_FOUND', 'requery');
  return node;
}

function toolError(code: string, action: 'retry' | 'requery' | 'replan') {
  return new ModelToolExecutionError({ code, retryable: true, suggestedAction: action });
}

function strictRecord(
  value: unknown,
  required: string[],
  optional: string[] = [],
): Record<string, unknown> {
  const result = record(value, 'input');
  exactKeys(result, required, optional);
  return result;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid(`${path} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid(`${path} must be a plain object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, required: string[], optional: string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  if (unknown) invalid(`unsupported input field ${unknown}`);
  const missing = required.find((key) => !(key in value));
  if (missing) invalid(`missing input field ${missing}`);
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) invalid(`${path} is invalid`);
  return value as T;
}

function point(value: unknown, path: string): Vec2 {
  if (!Array.isArray(value) || value.length !== 2) invalid(`${path} must be a point`);
  return [finiteNumber(value[0], `${path}[0]`), finiteNumber(value[1], `${path}[1]`)];
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) invalid(`${path} must be a non-empty string`);
  return value;
}

function stringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) invalid(`${path} must be an array`);
  return unique(value.map((item, index) => nonEmptyString(item, `${path}[${index}]`)));
}

function nonEmptyStringArray(value: unknown, path: string): string[] {
  const result = stringArray(value, path);
  if (result.length === 0) invalid(`${path} must not be empty`);
  return result;
}

function booleanValue(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') invalid(`${path} must be boolean`);
  return value;
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(`${path} must be finite`);
  return value;
}

function positiveNumber(value: unknown, path: string): number {
  const result = finiteNumber(value, path);
  if (result <= 0) invalid(`${path} must be positive`);
  return result;
}

function positiveInteger(value: unknown, path: string): number {
  const result = positiveNumber(value, path);
  if (!Number.isSafeInteger(result)) invalid(`${path} must be an integer`);
  return result;
}

function confidence(value: unknown, path: string): number {
  const result = finiteNumber(value, path);
  if (result < 0 || result > 1) invalid(`${path} must be between 0 and 1`);
  return result;
}

function invalid(message: string): never {
  throw new ModelToolInputError(message);
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(right[0] - left[0], right[1] - left[1]);
}

function clean(value: number): number {
  const result = Math.round(value * 1e9) / 1e9;
  return Object.is(result, -0) ? 0 : result;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
