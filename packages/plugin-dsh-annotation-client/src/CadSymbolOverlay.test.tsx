// SPDX-License-Identifier: Apache-2.0
import { createEmptyDrawing } from '@vectorai/drawing-core';
import { projectEngineeringCadDrawing } from '@vectorai/drawing-cad';
import type { EngineeringAnnotationDraft } from '@vectorai/plugin-space-contracts';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CadSymbolOverlay } from './CadSymbolOverlay';

function fixture() {
  vi.stubGlobal('window', new EventTarget());
  const document = createEmptyDrawing();
  document.geometry = [{ id: 'line' as never, type: 'line', start: [0, 0], end: [100, 0], visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] } }];
  const draft = {
    version: 1, datums: [], intents: [], tolerances: [], surfaceTextures: [], fitAssignments: [], chains: [], dependencies: [], diagnostics: [],
    geometricTolerances: ['circularity', 'cylindricity'].map((characteristic, index) => ({
      id: `gdt:${index}`, characteristic, status: 'candidate', source: 'ai-candidate', evidenceIds: [],
      controlledTargets: [{ geometryId: 'line', anchor: { kind: 'end' } }],
      toleranceZone: { shape: 'linear' }, datumReferenceFrame: [], framePosition: [150, 50],
      computed: { status: 'unresolved', unit: 'mm', diagnostics: [] },
    })),
  } as unknown as EngineeringAnnotationDraft;
  const scene = projectEngineeringCadDrawing(document, { version: 1, draft, phase: 'editing', canUndo: false, canRedo: false, updatedAt: 1 },
    { profile: 'caxa-compatible', purpose: 'canvas' });
  const onSelect = vi.fn(), onMove = vi.fn(), onInteractionActiveChange = vi.fn();
  const view = TestRenderer.create(<svg><CadSymbolOverlay scene={scene} draft={draft} scale={2}
    datumVisible gdtVisible textureVisible previewHeld={false} onSelect={onSelect} onMove={onMove}
    onInteractionActiveChange={onInteractionActiveChange} /></svg>);
  const target = { setPointerCapture() {}, hasPointerCapture: () => false, releasePointerCapture() {} };
  const event = (x = 100, y = 100) => ({ button: 0, pointerId: 1, clientX: x, clientY: y,
    preventDefault() {}, stopPropagation() {}, currentTarget: target });
  const group = () => view.root.findByProps({ 'data-cad-symbol': 'gdt:gdt:0|gdt:1' });
  const down = () => act(() => {
    view.root.findByProps({ 'data-gdt-id': 'gdt:1' }).props.onPointerDown();
    group().props.onPointerDown(event());
  });
  return { view, group, event, down, onSelect, onMove, onInteractionActiveChange };
}

afterEach(() => vi.unstubAllGlobals());
describe('CadSymbolOverlay paper interaction', () => {
  it('selects the exact row on pointer up despite capture retargeting the click to the group', () => {
    const f = fixture(); f.down();
    act(() => f.group().props.onPointerUp(f.event()));
    expect(f.onSelect).toHaveBeenCalledWith('gdt', 'gdt:1');
    expect(f.onMove).not.toHaveBeenCalled();
    act(() => f.view.unmount());
  });
  it('moves the whole frame from its paper position and discards a cancelled move', async () => {
    const f = fixture(); f.down();
    await act(async () => f.group().props.onPointerUp(f.event(120, 90)));
    expect(f.onMove).toHaveBeenCalledWith(expect.objectContaining({ kind: 'gdt', ids: ['gdt:0', 'gdt:1'], position: [160, 55] }));
    expect(f.onSelect).not.toHaveBeenCalled();
    f.onMove.mockClear(); f.down();
    act(() => { f.group().props.onPointerMove(f.event(200, 200)); f.group().props.onPointerCancel(f.event()); });
    expect(f.onMove).not.toHaveBeenCalled();
    expect(f.onInteractionActiveChange).toHaveBeenLastCalledWith(false);
    act(() => f.view.unmount());
  });
});
