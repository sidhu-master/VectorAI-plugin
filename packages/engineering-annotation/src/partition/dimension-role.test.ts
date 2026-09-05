// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { PartitionDraft, ShaftSemanticGroup } from './types';
import { resolveShaftDimensionRole } from './dimension-role';

describe('resolveShaftDimensionRole', () => {
  it('classifies a relief groove as a transition instead of a functional dimension feature', () => {
    const group: ShaftSemanticGroup = {
      id: 'group:relief', semanticType: 'relief', name: '砂轮越程槽',
      range: { zStart: 198, zEnd: 201 }, segmentIds: ['segment:relief'], evidenceIds: ['document:relief'],
    };
    const partition = {
      version: 1,
      drawingRef: { drawingId: 'drawing:shaft', revision: 1 },
      axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 208, orientation: 'forward' },
      segments: [], semanticGroups: [group], stepCandidates: [],
      evidence: [{ id: 'document:relief', origin: 'document', label: '砂轮越程槽' }], diagnostics: [],
    } satisfies PartitionDraft;

    expect(resolveShaftDimensionRole(group, partition)).toBe('transition');
  });
});
