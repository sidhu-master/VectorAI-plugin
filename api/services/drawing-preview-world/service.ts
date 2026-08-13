import { randomUUID } from 'node:crypto';

import type {
  Bounds2D,
  DrawingDocument,
  DrawingNode,
  GeometryNode,
  RevisionId,
  TransactionResult,
} from '../../../src/drawing/index.js';
import { annotationBounds, geometryBounds, unionBounds } from '../../../src/drawing/query/bounds.js';
import { WorldModelCompiler } from '../drawing-world-model/compiler.js';
import type {
  CounterfactualWorldBranch,
  CounterfactualWorldBranchSnapshot,
} from './types.js';

type ReadyPreview = Extract<TransactionResult, { status: 'ready' }>;

interface StoredBranch {
  branch: CounterfactualWorldBranchSnapshot;
  beforeDocument: DrawingDocument;
  afterDocument: DrawingDocument;
}

export class CounterfactualWorldService {
  readonly #compiler: WorldModelCompiler;
  readonly #handleFactory: () => string;
  readonly #now: () => number;
  readonly #branches = new Map<string, StoredBranch>();

  constructor(input: {
    compiler?: WorldModelCompiler;
    handleFactory?: () => string;
    now?: () => number;
  } = {}) {
    this.#compiler = input.compiler ?? new WorldModelCompiler();
    this.#handleFactory = input.handleFactory ?? (() => `counterfactual_${randomUUID()}`);
    this.#now = input.now ?? Date.now;
  }

  create(input: {
    runId?: string;
    baseDocument: DrawingDocument;
    baseRevision: RevisionId;
    preview: ReadyPreview;
    transactionDigest: string;
  }): CounterfactualWorldBranch {
    if (input.preview.preview.baseRevision !== input.baseRevision) {
      throw new Error('COUNTERFACTUAL_SCOPE_MISMATCH');
    }
    if (!/^sha256:[a-f0-9]{64}$/i.test(input.transactionDigest)) {
      throw new Error('COUNTERFACTUAL_DIGEST_INVALID');
    }
    const changedNodeIds = [...input.preview.preview.affectedNodeIds].sort();
    const affectedBounds = affectedScopeBounds(
      input.baseDocument,
      input.preview.resultingDocument,
      changedNodeIds,
    );
    const scopeBounds = expandRelative(affectedBounds, input.baseDocument, 0.02);
    const localNodeIds = relevantGeometryIds(
      input.baseDocument,
      input.preview.resultingDocument,
      scopeBounds,
      changedNodeIds,
    );
    const beforeWorld = this.#compiler.compile(input.baseDocument, input.baseRevision, {
      nodeIds: localNodeIds.before,
      bounds: scopeBounds,
      limit: Math.max(1, localNodeIds.before.length),
    });
    const afterWorld = this.#compiler.compile(input.preview.resultingDocument, input.baseRevision, {
      nodeIds: localNodeIds.after,
      bounds: scopeBounds,
      limit: Math.max(1, localNodeIds.after.length),
    });
    const nodeDelta = changedNodeDelta(input.baseDocument, input.preview.resultingDocument);
    const id = this.#handleFactory();
    const beforeDocumentHandle = `${id}:before`;
    const afterDocumentHandle = `${id}:after`;
    const branch: CounterfactualWorldBranchSnapshot = {
      id,
      ...(input.runId ? { runId: input.runId } : {}),
      drawingId: input.baseDocument.id,
      baseRevision: input.baseRevision,
      transactionDigest: input.transactionDigest,
      affectedScope: { nodeIds: changedNodeIds, bounds: scopeBounds },
      beforeWorld,
      afterWorld,
      delta: {
        changedNodeIds: nodeDelta.changed,
        addedNodeIds: nodeDelta.added,
        updatedNodeIds: nodeDelta.updated,
        deletedNodeIds: nodeDelta.deleted,
        unchangedNodeCount: allNodes(input.baseDocument).length - nodeDelta.updated.length - nodeDelta.deleted.length,
        beforeSourceSpanCount: beforeWorld.sourceSpans.length,
        afterSourceSpanCount: afterWorld.sourceSpans.length,
        incidenceDelta: afterWorld.incidenceEdges.length - beforeWorld.incidenceEdges.length,
        connectedDelta: afterWorld.connectedEdges.length - beforeWorld.connectedEdges.length,
        diagnosticCodes: [...new Set([
          ...beforeWorld.diagnostics.map((diagnostic) => diagnostic.code),
          ...afterWorld.diagnostics.map((diagnostic) => diagnostic.code),
        ])],
      },
      createdAt: this.#now(),
      beforeDocumentHandle,
      afterDocumentHandle,
    };
    this.#branches.set(id, {
      branch,
      beforeDocument: structuredClone(input.baseDocument),
      afterDocument: structuredClone(input.preview.resultingDocument),
    });
    return publicBranch(branch);
  }

  get(
    id: string,
    expected: { revision: RevisionId; transactionDigest: string },
  ): CounterfactualWorldBranch {
    const stored = this.#branches.get(id);
    if (!stored) throw new Error('COUNTERFACTUAL_NOT_FOUND');
    if (stored.branch.baseRevision !== expected.revision
      || stored.branch.transactionDigest !== expected.transactionDigest) {
      throw new Error('COUNTERFACTUAL_STALE');
    }
    return publicBranch(stored.branch);
  }

  readDocument(handle: string): DrawingDocument | null {
    for (const stored of this.#branches.values()) {
      if (stored.branch.beforeDocumentHandle === handle) return structuredClone(stored.beforeDocument);
      if (stored.branch.afterDocumentHandle === handle) return structuredClone(stored.afterDocument);
    }
    return null;
  }

  discard(id: string): boolean {
    return this.#branches.delete(id);
  }

  discardRun(runId: string): number {
    let discarded = 0;
    for (const [id, stored] of this.#branches) {
      if (stored.branch.runId !== runId) continue;
      this.#branches.delete(id);
      discarded += 1;
    }
    return discarded;
  }

  snapshot(): { branchCount: number; documentCount: number } {
    return { branchCount: this.#branches.size, documentCount: this.#branches.size * 2 };
  }
}

function publicBranch(branch: CounterfactualWorldBranchSnapshot): CounterfactualWorldBranch {
  const { beforeDocumentHandle: _before, afterDocumentHandle: _after, ...publicValue } = branch;
  return structuredClone(publicValue);
}

function affectedScopeBounds(
  before: DrawingDocument,
  after: DrawingDocument,
  nodeIds: string[],
): Bounds2D {
  const bounds = nodeIds.flatMap((nodeId) => {
    const beforeBounds = nodeBounds(findNode(before, nodeId));
    const afterBounds = nodeBounds(findNode(after, nodeId));
    return [beforeBounds, afterBounds].filter((item): item is Bounds2D => Boolean(item));
  });
  return unionBounds(bounds) ?? documentBounds(before) ?? documentBounds(after) ?? {
    minX: -1,
    minY: -1,
    maxX: 1,
    maxY: 1,
  };
}

function relevantGeometryIds(
  before: DrawingDocument,
  after: DrawingDocument,
  bounds: Bounds2D,
  changedNodeIds: string[],
): { before: string[]; after: string[] } {
  const changed = new Set(changedNodeIds);
  const select = (document: DrawingDocument) => document.geometry
    .filter((node) => changed.has(node.id) || intersects(node, bounds))
    .map((node) => node.id as string);
  return { before: select(before), after: select(after) };
}

function changedNodeDelta(before: DrawingDocument, after: DrawingDocument): {
  changed: string[];
  added: string[];
  updated: string[];
  deleted: string[];
} {
  const beforeNodes = new Map(allNodes(before).map((node) => [node.id as string, node]));
  const afterNodes = new Map(allNodes(after).map((node) => [node.id as string, node]));
  const ids = [...new Set([...beforeNodes.keys(), ...afterNodes.keys()])].sort();
  const added = ids.filter((id) => !beforeNodes.has(id));
  const deleted = ids.filter((id) => !afterNodes.has(id));
  const updated = ids.filter((id) => beforeNodes.has(id) && afterNodes.has(id)
    && JSON.stringify(beforeNodes.get(id)) !== JSON.stringify(afterNodes.get(id)));
  return { changed: [...new Set([...added, ...updated, ...deleted])].sort(), added, updated, deleted };
}

function allNodes(document: DrawingDocument): DrawingNode[] {
  return [
    ...document.geometry,
    ...document.annotations,
    ...document.relations,
    ...document.features,
  ];
}

function findNode(document: DrawingDocument, id: string): DrawingNode | undefined {
  return allNodes(document).find((node) => node.id === id);
}

function nodeBounds(node: DrawingNode | undefined): Bounds2D | null {
  if (!node) return null;
  if (isGeometry(node)) return geometryBounds(node);
  if (node.type === 'text' || node.type === 'dimension') return annotationBounds(node);
  return null;
}

function isGeometry(node: DrawingNode): node is GeometryNode {
  return new Set(['point', 'line', 'ray', 'xline', 'circle', 'arc', 'ellipse', 'polyline', 'spline'])
    .has(node.type);
}

function intersects(node: GeometryNode, bounds: Bounds2D): boolean {
  const nodeBoundsValue = geometryBounds(node, bounds);
  return Boolean(nodeBoundsValue && boundsOverlap(nodeBoundsValue, bounds));
}

function boundsOverlap(first: Bounds2D, second: Bounds2D): boolean {
  return first.minX <= second.maxX && first.maxX >= second.minX
    && first.minY <= second.maxY && first.maxY >= second.minY;
}

function documentBounds(document: DrawingDocument): Bounds2D | undefined {
  return unionBounds(document.geometry
    .map((node) => geometryBounds(node))
    .filter((item): item is Bounds2D => Boolean(item)));
}

function expandRelative(
  affected: Bounds2D,
  document: DrawingDocument,
  ratio: number,
): Bounds2D {
  const global = documentBounds(document) ?? affected;
  const globalDiagonal = Math.hypot(global.maxX - global.minX, global.maxY - global.minY);
  const affectedDiagonal = Math.hypot(
    affected.maxX - affected.minX,
    affected.maxY - affected.minY,
  );
  const padding = Math.max(globalDiagonal * ratio, affectedDiagonal * 0.1, 1e-6);
  return {
    minX: affected.minX - padding,
    minY: affected.minY - padding,
    maxX: affected.maxX + padding,
    maxY: affected.maxY + padding,
  };
}
