// SPDX-License-Identifier: Apache-2.0

import type { PartitionDraft } from '@vectorai/plugin-space-contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import type { PartitionController } from './partition-controller';
import { PartitionInspector } from './PartitionInspector';

const draft: PartitionDraft = {
  version: 1, drawingRef: { drawingId: 'd', revision: 1 },
  axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 20, orientation: 'forward' },
  segments: [
    { id: 's1', zStart: 0, zEnd: 8, profile: { minRadius: 4, maxRadius: 5, sampleCount: 2 }, boundaryConfidence: 1, geometryNodeIds: [], boundaryEvidenceIds: [], semanticEvidenceIds: ['e1'], diagnosticIds: [] },
    { id: 's2', zStart: 8, zEnd: 10, profile: { minRadius: 5, maxRadius: 6, sampleCount: 2 }, boundaryConfidence: 1, geometryNodeIds: [], boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [] },
    { id: 's3', zStart: 10, zEnd: 20, profile: { minRadius: 6, maxRadius: 7, sampleCount: 2 }, boundaryConfidence: 1, geometryNodeIds: [], boundaryEvidenceIds: [], semanticEvidenceIds: ['e2'], diagnosticIds: [] },
  ],
  semanticGroups: [
    { id: 'g1', segmentIds: ['s1'], semanticType: 'bearing-seat', name: '左轴承位', evidenceIds: ['e1'] },
    { id: 'g2', segmentIds: ['s3'], semanticType: 'gear', name: '齿轮区域', evidenceIds: ['e2'] },
  ],
  stepCandidates: [], evidence: [
    { id: 'e1', origin: 'document', label: '左轴承位' },
    { id: 'e2', origin: 'ai', label: '齿轮区域' },
  ], diagnostics: [],
};

describe('PartitionInspector', () => {
  it('shows sparse function regions by default without presenting transition segments as functions', () => {
    const markup = renderToStaticMarkup(<PartitionInspector draft={draft} controller={{} as PartitionController} mode="functional" onModeChange={() => undefined} />);
    expect(markup).toContain('功能分区');
    expect(markup).toContain('左轴承位');
    expect(markup).toContain('齿轮区域');
    expect(markup).toContain('未归入功能区的过渡轴段：1 段');
    expect(markup).not.toContain('轴段 S2');
  });

  it('switches to the complete axial segment list explicitly', () => {
    const change = vi.fn();
    const renderer = TestRenderer.create(<PartitionInspector draft={draft} controller={{} as PartitionController} mode="functional" onModeChange={change} />);
    act(() => renderer.root.findByProps({ 'aria-label': '显示连续轴段' }).props.onClick());
    expect(change).toHaveBeenCalledWith('segments');
  });
});
