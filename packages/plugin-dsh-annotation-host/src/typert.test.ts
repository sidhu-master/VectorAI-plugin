// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { TYPERT } from './typert';

describe('annotation TYPERT contribution', () => {
  it('publishes the readonly session projection and explicit partition workflow', () => {
    expect(TYPERT.invocations.map(({ method }) => method)).toEqual([
      'getSessionState', 'importDrawing', 'stageDocuments', 'clearDocuments', 'importAndAnalyze', 'supplementDocuments', 'getPartitionState', 'editPartition',
      'confirmPartition', 'cancelPartition', 'reopenPartition', 'undoPartition', 'redoPartition',
      'getDimensionPlan', 'editDimensionScheme', 'editGeometricTolerance', 'confirmDimensionPlan', 'cancelDimensionPlan', 'undoDimensionPlan', 'redoDimensionPlan',
      'queryToleranceCatalog', 'previewTolerance', 'editTolerance',
    ]);
    expect(TYPERT.invocations[0]?.result.schema).toHaveProperty('_zod');
    const query = TYPERT.invocations.find(({ method }) => method === 'queryToleranceCatalog');
    const preview = TYPERT.invocations.find(({ method }) => method === 'previewTolerance');
    expect(query?.parameters[1]).toMatchObject({ codec: { mode: 'strict' } });
    expect(query?.result.typeSymbol).toBe('@vectorai/plugin-space-contracts#ToleranceCatalogResult');
    expect(preview?.result.typeSymbol).toBe('@vectorai/plugin-space-contracts#TolerancePreviewResult');
  });
});
