// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing } from '@vectorai/drawing-core';
import type { EngineeringAnnotationDraft } from '@vectorai/plugin-space-contracts';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { GdtOverlay } from './GdtOverlay';

function fixture() {
  const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
  document.geometry = [{
    id: 'datum-line' as never, type: 'line' as const, start: [0, 0], end: [100, 20], visible: true,
    quality: { status: 'confirmed' as const, evidenceRefs: [] },
  }];
  const ref = { drawingId: 'drawing-1', revision: 1 };
  const draft = {
    version: 1, drawingRef: ref,
    datums: [{
      id: 'datum:A', drawingRef: ref, name: 'A', geometryId: 'datum-line', anchor: { kind: 'start' },
      role: 'primary', source: 'ai-candidate', status: 'candidate', evidenceIds: [],
    }],
    intents: [], tolerances: [], geometricTolerances: ['circularity', 'cylindricity', 'circular-runout'].map((characteristic, index) => ({
      id: `gdt:${index + 1}`, drawingRef: ref, characteristic,
      controlledTargets: [{ geometryId: 'datum-line', anchor: { kind: 'end' } }],
      toleranceZone: { shape: 'linear' }, datumReferenceFrame: index === 2 ? [{ datumId: 'datum:A' }] : [],
      computed: { status: 'resolved', unit: 'mm', diagnostics: [] },
      framePosition: [200, 100], source: 'ai-candidate', status: 'resolved', evidenceIds: [],
    })), surfaceTextures: [], chains: [], dependencies: [], diagnostics: [],
  } as unknown as EngineeringAnnotationDraft;
  return { document, draft };
}

function render(scale: number, onMoveDatum = vi.fn(), onMoveGdtGroup = vi.fn()) {
  const { document, draft } = fixture();
  return {
    onMoveDatum,
    view: TestRenderer.create(<svg><GdtOverlay
      draft={draft} document={document} scale={scale}
      viewport={{ x: 0, y: 0, scale, width: 800, height: 600 }}
      datumVisible gdtVisible previewHeld={false} selectedIntentId={null}
      onSelectDatum={() => undefined} onSelectIntent={() => undefined} onMoveDatum={onMoveDatum} onMoveGdtGroup={onMoveGdtGroup}
    /></svg>),
  };
}

describe('GdtOverlay datum marker', () => {
  it('renders the standard Unicode total-runout mark and combines a common datum A-B in one cell', () => {
    const { document, draft } = fixture();
    draft.datums.push({
      ...draft.datums[0]!, id: 'datum:B', name: 'B', role: 'secondary',
    });
    draft.geometricTolerances = [{
      ...draft.geometricTolerances[0]!, id: 'gdt:total-runout', characteristic: 'total-runout',
      datumReferenceFrame: [{ datumId: 'datum:A' }, { datumId: 'datum:B' }],
      computed: { status: 'resolved', value: 0.01, unit: 'mm', diagnostics: [] },
    }];
    const view = TestRenderer.create(<svg><GdtOverlay
      draft={draft} document={document} scale={1}
      viewport={{ x: 0, y: 0, scale: 1, width: 800, height: 600 }}
      datumVisible gdtVisible previewHeld={false} selectedIntentId={null}
      onSelectDatum={() => undefined} onSelectIntent={() => undefined}
      onMoveDatum={() => undefined} onMoveGdtGroup={() => undefined}
    /></svg>);

    expect(view.root.findAllByProps({ 'data-gdt-symbol': 'total-runout' })).toHaveLength(1);
    const row = view.root.findByProps({ 'data-gdt-id': 'gdt:total-runout' });
    const cells = row.findAllByType('rect').filter(({ props }) => props.className !== 'vai-gdt-frame__hit');
    expect(cells[0]?.props.width).toBe(26);
    const mark = view.root.findByProps({ 'data-gdt-symbol': 'total-runout' });
    expect(mark.type).toBe('text');
    expect(mark.children.join('')).toBe('⌰');
    expect(view.root.findAllByType('text').map(({ children }) => children.join(''))).toContain('A-B');
  });

  it('uses one shared value-column width for every row in a tolerance frame', () => {
    const { document, draft } = fixture();
    draft.geometricTolerances.forEach((intent, index) => {
      intent.computed = { status: 'resolved', value: [0.003, 0.005, 0.01][index], unit: 'mm', diagnostics: [] };
    });
    const view = TestRenderer.create(<svg><GdtOverlay
      draft={draft} document={document} scale={1}
      viewport={{ x: 0, y: 0, scale: 1, width: 800, height: 600 }}
      datumVisible gdtVisible previewHeld={false} selectedIntentId={null}
      onSelectDatum={() => undefined} onSelectIntent={() => undefined}
      onMoveDatum={() => undefined} onMoveGdtGroup={() => undefined}
    /></svg>);

    const valueWidths = draft.geometricTolerances.map((intent) => {
      const row = view.root.findByProps({ 'data-gdt-id': intent.id });
      return row.findAllByType('rect').filter(({ props }) => props.className !== 'vai-gdt-frame__hit')[1]?.props.width;
    });
    expect(new Set(valueWidths).size).toBe(1);
  });

  it('opens the matching editor when a datum marker or tolerance row is clicked', () => {
    const { document, draft } = fixture();
    const onSelectDatum = vi.fn();
    const onSelectIntent = vi.fn();
    const view = TestRenderer.create(<svg><GdtOverlay
      draft={draft} document={document} scale={1}
      viewport={{ x: 0, y: 0, scale: 1, width: 800, height: 600 }}
      datumVisible gdtVisible previewHeld={false} selectedIntentId={null}
      onSelectDatum={onSelectDatum}
      onSelectIntent={onSelectIntent}
      onMoveDatum={() => undefined}
      onMoveGdtGroup={() => undefined}
    /></svg>);

    act(() => view.root.findByProps({ 'data-datum-id': 'datum:A' }).props.onClick({ stopPropagation: vi.fn() }));
    act(() => view.root.findByProps({ 'data-gdt-id': 'gdt:2' }).props.onClick({ stopPropagation: vi.fn() }));

    expect(onSelectDatum).toHaveBeenCalledWith('datum:A');
    expect(onSelectIntent).toHaveBeenCalledWith('gdt:2');
  });

  it('keeps a world-anchored marker at a constant readable screen size while zooming', () => {
    const atOne = render(1).view.root.findByProps({ 'data-datum-id': 'datum:A' })
      .findAll((node) => node.type === 'g' && typeof node.props.transform === 'string')[0]!;
    const atFour = render(4).view.root.findByProps({ 'data-datum-id': 'datum:A' })
      .findAll((node) => node.type === 'g' && typeof node.props.transform === 'string')[0]!;

    expect(atOne.props.transform).toMatch(/^translate\([^)]*\) scale\(1 -1\)$/);
    expect(atFour.props.transform).toMatch(/^translate\([^)]*\) scale\(0\.25 -0\.25\)$/);
    expect(atOne.findByProps({ className: 'vai-datum-marker__hit' }).props.width).toBe(28);
    expect(atFour.findByProps({ className: 'vai-datum-marker__hit' }).props.width).toBe(28);
  });

  it('moves the datum instead of the canvas and commits even when pointer capture is lost', async () => {
    const onMoveDatum = vi.fn(async () => undefined);
    const { view } = render(2, onMoveDatum);
    const marker = view.root.findByProps({ 'data-datum-id': 'datum:A' });
    const target = { setPointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true), releasePointerCapture: vi.fn() };
    const event = { pointerId: 7, button: 0, preventDefault: vi.fn(), stopPropagation: vi.fn(), currentTarget: target };

    act(() => marker.props.onPointerDown({ ...event, clientX: 100, clientY: 100 }));
    act(() => marker.props.onPointerMove({ ...event, clientX: 140, clientY: 120 }));
    await act(async () => marker.props.onLostPointerCapture({ ...event, clientX: 140, clientY: 120 }));

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(onMoveDatum).toHaveBeenCalledWith('datum:A', [20, -14]);
  });

  it('persists the latest drag position even if the browser drops the final pointer event', async () => {
    vi.useFakeTimers();
    const onMoveDatum = vi.fn(async () => undefined);
    const { view } = render(2, onMoveDatum);
    const marker = view.root.findByProps({ 'data-datum-id': 'datum:A' });
    const event = {
      pointerId: 8, button: 0, preventDefault: vi.fn(), stopPropagation: vi.fn(),
      currentTarget: { setPointerCapture: vi.fn() },
    };

    act(() => marker.props.onPointerDown({ ...event, clientX: 100, clientY: 100 }));
    act(() => marker.props.onPointerMove({ ...event, clientX: 150, clientY: 110 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(120); });

    expect(onMoveDatum).toHaveBeenCalledWith('datum:A', [25, -9]);
    vi.useRealTimers();
  });

  it('persists the latest tolerance-frame position when pointer capture disappears', async () => {
    vi.useFakeTimers();
    const onMoveGdtGroup = vi.fn(async () => undefined);
    const { view } = render(2, vi.fn(), onMoveGdtGroup);
    const group = view.root.findByProps({ 'data-gdt-group': 'datum-line' });
    const event = {
      pointerId: 10, button: 0, preventDefault: vi.fn(), stopPropagation: vi.fn(),
      currentTarget: { setPointerCapture: vi.fn() },
    };

    act(() => group.props.onPointerDown({ ...event, clientX: 100, clientY: 100 }));
    act(() => group.props.onPointerMove({ ...event, clientX: 140, clientY: 120 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(120); });

    expect(onMoveGdtGroup).toHaveBeenCalledWith(['gdt:1', 'gdt:2', 'gdt:3'], [220, 90]);
    vi.useRealTimers();
  });

  it('lets tolerance frames shrink with the drawing but caps their enlarged screen size', () => {
    const atQuarter = render(0.25).view.root.findByProps({ 'data-gdt-id': 'gdt:1' })
      .findAll((node) => node.type === 'g' && typeof node.props.transform === 'string')[0]!;
    const atFour = render(4).view.root.findByProps({ 'data-gdt-id': 'gdt:1' })
      .findAll((node) => node.type === 'g' && typeof node.props.transform === 'string')[0]!;

    expect(atQuarter.props.transform).toBe('translate(200 100) scale(1 -1)');
    expect(atFour.props.transform).toBe('translate(200 100) scale(0.25 -0.25)');
  });

  it('drags a whole tolerance-frame group without handing the gesture to the canvas', async () => {
    const onMoveGdtGroup = vi.fn(async () => undefined);
    const { view } = render(2, vi.fn(), onMoveGdtGroup);
    const groups = view.root.findAllByProps({ 'data-gdt-group': 'datum-line' });
    expect(groups).toHaveLength(1);
    const group = groups[0]!;
    const target = { setPointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true), releasePointerCapture: vi.fn() };
    const event = { pointerId: 9, button: 0, preventDefault: vi.fn(), stopPropagation: vi.fn(), currentTarget: target };

    act(() => group.props.onPointerDown({ ...event, clientX: 100, clientY: 100 }));
    act(() => group.props.onPointerMove({ ...event, clientX: 140, clientY: 120 }));
    await act(async () => group.props.onPointerUp({ ...event, clientX: 140, clientY: 120 }));

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(onMoveGdtGroup).toHaveBeenCalledWith(['gdt:1', 'gdt:2', 'gdt:3'], [220, 90]);
  });
});
