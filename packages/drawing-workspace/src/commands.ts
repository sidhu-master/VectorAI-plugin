// SPDX-License-Identifier: Apache-2.0

import type { AnnotationNode, DrawingDocument, Vec2 } from '@vectorai/drawing-core';

import type { DrawingWorkspaceCommand } from './contracts';

const IMMUTABLE_NODE_FIELDS = new Set(['id', 'type', 'plane']);

export function buildNodeUpdateCommand(
  document: DrawingDocument,
  id: string,
  changes: Record<string, unknown>,
): DrawingWorkspaceCommand | null {
  const node = findDrawingNode(document, id);
  if (node === null) return null;
  const fields = Object.keys(changes);
  if (fields.length === 0) return null;
  const immutableField = fields.find((field) => IMMUTABLE_NODE_FIELDS.has(field));
  if (immutableField !== undefined) {
    throw new Error(`IMMUTABLE_DRAWING_NODE_FIELD:${immutableField}`);
  }
  const record = node as unknown as Record<string, unknown>;
  return {
    type: 'node.update',
    id,
    changes: clone(changes),
    expected: Object.fromEntries(fields.map((field) => [field, clone(record[field])])),
  };
}

export function buildNodeDeleteCommands(
  document: DrawingDocument,
  ids: string[],
): DrawingWorkspaceCommand[] {
  const uniqueIds = [...new Set(ids)];
  return uniqueIds.flatMap((id) => (
    findDrawingNode(document, id) === null
      ? []
      : [{ type: 'node.delete' as const, id }]
  ));
}

export function buildAnnotationTextMoveCommand(
  document: DrawingDocument,
  id: string,
  position: Vec2,
): DrawingWorkspaceCommand | null {
  const annotation = document.annotations.find((node) => node.id === id);
  if (annotation === undefined) return null;
  const expectedPosition = annotationTextPosition(annotation);
  if (expectedPosition === null) return null;
  return {
    type: 'annotation.move-text',
    id,
    position: [...position] as Vec2,
    expectedPosition: [...expectedPosition] as Vec2,
  };
}

export function findDrawingNode(document: DrawingDocument, id: string): object | null {
  return document.geometry.find((node) => node.id === id)
    ?? document.annotations.find((node) => node.id === id)
    ?? document.relations.find((node) => node.id === id)
    ?? document.features.find((node) => node.id === id)
    ?? null;
}

function annotationTextPosition(annotation: AnnotationNode): Vec2 | null {
  switch (annotation.type) {
    case 'text': return annotation.position;
    case 'dimension': return annotation.textPosition;
    default: return null;
  }
}

function clone<T>(value: T): T {
  return value === undefined ? value : structuredClone(value);
}
