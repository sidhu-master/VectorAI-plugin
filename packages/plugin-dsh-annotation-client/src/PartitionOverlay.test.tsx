// SPDX-License-Identifier: Apache-2.0

import type { PartitionDraft } from '@vectorai/plugin-space-contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { PartitionOverlay } from './PartitionOverlay';

function draft(): PartitionDraft {
  const bounds = [0, 17, 53, 92, 147, 150, 173];
  const radii = [22.29, 25.5, 28.15, 28.515, 27.96, 24];
  const origins = ['document', 'document', 'document', 'ai', 'ai', 'document'] as const;
  return {
    version: 1,
    drawingRef: { drawingId: 'drawing-1', revision: 1 },
    axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 173, orientation: 'forward' },
    segments: radii.map((radius, index) => ({
      id: `segment:${index + 1}`,
      name: ['左轴承位', '外花键', '一级齿轮', '右主轴段', '右主轴段', '右轴承位'][index],
      zStart: bounds[index]!, zEnd: bounds[index + 1]!,
      profile: { minRadius: radius, maxRadius: radius, sampleCount: 2 },
      boundaryConfidence: 1,
      geometryNodeIds: [], boundaryEvidenceIds: [],
      semanticEvidenceIds: [`evidence:${index + 1}`], diagnosticIds: [],
    })),
    semanticGroups: [], stepCandidates: [],
    evidence: origins.map((origin, index) => ({ id: `evidence:${index + 1}`, origin, label: origin })),
    diagnostics: [],
  };
}

describe('PartitionOverlay', () => {
  it('defaults to semantic function groups and preserves gaps between them', () => {
    const value = draft();
    value.semanticGroups = [
      { id: 'left-bearing', segmentIds: ['segment:1'], semanticType: 'bearing-seat', name: '左轴承位', evidenceIds: ['evidence:1'] },
      { id: 'gear', segmentIds: ['segment:3'], semanticType: 'gear', name: '一级齿轮', evidenceIds: ['evidence:3'] },
    ];
    const markup = renderToStaticMarkup(<svg><PartitionOverlay
      draft={value} mode="functional" previewHeld={false} scale={2} onMoveBoundary={() => undefined}
    /></svg>);

    expect((markup.match(/data-partition-band=/g) ?? [])).toHaveLength(2);
    expect(markup).toContain('data-partition-id="left-bearing"');
    expect(markup).toContain('data-partition-id="gear"');
    expect(markup).not.toContain('data-segment-ids="segment:2"');
  });

  it('keeps every detected step as an independent draggable partition', () => {
    const value = draft();
    const markup = renderToStaticMarkup(<svg><PartitionOverlay
      draft={value}
      mode="segments"
      previewHeld={false}
      scale={2}
      onMoveBoundary={() => undefined}
    /></svg>);

    expect(value.segments).toHaveLength(6);
    expect((markup.match(/data-partition-band=/g) ?? [])).toHaveLength(6);
    expect(markup).toContain('data-segment-ids="segment:4"');
    expect(markup).toContain('data-segment-ids="segment:5"');
    expect(markup).not.toContain('data-segment-ids="segment:4 segment:5"');
    expect((markup.match(/class="vai-partition-label"/g) ?? [])).toHaveLength(6);
    expect(markup).toContain('>左轴承位</text>');
    expect(markup).toContain('>右主轴段</text>');
    expect((markup.match(/aria-label="移动分区边界/g) ?? [])).toHaveLength(5);
    expect(markup).toContain('data-handle-lane="-1"');
    expect(markup).toContain('data-handle-lane="1"');
    expect((markup.match(/class="vai-partition-handle-leader"/g) ?? [])).toHaveLength(2);
  });

  it('owns the pointer and previews both adjacent bands before committing the boundary', async () => {
    const onMoveBoundary = vi.fn(async () => undefined);
    const renderer = TestRenderer.create(<svg><PartitionOverlay
      draft={draft()} previewHeld={false} scale={2} onMoveBoundary={onMoveBoundary}
      mode="segments"
    /></svg>);
    const handle = renderer.root.findByProps({ 'aria-label': '移动分区边界 1' });
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();

    act(() => handle.props.onPointerDown({
      pointerId: 7, clientX: 100, clientY: 40, preventDefault, stopPropagation,
      currentTarget: { setPointerCapture },
    }));
    act(() => handle.props.onPointerMove({
      pointerId: 7, clientX: 120, clientY: 40, preventDefault, stopPropagation,
    }));

    const movingPolygons = renderer.root.findAll((node) => node.type === 'polygon' && Boolean(node.props['data-partition-band']));
    expect(movingPolygons[0]!.props.points).toContain('27,-');
    expect(movingPolygons[1]!.props.points).toContain('27,-');
    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    expect(setPointerCapture).toHaveBeenCalledWith(7);

    await act(async () => handle.props.onPointerUp({
      pointerId: 7, preventDefault, stopPropagation,
      currentTarget: { releasePointerCapture },
    }));
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
    expect(onMoveBoundary).toHaveBeenCalledWith(1, 27);
  });

  it('commits the last preview when the native host ends the gesture with pointercancel', async () => {
    const onMoveBoundary = vi.fn(async () => undefined);
    const renderer = TestRenderer.create(<svg><PartitionOverlay
      draft={draft()} previewHeld={false} scale={2} onMoveBoundary={onMoveBoundary}
      mode="segments"
    /></svg>);
    const handle = renderer.root.findByProps({ 'aria-label': '移动分区边界 1' });
    const event = { pointerId: 8, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    act(() => handle.props.onPointerDown({ ...event, clientX: 100, clientY: 40, currentTarget: { setPointerCapture: vi.fn() } }));
    act(() => handle.props.onPointerMove({ ...event, clientX: 120, clientY: 40 }));
    await act(async () => handle.props.onPointerCancel({ ...event, currentTarget: { releasePointerCapture: vi.fn() } }));
    expect(onMoveBoundary).toHaveBeenCalledWith(1, 27);
  });

  it('keeps the dragged boundary visible when persistence fails', async () => {
    const renderer = TestRenderer.create(<svg><PartitionOverlay
      draft={draft()} previewHeld={false} scale={2} onMoveBoundary={() => Promise.reject(new Error('transport'))}
      mode="segments"
    /></svg>);
    const handle = renderer.root.findByProps({ 'aria-label': '移动分区边界 1' });
    const event = { pointerId: 9, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    act(() => handle.props.onPointerDown({ ...event, clientX: 100, clientY: 40, currentTarget: { setPointerCapture: vi.fn() } }));
    act(() => handle.props.onPointerMove({ ...event, clientX: 120, clientY: 40 }));
    await act(async () => handle.props.onPointerUp({ ...event, currentTarget: { releasePointerCapture: vi.fn() } }));
    expect(renderer.root.findAll((node) => node.type === 'polygon' && Boolean(node.props['data-partition-band']))[0]!.props.points).toContain('27,-');
  });
});
