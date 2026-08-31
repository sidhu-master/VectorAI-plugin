// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { ANNOTATION_REMOTE } from './remote';

describe('ANNOTATION_REMOTE', () => {
  it('exposes the strict session projection and explicit partition lifecycle', () => {
    expect(ANNOTATION_REMOTE.descriptors.map(({ method }) => method)).toEqual([
      'getSessionState', 'importDrawing', 'stageDocuments', 'clearDocuments', 'importAndAnalyze', 'supplementDocuments', 'getPartitionState', 'editPartition',
      'confirmPartition', 'cancelPartition', 'reopenPartition', 'undoPartition', 'redoPartition',
      'getDimensionPlan', 'editDimensionScheme', 'editGeometricTolerance', 'confirmDimensionPlan', 'cancelDimensionPlan', 'undoDimensionPlan', 'redoDimensionPlan',
      'queryToleranceCatalog', 'previewTolerance', 'editTolerance',
    ]);
    const [descriptor] = ANNOTATION_REMOTE.descriptors;
    expect(descriptor?.method).toBe('getSessionState');
    expect(descriptor?.parameters[0]?.codec.mode).toBe('strict');
    expect(descriptor?.result.mode).toBe('strict');
    if (descriptor?.result.mode !== 'strict') throw new Error('expected strict result codec');
    expect(descriptor.result.schema).toHaveProperty('_zod');
    const query = ANNOTATION_REMOTE.descriptors.find(({ method }) => method === 'queryToleranceCatalog');
    const preview = ANNOTATION_REMOTE.descriptors.find(({ method }) => method === 'previewTolerance');
    const edit = ANNOTATION_REMOTE.descriptors.find(({ method }) => method === 'editTolerance');
    expect(query?.parameters[1]?.codec.mode).toBe('strict');
    expect(query?.result).toMatchObject({ mode: 'strict', typeSymbol: '@vectorai/plugin-space-contracts#ToleranceCatalogResult' });
    expect(preview?.result).toMatchObject({ mode: 'strict', typeSymbol: '@vectorai/plugin-space-contracts#TolerancePreviewResult' });
    expect(edit?.result).toMatchObject({ mode: 'strict', typeSymbol: '@vectorai/plugin-space-contracts#DimensionPlanSessionSnapshot' });
  });
});
