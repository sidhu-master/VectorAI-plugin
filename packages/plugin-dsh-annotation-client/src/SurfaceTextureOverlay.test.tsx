// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing } from '@vectorai/drawing-core';
import type { EngineeringAnnotationDraft } from '@vectorai/plugin-space-contracts';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { SurfaceTextureOverlay } from './SurfaceTextureOverlay';

describe('SurfaceTextureOverlay', () => {
  it('renders a CAD-style material-removal value with its Ra semantics and opens its editor', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    document.geometry = [{
      id: 'journal-edge' as never, type: 'line', start: [0, 0], end: [30, 0], visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }];
    const drawingRef = { drawingId: 'drawing-1', revision: 1 };
    const draft = {
      version: 1, drawingRef, datums: [], intents: [], tolerances: [], fitAssignments: [], geometricTolerances: [],
      surfaceTextures: [{
        id: 'texture:journal', drawingRef,
        controlledTargets: [{ geometryId: 'journal-edge', anchor: { kind: 'nearest', point: [15, 0] } }],
        parameter: 'Ra', value: 0.8, unit: 'um', materialRemoval: 'required',
        source: 'process-rule', status: 'resolved', evidenceIds: [],
      }],
      chains: [], dependencies: [], diagnostics: [],
    } as unknown as EngineeringAnnotationDraft;
    const onSelect = vi.fn();
    const view = TestRenderer.create(<svg><SurfaceTextureOverlay
      draft={draft} document={document} scale={1} visible previewHeld={false}
      onSelect={onSelect} onMove={() => undefined}
    /></svg>);

    const marker = view.root.findByProps({ 'data-surface-texture-id': 'texture:journal' });
    expect(marker.findByProps({ 'data-material-removal': 'required' })).toBeDefined();
    expect(marker.findAllByType('text').map(({ children }) => children.join(''))).toContain('0.8');
    expect(marker.findByProps({ 'aria-label': 'Ra 0.8' })).toBeDefined();
    act(() => marker.props.onClick({ stopPropagation: vi.fn() }));
    expect(onSelect).toHaveBeenCalledWith('texture:journal');
  });
});
