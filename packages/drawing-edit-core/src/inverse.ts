// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument } from '@vectorai/drawing-core';
import type { DrawingTransactionCommand } from '@vectorai/drawing-edit-protocol';

import { applyDrawingTransaction, findDrawingNode, withDimensionLayoutOwnership } from './document-transaction';

export function invertDrawingTransaction(
  document: DrawingDocument,
  forward: readonly DrawingTransactionCommand[],
): DrawingTransactionCommand[] {
  let working = structuredClone(document);
  const inverses: DrawingTransactionCommand[][] = [];
  for (const command of forward) {
    inverses.push(inverseFor(working, command));
    working = applyDrawingTransaction(working, [command], working.metadata.updatedAt);
  }
  return inverses.reverse().flat();
}

function inverseFor(
  document: DrawingDocument,
  command: DrawingTransactionCommand,
): DrawingTransactionCommand[] {
  if (command.type === 'node.create') return [{ type: 'node.delete', id: command.node.id }];
  const located = findDrawingNode(document, command.id);
  if (!located) throw new Error('EDIT_NODE_NOT_FOUND');
  if (command.type === 'node.delete') {
    return [{
      type: 'node.create',
      plane: located.plane,
      node: structuredClone(located.node) as never,
    }];
  }
  if (command.type === 'annotation.move-text') {
    if (located.node.type === 'dimension') {
      return [inverseUpdate(
        located.node as unknown as Record<string, unknown>, command.id, { textPosition: command.position },
      )];
    }
    return [{
      type: 'annotation.move-text',
      id: command.id,
      position: structuredClone(command.expectedPosition),
      expectedPosition: structuredClone(command.position),
    }];
  }
  const node = located.node as unknown as Record<string, unknown>;
  return [inverseUpdate(node, command.id, command.changes)];
}

function inverseUpdate(
  node: Record<string, unknown>,
  id: string,
  requestedChanges: Record<string, unknown>,
): DrawingTransactionCommand {
  const changes = withDimensionLayoutOwnership(node, requestedChanges);
  return {
    type: 'node.update',
    id,
    changes: Object.fromEntries(Object.keys(changes).map((key) => [
      key, node.type === 'dimension' && key === 'layout' ? structuredClone(node[key] ?? null) : structuredClone(node[key]),
    ])) as never,
    expected: structuredClone(changes),
  };
}
