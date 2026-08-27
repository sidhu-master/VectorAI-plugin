// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { TYPERT } from './typert';

describe('annotation TYPERT contribution', () => {
  it('publishes the readonly session projection and explicit partition workflow', () => {
    expect(TYPERT.invocations.map(({ method }) => method)).toEqual([
      'getSessionState', 'importDrawing', 'importAndAnalyze', 'supplementDocuments', 'getPartitionState', 'editPartition',
      'confirmPartition', 'cancelPartition', 'reopenPartition', 'undoPartition', 'redoPartition',
    ]);
    expect(TYPERT.invocations[0]?.result.schema).toHaveProperty('_zod');
  });
});
