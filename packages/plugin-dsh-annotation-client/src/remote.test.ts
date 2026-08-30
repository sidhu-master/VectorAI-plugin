// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { ANNOTATION_REMOTE } from './remote';

describe('ANNOTATION_REMOTE', () => {
  it('exposes the strict session projection and explicit partition lifecycle', () => {
    expect(ANNOTATION_REMOTE.descriptors.map(({ method }) => method)).toEqual([
      'getSessionState', 'importDrawing', 'stageDocuments', 'clearDocuments', 'importAndAnalyze', 'supplementDocuments', 'getPartitionState', 'editPartition',
      'confirmPartition', 'cancelPartition', 'reopenPartition', 'undoPartition', 'redoPartition',
      'getDimensionPlan', 'editDimensionScheme', 'editGeometricTolerance', 'confirmDimensionPlan', 'cancelDimensionPlan', 'undoDimensionPlan', 'redoDimensionPlan',
    ]);
    const [descriptor] = ANNOTATION_REMOTE.descriptors;
    expect(descriptor?.method).toBe('getSessionState');
    expect(descriptor?.parameters[0]?.codec.mode).toBe('strict');
    expect(descriptor?.result.mode).toBe('strict');
    if (descriptor?.result.mode !== 'strict') throw new Error('expected strict result codec');
    expect(descriptor.result.schema).toHaveProperty('_zod');
  });
});
