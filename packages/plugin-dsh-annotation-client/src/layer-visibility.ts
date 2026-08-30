// SPDX-License-Identifier: Apache-2.0

import type { DrawingLayerDefinition } from '@vectorai/drawing-surface-api';

import { ANNOTATION_PARTITION_LAYER_ID } from './drawing-layers';

export type DrawingLayerVisibilityMap = Readonly<Record<string, boolean>>;
type LayerVisibilityStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function layerVisibilityStorageKey(sessionId: string): string {
  return `vectorai:annotation:layer-visibility:${sessionId}`;
}

function legacyPartitionVisibilityKey(sessionId: string): string {
  return `vectorai:annotation:partition-overlay:${sessionId}`;
}

export function readLayerVisibility(
  sessionId: string,
  definitions: readonly DrawingLayerDefinition[],
  storage: LayerVisibilityStorage | null | undefined,
): Record<string, boolean> {
  const saved = readSavedMap(sessionId, storage);
  const result: Record<string, boolean> = {};
  for (const definition of definitions) {
    const savedValue = saved[definition.id];
    if (typeof savedValue === 'boolean') {
      result[definition.id] = savedValue;
      continue;
    }
    if (definition.id === ANNOTATION_PARTITION_LAYER_ID) {
      const legacy = readLegacyPartitionVisibility(sessionId, storage);
      if (legacy !== null) {
        result[definition.id] = legacy;
        continue;
      }
    }
    result[definition.id] = definition.defaultVisible;
  }
  return result;
}

export function writeLayerVisibility(
  sessionId: string,
  values: DrawingLayerVisibilityMap,
  storage: LayerVisibilityStorage | null | undefined,
): void {
  if (storage === null || storage === undefined) return;
  try {
    storage.setItem(layerVisibilityStorageKey(sessionId), JSON.stringify(values));
  } catch {
    // Visibility is a non-critical view preference when WebView storage is unavailable.
  }
}

function readSavedMap(
  sessionId: string,
  storage: LayerVisibilityStorage | null | undefined,
): Record<string, unknown> {
  if (storage === null || storage === undefined) return {};
  try {
    const raw = storage.getItem(layerVisibilityStorageKey(sessionId));
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function readLegacyPartitionVisibility(
  sessionId: string,
  storage: LayerVisibilityStorage | null | undefined,
): boolean | null {
  if (storage === null || storage === undefined) return null;
  try {
    const value = storage.getItem(legacyPartitionVisibilityKey(sessionId));
    if (value === 'hidden') return false;
    if (value === 'visible') return true;
    return null;
  } catch {
    return null;
  }
}
