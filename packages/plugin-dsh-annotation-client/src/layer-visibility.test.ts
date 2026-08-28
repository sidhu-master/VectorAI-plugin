// SPDX-License-Identifier: Apache-2.0

import type { DrawingLayerDefinition } from '@vectorai/drawing-surface-api';
import { describe, expect, it } from 'vitest';

import { ANNOTATION_PARTITION_LAYER } from './drawing-layers';
import {
  layerVisibilityStorageKey,
  readLayerVisibility,
  writeLayerVisibility,
} from './layer-visibility';

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const futureLayer: DrawingLayerDefinition = {
  id: 'vectorai.annotation.angle',
  label: '开角标注',
  category: 'engineering',
  icon: 'angle',
  order: 200,
  defaultVisible: true,
};

describe('annotation layer visibility', () => {
  it('uses each registered layer default and ignores unknown saved IDs', () => {
    const storage = new MemoryStorage();
    storage.setItem(layerVisibilityStorageKey('one'), JSON.stringify({
      'vectorai.annotation.partition': false,
      'unknown.layer': false,
    }));

    expect(readLayerVisibility('one', [ANNOTATION_PARTITION_LAYER, futureLayer], storage))
      .toEqual({
        'vectorai.annotation.partition': false,
        'vectorai.annotation.angle': true,
      });
  });

  it('migrates the legacy partition preference without leaking between sessions', () => {
    const storage = new MemoryStorage();
    storage.setItem('vectorai:annotation:partition-overlay:one', 'hidden');

    expect(readLayerVisibility('one', [ANNOTATION_PARTITION_LAYER], storage))
      .toEqual({ 'vectorai.annotation.partition': false });
    expect(readLayerVisibility('two', [ANNOTATION_PARTITION_LAYER], storage))
      .toEqual({ 'vectorai.annotation.partition': true });
  });

  it('writes only the new session map and safely handles malformed state', () => {
    const storage = new MemoryStorage();
    storage.setItem(layerVisibilityStorageKey('one'), '{broken');
    expect(readLayerVisibility('one', [ANNOTATION_PARTITION_LAYER], storage))
      .toEqual({ 'vectorai.annotation.partition': true });

    writeLayerVisibility('one', {
      'vectorai.annotation.partition': false,
    }, storage);
    expect(storage.getItem(layerVisibilityStorageKey('one')))
      .toBe('{"vectorai.annotation.partition":false}');
    expect(storage.getItem('vectorai:annotation:partition-overlay:one')).toBeNull();
  });
});

