import { createHash } from 'node:crypto';

import type { DrawingDocument } from '../../../src/drawing/index.js';

export interface PreserveReport {
  satisfied: boolean;
  changedNodeIds: string[];
  missingNodeIds: string[];
}

export type PreservedNodeHashes = Record<string, string>;

export function drawingNodeContentHash(node: unknown): string {
  return createHash('sha256').update(canonicalJson(node)).digest('hex');
}

export function collectPreservedNodeHashes(
  document: DrawingDocument,
  nodeIds: readonly string[],
): PreservedNodeHashes {
  return Object.fromEntries([...new Set(nodeIds)].map((id) => {
    const node = findNode(document, id);
    if (!node) throw new Error(`PRESERVED_NODE_MISSING:${id}`);
    return [id, drawingNodeContentHash(node)];
  }));
}

export function comparePreservedNodeHashes(
  document: DrawingDocument,
  hashes: PreservedNodeHashes,
): PreserveReport {
  const changedNodeIds: string[] = [];
  const missingNodeIds: string[] = [];
  for (const [id, hash] of Object.entries(hashes)) {
    const node = findNode(document, id);
    if (!node) missingNodeIds.push(id);
    else if (drawingNodeContentHash(node) !== hash) changedNodeIds.push(id);
  }
  return {
    satisfied: changedNodeIds.length === 0 && missingNodeIds.length === 0,
    changedNodeIds,
    missingNodeIds,
  };
}

export function comparePreservedNodes(
  before: DrawingDocument,
  after: DrawingDocument,
  preserveNodeIds: readonly string[],
): PreserveReport {
  const changedNodeIds: string[] = [];
  const missingNodeIds: string[] = [];
  for (const id of [...new Set(preserveNodeIds)]) {
    const oldNode = findNode(before, id);
    const nextNode = findNode(after, id);
    if (!oldNode || !nextNode) {
      missingNodeIds.push(id);
      continue;
    }
    if (!deepEqual(oldNode, nextNode)) changedNodeIds.push(id);
  }
  return {
    satisfied: changedNodeIds.length === 0 && missingNodeIds.length === 0,
    changedNodeIds,
    missingNodeIds,
  };
}

function findNode(document: DrawingDocument, id: string): unknown {
  return [
    ...document.geometry,
    ...document.annotations,
    ...document.relations,
    ...document.features,
  ].find((node) => node.id === id);
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right)
      && left.length === right.length
      && left.every((item, index) => deepEqual(item, right[index]));
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const keys = Object.keys(leftRecord);
  return keys.length === Object.keys(rightRecord).length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(rightRecord, key)
      && deepEqual(leftRecord[key], rightRecord[key]));
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  )).join(',')}}`;
}
