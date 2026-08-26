// SPDX-License-Identifier: Apache-2.0

import type { PartitionRevision } from '@vectorai/plugin-space-contracts';
import TestRenderer, { act } from 'react-test-renderer';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmedPartitionInspector } from './ConfirmedPartitionInspector';

const revision: PartitionRevision = {
  version: 1, id: 'partition-r1', drawingRef: { drawingId: 'd', revision: 1 }, confirmedAt: 1_700_000_000_000,
  axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 20, orientation: 'forward' },
  segments: [
    { id: 's1', name: '左轴承位', zStart: 0, zEnd: 8, profile: { minRadius: 4, maxRadius: 5, sampleCount: 2 }, boundaryConfidence: 1, geometryNodeIds: [], boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [] },
    { id: 's2', name: '主轮齿轴段', zStart: 8, zEnd: 20, profile: { minRadius: 6, maxRadius: 7, sampleCount: 2 }, boundaryConfidence: 1, geometryNodeIds: [], boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [] },
  ],
  semanticGroups: [
    { id: 'bearing', segmentIds: ['s1'], semanticType: 'bearing-seat', name: '左轴承位', evidenceIds: [] },
  ], evidence: [], diagnostics: [],
};

describe('ConfirmedPartitionInspector', () => {
  it('shows the confirmed structure and explicitly reopens it for editing', async () => {
    const reopen = vi.fn(async () => undefined);
    const renderer = TestRenderer.create(<ConfirmedPartitionInspector revision={revision} busy={false} mode="functional" onModeChange={() => undefined} onReopen={reopen} />);
    const markup = renderToStaticMarkup(<ConfirmedPartitionInspector revision={revision} busy={false} mode="functional" onModeChange={() => undefined} onReopen={reopen} />);
    expect(markup).toContain('partition-r1');
    expect(markup).toContain('左轴承位');
    expect(markup).not.toContain('主轮齿轴段');
    expect(markup).toContain('⌀10.00');
    await act(async () => { await renderer.root.findByProps({ 'aria-label': '重新编辑分区' }).props.onClick(); });
    expect(reopen).toHaveBeenCalledOnce();
  });
});
