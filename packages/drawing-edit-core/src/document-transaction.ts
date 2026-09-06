// SPDX-License-Identifier: Apache-2.0

import type {
  AnnotationNode,
  DrawingDocument,
  DrawingRelation,
  GeometryNode,
  SemanticFeature,
} from '@vectorai/drawing-core';
import type { DrawingTransactionCommand } from '@vectorai/drawing-edit-protocol';

type Plane = 'geometry' | 'annotation' | 'relation' | 'feature';

export function applyDrawingTransaction(
  source: DrawingDocument,
  commands: readonly DrawingTransactionCommand[],
  now: number,
): DrawingDocument {
  const document = structuredClone(source);
  for (const command of commands) applyCommand(document, command);
  validateDocument(document);
  document.metadata.updatedAt = now;
  return document;
}

export function findDrawingNode(document: DrawingDocument, id: string): {
  plane: Plane;
  node: GeometryNode | AnnotationNode | DrawingRelation | SemanticFeature;
} | null {
  for (const plane of ['geometry', 'annotation', 'relation', 'feature'] as const) {
    const collection = collectionFor(document, plane) as Array<{ id: string }>;
    const node = collection.find((candidate) => candidate.id === id);
    if (node) return { plane, node: node as never };
  }
  return null;
}

function applyCommand(document: DrawingDocument, command: DrawingTransactionCommand): void {
  if (command.type === 'node.create') {
    if (findDrawingNode(document, command.node.id)) throw new Error('EDIT_NODE_ALREADY_EXISTS');
    const collection = collectionFor(document, command.plane) as unknown[];
    collection.push(structuredClone(command.node));
    return;
  }
  const located = findDrawingNode(document, command.id);
  if (!located) throw new Error('EDIT_NODE_NOT_FOUND');
  if (command.type === 'node.delete') {
    const collection = collectionFor(document, located.plane) as Array<{ id: string }>;
    const index = collection.findIndex(({ id }) => id === command.id);
    collection.splice(index, 1);
    removeReferences(document, command.id);
    return;
  }
  if (command.type === 'annotation.move-text') {
    if (located.plane !== 'annotation') throw new Error('EDIT_NODE_TYPE_MISMATCH');
    const node = located.node as unknown as Record<string, unknown>;
    const key = node.type === 'text' ? 'position' : 'textPosition';
    assertExpected(node[key], command.expectedPosition);
    Object.assign(node, structuredClone(withDimensionLayoutOwnership(node, { [key]: command.position })));
    return;
  }
  const node = located.node as unknown as Record<string, unknown>;
  for (const [key, expected] of Object.entries(command.expected)) {
    assertExpected(node[key], node.type === 'dimension' && key === 'layout' && expected === null ? undefined : expected);
  }
  for (const [key, value] of Object.entries(withDimensionLayoutOwnership(node, command.changes))) {
    // JSON-safe transaction sentinel: undo removes metadata from legacy records.
    if (node.type === 'dimension' && key === 'layout' && value === null) delete node.layout;
    else node[key] = structuredClone(value);
  }
}

/** Placement edits take ownership; semantic edits and zero-distance moves do not. */
export function withDimensionLayoutOwnership(
  node: Record<string, unknown>,
  changes: Record<string, unknown>,
): Record<string, unknown> {
  if (node.type !== 'dimension' || Object.prototype.hasOwnProperty.call(changes, 'layout')) return changes;
  const moved = ['textPosition', 'definitionPoints'].some((key) => (
    Object.prototype.hasOwnProperty.call(changes, key) && JSON.stringify(node[key]) !== JSON.stringify(changes[key])
  ));
  return moved ? { ...changes, layout: { ...(node.layout as object | undefined), mode: 'manual' } } : changes;
}

function collectionFor(document: DrawingDocument, plane: Plane): unknown[] {
  if (plane === 'geometry') return document.geometry;
  if (plane === 'annotation') return document.annotations;
  if (plane === 'relation') return document.relations;
  return document.features;
}

function removeReferences(document: DrawingDocument, id: string): void {
  document.relations = document.relations.filter((relation) => {
    if (relation.type === 'topology') return !relation.nodeIds.includes(id);
    if (relation.type === 'constraint') return !relation.geometryIds.includes(id as never);
    if (relation.type === 'association') {
      return relation.annotationId !== id && !relation.geometryIds.includes(id as never);
    }
    return relation.featureId !== id && !relation.nodeIds.includes(id);
  });
  document.features = document.features.filter((feature) => feature.id !== id).map((feature) => ({
    ...feature,
    geometryIds: feature.geometryIds.filter((nodeId) => nodeId !== id),
    annotationIds: feature.annotationIds.filter((nodeId) => nodeId !== id),
    relationIds: feature.relationIds.filter((nodeId) => nodeId !== id),
  }));
}

function validateDocument(document: DrawingDocument): void {
  const ids = [
    ...document.geometry.map(({ id }) => id),
    ...document.annotations.map(({ id }) => id),
    ...document.relations.map(({ id }) => id),
    ...document.features.map(({ id }) => id),
  ].map(String);
  if (new Set(ids).size !== ids.length) throw new Error('EDIT_DUPLICATE_NODE_ID');
  const geometry = new Set(document.geometry.map(({ id }) => id));
  const annotation = new Set(document.annotations.map(({ id }) => id));
  const feature = new Set(document.features.map(({ id }) => id));
  for (const node of document.annotations) {
    if (node.type === 'leader' && node.branches?.some(({ target }) => !geometry.has(target.geometryId))) {
      throw new Error('EDIT_DANGLING_REFERENCE');
    }
  }
  for (const relation of document.relations) {
    const valid = relation.type === 'topology'
      ? relation.nodeIds.every((id) => ids.includes(String(id)))
      : relation.type === 'constraint'
        ? relation.geometryIds.every((id) => geometry.has(id))
        : relation.type === 'association'
          ? annotation.has(relation.annotationId) && relation.geometryIds.every((id) => geometry.has(id))
          : feature.has(relation.featureId) && relation.nodeIds.every((id) => ids.includes(String(id)));
    if (!valid) throw new Error('EDIT_DANGLING_REFERENCE');
  }
}

function assertExpected(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('EDIT_PRECONDITION_FAILED');
}
