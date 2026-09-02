// SPDX-License-Identifier: Apache-2.0

import type { EngineeringAnnotationDraft } from '@vectorai/plugin-space-contracts';
import { createEmptyDrawing, type GeometryId } from '@vectorai/drawing-core';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { GdtInspector } from './GdtInspector';
import * as gdtInspectorModule from './GdtInspector';
import type { GdtController } from './gdt-controller';

function fixture(): EngineeringAnnotationDraft {
  const drawingRef = { drawingId: 'drawing-1', revision: 1 };
  return {
    version: 1, drawingRef,
    datums: [{
      id: 'datum:A', drawingRef, name: 'A', geometryId: 'line-1', anchor: { kind: 'start' },
      role: 'primary', source: 'ai-candidate', status: 'candidate', evidenceIds: [],
    }],
    intents: [], tolerances: [], fitAssignments: [], surfaceTextures: [], chains: [], dependencies: [], diagnostics: [],
    geometricTolerances: [{
      id: 'gdt:1', drawingRef, characteristic: 'circularity',
      controlledTargets: [{ geometryId: 'line-1', anchor: { kind: 'end' } }],
      toleranceZone: { shape: 'linear' }, datumReferenceFrame: [{ datumId: 'datum:A' }],
      computed: { status: 'pending', unit: 'mm', diagnostics: [] },
      source: 'ai-candidate', status: 'pending-calculation', evidenceIds: [],
    }],
  };
}

function surfaceTextureFixture(): EngineeringAnnotationDraft {
  const draft = fixture();
  draft.surfaceTextures = [{
    id: 'surface-texture:1', drawingRef: draft.drawingRef,
    controlledTargets: [{ geometryId: 'line-1', anchor: { kind: 'end' } }],
    parameter: 'Ra', value: 0.8, unit: 'um', materialRemoval: 'required',
    source: 'process-rule', status: 'resolved', evidenceIds: [],
    ruleRef: { id: 'shaft-axis-support-surface-texture', version: '1' },
  }];
  return draft;
}

describe('GdtInspector popup editing', () => {
  it('exposes controlled-feature length estimation for standard table lookup', () => {
    expect((gdtInspectorModule as Record<string, unknown>).estimateGdtEvaluationLength).toBeTypeOf('function');
  });

  it('derives the evaluation length from the controlled drawing geometry', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing' }, now: () => 1 });
    document.geometry = [{
      id: 'line-1' as GeometryId, type: 'line', start: [10, 4], end: [65, 4], visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }];
    expect(gdtInspectorModule.estimateGdtEvaluationLength(document, ['line-1'])).toBe(55);
    expect(gdtInspectorModule.estimateGdtEvaluationLength(document, ['missing'])).toBeUndefined();
  });

  it('keeps geometric-tolerance changes local until Apply and then closes', async () => {
    const setOverride = vi.fn(async () => undefined);
    const onClose = vi.fn();
    const controller = {
      actions: { edit: vi.fn(async () => undefined), setOverride, clearOverride: vi.fn(async () => undefined) },
    } as unknown as GdtController;
    const view = TestRenderer.create(<GdtInspector
      draft={fixture()}
      selection={{ type: 'intent', id: 'gdt:1' }}
      selectedGeometryIds={[]}
      controller={controller}
      onClose={onClose}
    />);

    const valueInput = view.root.findByProps({ 'data-gdt-value-input': true });
    act(() => valueInput.props.onChange({ target: { value: '0.015' } }));
    expect(setOverride).not.toHaveBeenCalled();

    await act(async () => view.root.findByProps({ 'data-apply-gdt': true }).props.onClick());
    expect(setOverride).toHaveBeenCalledWith('gdt:1', 0.015);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('applies datum label and geometry changes from the datum popup', async () => {
    const edit = vi.fn(async () => undefined);
    const onClose = vi.fn();
    const view = TestRenderer.create(<GdtInspector
      draft={fixture()}
      selection={{ type: 'datum', id: 'datum:A' }}
      selectedGeometryIds={['line-2']}
      controller={{ actions: { edit } } as unknown as GdtController}
      onClose={onClose}
    />);

    act(() => view.root.findByProps({ 'data-datum-name-input': true }).props.onChange({ target: { value: 'B' } }));
    act(() => view.root.findByProps({ 'data-use-selected-datum-geometry': true }).props.onClick());
    await act(async () => view.root.findByProps({ 'data-apply-gdt': true }).props.onClick());

    expect(edit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'datum.set', datumId: 'datum:A', name: 'B', geometryId: 'line-2',
    }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('offers the matching GB/T 1184 H K L row and applies the selected value', async () => {
    const setOverride = vi.fn(async () => undefined);
    const view = TestRenderer.create(<GdtInspector
      draft={fixture()}
      selection={{ type: 'intent', id: 'gdt:1' }}
      selectedGeometryIds={[]}
      evaluationLength={55}
      controller={{ actions: { edit: vi.fn(async () => undefined), setOverride } } as unknown as GdtController}
      onClose={() => undefined}
    />);

    act(() => view.root.findAllByType('select')[0]!.props.onChange({ target: { value: 'straightness' } }));
    const cards = view.root.findAll((node) => node.props['data-gdt-standard-class'] !== undefined);
    expect(cards.map(({ props }) => [props['data-gdt-standard-class'], props['data-gdt-standard-value']])).toEqual([
      ['H', 0.1], ['K', 0.2], ['L', 0.4],
    ]);

    act(() => view.root.findByProps({ 'data-gdt-standard-class': 'K' }).props.onClick());
    expect(view.root.findByProps({ 'data-gdt-value-input': true }).props.value).toBe('0.2');
    expect(setOverride).not.toHaveBeenCalled();

    await act(async () => view.root.findByProps({ 'data-apply-gdt': true }).props.onClick());
    expect(setOverride).toHaveBeenCalledWith('gdt:1', 0.2);
  });

  it('shows Appendix B specified grades for an explicitly drawn geometric tolerance', async () => {
    const setOverride = vi.fn(async () => undefined);
    const view = TestRenderer.create(<GdtInspector
      draft={fixture()}
      selection={{ type: 'intent', id: 'gdt:1' }}
      selectedGeometryIds={[]}
      evaluationLength={55}
      controller={{ actions: { edit: vi.fn(async () => undefined), setOverride } } as unknown as GdtController}
      onClose={() => undefined}
    />);

    const cards = view.root.findAll((node) => node.props['data-gdt-specified-grade'] !== undefined);
    expect(cards.find(({ props }) => props['data-gdt-specified-grade'] === 0)?.props['data-gdt-specified-value']).toBe(0.0003);
    expect(cards.find(({ props }) => props['data-gdt-specified-grade'] === 8)?.props['data-gdt-specified-value']).toBe(0.013);

    act(() => view.root.findByProps({ 'data-gdt-specified-grade': 8 }).props.onClick());
    await act(async () => view.root.findByProps({ 'data-apply-gdt': true }).props.onClick());
    expect(setOverride).toHaveBeenCalledWith('gdt:1', 0.013);
  });

  it('shows the Appendix B preferred-number series for position tolerance', () => {
    const view = TestRenderer.create(<GdtInspector
      draft={fixture()}
      selection={{ type: 'intent', id: 'gdt:1' }}
      selectedGeometryIds={[]}
      evaluationLength={55}
      controller={{ actions: { edit: vi.fn(async () => undefined), setOverride: vi.fn(async () => undefined) } } as unknown as GdtController}
      onClose={() => undefined}
    />);

    act(() => view.root.findAllByType('select')[0]!.props.onChange({ target: { value: 'position' } }));
    const cards = view.root.findAll((node) => node.props['data-gdt-position-value'] !== undefined);
    expect(cards.slice(0, 4).map(({ props }) => props['data-gdt-position-value'])).toEqual([
      0.001, 0.0012, 0.0015, 0.002,
    ]);
  });

  it('separates the process-rule recommendation from the complete GB/T 1031 value table', () => {
    const view = TestRenderer.create(<GdtInspector
      draft={surfaceTextureFixture()}
      selection={{ type: 'surface-texture', id: 'surface-texture:1' }}
      selectedGeometryIds={[]}
      controller={{ actions: { edit: vi.fn(async () => undefined) } } as unknown as GdtController}
      onClose={() => undefined}
    />);

    expect(view.root.findByProps({ 'data-surface-texture-recommended-value': 0.8 })).toBeDefined();
    const standardValues = view.root.findAll((node) => node.props['data-surface-texture-standard-value'] !== undefined);
    expect(standardValues.map(({ props }) => props['data-surface-texture-standard-value'])).toEqual([
      0.006, 0.012, 0.025, 0.05, 0.1, 0.2, 0.4, 0.8,
      1.6, 3.2, 6.3, 12.5, 25, 50, 100,
    ]);
  });
});
