// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument } from '@vectorai/drawing-core';

export function canonicalString(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function canonicalSemanticString(document: DrawingDocument): string {
  const semantic = Object.fromEntries(
    Object.entries(document).filter(([key]) => key !== 'metadata'),
  ) as Record<string, unknown>;
  for (const plane of ['geometry', 'annotations', 'relations', 'features'] as const) {
    semantic[plane] = [...document[plane]].sort((left, right) => String(left.id).localeCompare(String(right.id)));
  }
  return canonicalString(semantic);
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, normalize(item)]));
  }
  if (typeof value === 'number' && Object.is(value, -0)) return 0;
  return value;
}
