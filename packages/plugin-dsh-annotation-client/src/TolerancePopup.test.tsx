// SPDX-License-Identifier: Apache-2.0

import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { TolerancePopup, type TolerancePopupProps } from './TolerancePopup';

const bands = [
  { designation: 'h6', featureClass: 'external' as const, category: 'preferred' as const, available: true },
  { designation: 'u6', featureClass: 'external' as const, category: 'common' as const, available: true },
  { designation: 'g6', featureClass: 'external' as const, category: 'unknown' as const, available: false, unavailableCode: 'TOLERANCE_STANDARD_UNAVAILABLE' as const },
];
const target = {
  dimensionIntentId: 'intent-1', drawingRef: { drawingId: 'drawing-1', revision: 1 },
  anchor: { x: 200, y: 100 }, basicSize: 13, label: '⌀13',
  classification: { status: 'resolved' as const, featureClass: 'external' as const },
  acceptsManualTolerance: true,
};
const preview = {
  type: 'single' as const,
  drawingRef: target.drawingRef,
  dimensionIntentId: target.dimensionIntentId,
  status: 'resolved' as const,
  result: {
    designation: 'u6', featureClass: 'external' as const, basicSize: 13, unit: 'mm' as const,
    upperDeviation: .044, lowerDeviation: .033, upperLimitSize: 13.044, lowerLimitSize: 13.033,
    toleranceMagnitude: .011,
    standardRef: { id: 'GB/T 1800', edition: '2020' },
    ruleRef: { id: 'GB/T 1800', version: '2020', inputDigest: 'sha256:x' },
  },
};
const fitPreview = {
  type: 'fit' as const, drawingRef: target.drawingRef,
  holeDimensionIntentId: 'hole-1', shaftDimensionIntentId: 'shaft-1', status: 'resolved' as const,
  result: {
    designation: 'H7/g6', basis: 'hole' as const,
    hole: { ...preview.result, designation: 'H7', featureClass: 'internal' as const, upperDeviation: .018, lowerDeviation: 0, toleranceMagnitude: .018, upperLimitSize: 13.018, lowerLimitSize: 13 },
    shaft: { ...preview.result, designation: 'g6', upperDeviation: -.006, lowerDeviation: -.017, toleranceMagnitude: .011, upperLimitSize: 12.994, lowerLimitSize: 12.983 },
    fitType: 'clearance' as const, minimumClearance: .006, maximumClearance: .035,
  },
};
const matingFitPreview = {
  ...fitPreview,
  type: 'mating-fit' as const,
  dimensionIntentId: target.dimensionIntentId,
  currentFeatureClass: 'external' as const,
};

function props(overrides: Partial<TolerancePopupProps> = {}): TolerancePopupProps {
  return {
    geometry: { x: 100, y: 80, width: 700, height: 480 },
    viewport: { width: 1_000, height: 700 },
    target,
    bands,
    fitCatalogs: null,
    tab: 'external', zoom: 1, standardEdition: '2020',
    datasetCompleteness: 'partial',
    preview,
    displayPreference: 'deviations',
    dirty: false, closeDecision: null, busy: false, error: null,
    pendingTarget: null,
    recommendation: 'u6',
    onPreview: vi.fn(), onApply: vi.fn(), onRequestClose: vi.fn(),
    onDiscardClose: vi.fn(), onApplyClose: vi.fn(), onGeometryChange: vi.fn(),
    onDiscardAndSwitch: vi.fn(), onApplyAndSwitch: vi.fn(),
    onTabChange: vi.fn(), onZoomChange: vi.fn(), onDisplayPreferenceChange: vi.fn(),
    onOverridePreview: vi.fn(), onRestoreStandard: vi.fn(), onRestoreRecommendation: vi.fn(),
    onFeatureClassChoice: vi.fn(), onFitTargetFeatureClassChoice: vi.fn(), onManualPreview: vi.fn(),
    ...overrides,
  };
}

function renderPopup(overrides: Partial<TolerancePopupProps> = {}): { tree: ReactTestRenderer; value: TolerancePopupProps } {
  const value = props(overrides);
  return { tree: create(<TolerancePopup {...value} />), value };
}

function openManualSettings(tree: ReactTestRenderer): void {
  act(() => tree.root.findByProps({ 'data-open-manual-tolerance': true }).props.onClick());
}

function editDeviation(tree: ReactTestRenderer, field: 'upper' | 'lower'): void {
  act(() => tree.root.findByProps({ 'data-edit-deviation': field }).props.onClick());
}

describe('TolerancePopup', () => {
  it('presents mating and current designations as a single-part workflow with Chinese fit guidance', () => {
    const tree = renderPopup({
      tab: 'shaft-fit', preview: matingFitPreview,
      fitCatalogs: {
        internal: [{ designation: 'H7', featureClass: 'internal', category: 'preferred', available: true }],
        external: [{ designation: 'g6', featureClass: 'external', category: 'preferred', available: true }],
      },
    }).tree;
    expect(tree.root.findByProps({ 'data-fit-role': 'mating' }).findByType('strong').children.join('')).toContain('被配合部位');
    expect(tree.root.findByProps({ 'data-fit-role': 'current' }).findByType('strong').children.join('')).toContain('当前部位');
    expect(tree.root.findByProps({ 'data-fit-business-label': true }).children.join('')).toContain('小间隙配合');
    expect(tree.root.findAllByProps({ 'data-fit-selection-status': true })).toHaveLength(0);
  });

  it('explains fit selection with large role cards and no search field', () => {
    const tree = renderPopup({
      tab: 'shaft-fit', preview: null,
      fitCatalogs: {
        internal: [{ designation: 'H7', featureClass: 'internal', category: 'preferred', available: true }],
        external: [{ designation: 'g6', featureClass: 'external', category: 'preferred', available: true }],
      },
    }).tree;

    expect(tree.root.findByProps({ 'data-fit-explanation': true }).children.join('')).toContain('孔与轴装配后的松紧关系');
    expect(tree.root.findAllByProps({ 'data-fit-search': true })).toHaveLength(0);
    expect(tree.root.findByProps({ 'data-fit-role': 'mating' }).props.className).toContain('vai-tolerance-fit-card');
    expect(tree.root.findByProps({ 'data-fit-role': 'current' }).props.className).toContain('vai-tolerance-fit-card');
    expect(tree.root.findAllByProps({ 'data-preview-fit': true })).toHaveLength(0);
  });

  it('shows preclassified size-based recommendations without asking the popup to analyze geometry', async () => {
    const recommendations = [{
      designation: 'u6', category: 'common' as const, source: 'standard-selection' as const,
      evidenceRefs: [], result: preview.result,
    }];
    const { tree, value } = renderPopup({ tab: 'recommendation', recommendations });
    await act(async () => tree.root.findByProps({ 'data-tolerance-recommendation': 'u6' }).props.onClick());
    expect(value.onPreview).toHaveBeenCalledWith('u6');
    expect(tree.root.findByProps({ 'data-tolerance-recommendation': 'u6' }).children).toBeTruthy();
  });

  it('keeps mating fit as a primary tab and moves the full catalog below recommendations', () => {
    const recommendations = [{
      designation: 'u6', category: 'common' as const, source: 'standard-selection' as const,
      evidenceRefs: [], result: preview.result,
    }];
    const { tree, value } = renderPopup({ tab: 'recommendation', recommendations });

    act(() => tree.root.findByProps({ 'data-tolerance-tab': 'shaft-fit' }).props.onClick());
    act(() => tree.root.findByProps({ 'data-open-tolerance-catalog': true }).props.onClick());
    expect(value.onTabChange).toHaveBeenNthCalledWith(1, 'shaft-fit');
    expect(value.onTabChange).toHaveBeenNthCalledWith(2, 'external');
  });

  it('previews on click, applies with Command/Control+Enter, and isolates canvas events', async () => {
    const { tree, value } = renderPopup({ dirty: true });
    await act(async () => tree.root.findByProps({ 'data-tolerance-band': 'u6' }).props.onClick());
    expect(value.onPreview).toHaveBeenCalledWith('u6');
    const root = tree.root.findByProps({ 'data-tolerance-popup': true });
    const preventDefault = vi.fn();
    const stopKeyDown = vi.fn();
    act(() => root.props.onKeyDown({ key: 'Enter', metaKey: true, ctrlKey: false, preventDefault, stopPropagation: stopKeyDown }));
    act(() => root.props.onKeyDown({ key: 'Enter', metaKey: false, ctrlKey: true, preventDefault, stopPropagation: stopKeyDown }));
    expect(value.onApply).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(stopKeyDown).toHaveBeenCalledTimes(2);

    for (const handler of ['onPointerDown', 'onMouseDown', 'onMouseUp', 'onClick', 'onDoubleClick', 'onContextMenu', 'onWheel', 'onKeyUp'] as const) {
      const stopPropagation = vi.fn();
      act(() => root.props[handler]({ stopPropagation }));
      expect(stopPropagation, handler).toHaveBeenCalledOnce();
    }
  });

  it('shows Host-returned single and fit values without deriving replacement values', () => {
    const single = renderPopup().tree.root.findByProps({ 'data-tolerance-result': true });
    expect(single.findAllByType('dd').flatMap(({ children }) => children)).toEqual(expect.arrayContaining([
      'u6', '13', '+0.044', '+0.033', '0.011', '13.044', '13.033',
    ]));
    const fit = renderPopup({ preview: fitPreview }).tree.root.findByProps({ 'data-tolerance-fit-result': true });
    expect(fit.findAllByType('dd').flatMap(({ children }) => children)).toEqual(expect.arrayContaining([
      'H7/g6', '小间隙配合', '0.006', '0.035', '13', '0.018', '0.011', '13.018', '12.983',
    ]));
    expect(fit.findByProps({ 'data-fit-hole-upper': true }).children.join('')).toBe('+0.018 mm');
    expect(fit.findByProps({ 'data-fit-hole-lower': true }).children.join('')).toBe('0 mm');
    expect(fit.findByProps({ 'data-fit-shaft-upper': true }).children.join('')).toBe('-0.006 mm');
    expect(fit.findByProps({ 'data-fit-shaft-lower': true }).children.join('')).toBe('-0.017 mm');
  });

  it('renders the standard reference as one non-breaking value', () => {
    const single = renderPopup().tree.root.findByProps({ 'data-tolerance-result': true });
    expect(single.findByProps({ 'data-tolerance-standard': true }).children.join('')).toBe('GB/T 1800 · 2020');
  });

  it('puts edit pencils beside current deviation labels and marks overridden values inline', () => {
    const { tree, value } = renderPopup({ override: { upperDeviation: .05, lowerDeviation: .04 } });
    expect(tree.root.findAll(({ props }) => props['data-manual-override-status'] !== undefined)).toHaveLength(2);
    const upperPencil = tree.root.findByProps({ 'data-edit-deviation': 'upper' });
    const lowerPencil = tree.root.findByProps({ 'data-edit-deviation': 'lower' });
    expect(upperPencil.parent?.type).toBe('dt');
    expect(upperPencil.parent?.children[0]).toBe('上偏差');
    expect(lowerPencil.parent?.type).toBe('dt');
    expect(lowerPencil.parent?.children[0]).toBe('下偏差');
    expect(tree.root.findAll(({ props }) => props.className === 'vai-tolerance-manual-panel')).toHaveLength(0);
    expect(value.onRestoreStandard).not.toHaveBeenCalled();
  });

  it('restores only the selected manual deviation and keeps the other override', async () => {
    const { tree, value } = renderPopup({ override: { upperDeviation: .05, lowerDeviation: .04 } });

    expect(tree.root.findByProps({ 'data-restore-standard': 'upper' })).toBeDefined();
    expect(tree.root.findByProps({ 'data-restore-standard': 'lower' })).toBeDefined();
    await act(async () => tree.root.findByProps({ 'data-restore-standard': 'upper' }).props.onClick());

    expect(value.onOverridePreview).toHaveBeenCalledWith({ upperDeviation: .044, lowerDeviation: .04 });
    expect(value.onRestoreStandard).not.toHaveBeenCalled();
  });

  it('clears the override only after restoring the final manual deviation', () => {
    const { tree, value } = renderPopup({ override: { upperDeviation: .044, lowerDeviation: .04 } });

    expect(tree.root.findAllByProps({ 'data-manual-override-status': 'upper' })).toHaveLength(0);
    expect(tree.root.findByProps({ 'data-manual-override-status': 'lower' })).toBeDefined();
    act(() => tree.root.findByProps({ 'data-restore-standard': 'lower' }).props.onClick());

    expect(value.onRestoreStandard).toHaveBeenCalledOnce();
    expect(value.onOverridePreview).not.toHaveBeenCalled();
  });

  it('hydrates restored fit selectors and keeps the restored selection applyable', async () => {
    const value = props({
      tab: 'hole-fit', preview: fitPreview, dirty: false,
      fitCatalogs: {
        internal: [{ designation: 'H7', featureClass: 'internal', category: 'preferred', available: true }],
        external: [{ designation: 'g6', featureClass: 'external', category: 'preferred', available: true }],
      },
    });
    const tree = create(<TolerancePopup {...value} />);

    expect(tree.root.findByProps({ 'data-fit-band': 'internal' }).props.value).toBe('H7');
    expect(tree.root.findByProps({ 'data-fit-band': 'external' }).props.value).toBe('g6');
    act(() => tree.update(<TolerancePopup {...value} displayPreference="both" dirty />));
    expect(tree.root.findByProps({ 'data-apply-tolerance': true }).props.disabled).toBe(false);
    await act(async () => tree.root.findByProps({ 'data-apply-tolerance': true }).props.onClick());
    expect(value.onApply).toHaveBeenCalledOnce();
  });

  it('updates restored fit identity without erasing dirty local selector edits', () => {
    const catalogs = {
      internal: [
        { designation: 'H7', featureClass: 'internal' as const, category: 'preferred' as const, available: true },
        { designation: 'H8', featureClass: 'internal' as const, category: 'common' as const, available: true },
      ],
      external: [
        { designation: 'g6', featureClass: 'external' as const, category: 'preferred' as const, available: true },
        { designation: 'f7', featureClass: 'external' as const, category: 'common' as const, available: true },
        { designation: 'u6', featureClass: 'external' as const, category: 'other' as const, available: true },
      ],
    };
    const initial = props({ tab: 'hole-fit', preview: fitPreview, fitCatalogs: catalogs });
    const tree = create(<TolerancePopup {...initial} />);
    const alternate = {
      ...fitPreview,
      result: {
        ...fitPreview.result, designation: 'H8/f7',
        hole: { ...fitPreview.result.hole, designation: 'H8' },
        shaft: { ...fitPreview.result.shaft, designation: 'f7' },
      },
    };

    act(() => tree.update(<TolerancePopup {...initial} preview={alternate} />));
    expect(tree.root.findByProps({ 'data-fit-band': 'internal' }).props.value).toBe('H8');
    expect(tree.root.findByProps({ 'data-fit-band': 'external' }).props.value).toBe('f7');
    act(() => tree.root.findByProps({ 'data-fit-band': 'external' }).props.onChange({ currentTarget: { value: 'u6' } }));
    act(() => tree.update(<TolerancePopup {...initial} preview={fitPreview} />));
    expect(tree.root.findByProps({ 'data-fit-band': 'internal' }).props.value).toBe('H8');
    expect(tree.root.findByProps({ 'data-fit-band': 'external' }).props.value).toBe('u6');
  });

  it('shows only recommendation and mating fit as primary tabs', () => {
    const { tree, value } = renderPopup();
    act(() => tree.root.findByProps({ 'data-tolerance-tab': 'shaft-fit' }).props.onClick());
    expect(value.onTabChange).toHaveBeenNthCalledWith(1, 'shaft-fit');
    expect(tree.root.findAllByProps({ 'data-tolerance-tab': 'external' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ role: undefined }).filter(({ props }) => props['data-tolerance-tab'] !== undefined)).toHaveLength(2);
    expect(tree.root.findByProps({ 'data-tolerance-dataset': 'partial' }).children.join('')).toContain('部分数据');
  });

  it('drags only from the title and clamps southeast resizing to viewport limits', () => {
    const { tree, value } = renderPopup();
    const root = tree.root.findByProps({ 'data-tolerance-popup': true });
    const idleStop = vi.fn();
    act(() => root.props.onPointerMove({ clientX: 500, clientY: 500, stopPropagation: idleStop }));
    expect(idleStop).toHaveBeenCalledOnce();
    expect(value.onGeometryChange).not.toHaveBeenCalled();

    const setPointerCapture = vi.fn();
    act(() => tree.root.findByProps({ 'data-tolerance-title': true }).props.onPointerDown({
      clientX: 120, clientY: 100, pointerId: 4, currentTarget: { setPointerCapture }, stopPropagation: vi.fn(),
    }));
    act(() => root.props.onPointerMove({ clientX: 160, clientY: 135, stopPropagation: vi.fn() }));
    expect(setPointerCapture).toHaveBeenCalledWith(4);
    expect(value.onGeometryChange).toHaveBeenLastCalledWith({ x: 140, y: 115, width: 700, height: 480 }, { userDragged: true });

    const releasePointerCapture = vi.fn();
    const captureOwner = { setPointerCapture, releasePointerCapture, hasPointerCapture: () => true };
    act(() => root.props.onPointerUp({ pointerId: 4, stopPropagation: vi.fn() }));
    act(() => tree.root.findByProps({ 'data-tolerance-resize': 'se' }).props.onPointerDown({
      clientX: 800, clientY: 560, pointerId: 5, currentTarget: captureOwner, stopPropagation: vi.fn(),
    }));
    act(() => root.props.onPointerMove({ clientX: 2_000, clientY: 2_000, stopPropagation: vi.fn() }));
    expect(value.onGeometryChange).toHaveBeenLastCalledWith({ x: 100, y: 80, width: 800, height: 560 }, { userDragged: true });
    act(() => root.props.onPointerCancel({ pointerId: 5, stopPropagation: vi.fn() }));
    expect(releasePointerCapture).toHaveBeenCalledWith(5);
  });

  it('clamps right and bottom edge handles to the minimum popup size', () => {
    const { tree, value } = renderPopup();
    const root = tree.root.findByProps({ 'data-tolerance-popup': true });
    const setPointerCapture = vi.fn();
    act(() => tree.root.findByProps({ 'data-tolerance-resize': 'e' }).props.onPointerDown({
      clientX: 800, clientY: 300, pointerId: 6, currentTarget: { setPointerCapture }, stopPropagation: vi.fn(),
    }));
    act(() => root.props.onPointerMove({ clientX: 100, clientY: 300 }));
    expect(value.onGeometryChange).toHaveBeenLastCalledWith({ x: 100, y: 80, width: 560, height: 480 }, { userDragged: true });
    act(() => root.props.onPointerUp());

    act(() => tree.root.findByProps({ 'data-tolerance-resize': 's' }).props.onPointerDown({
      clientX: 400, clientY: 560, pointerId: 7, currentTarget: { setPointerCapture }, stopPropagation: vi.fn(),
    }));
    act(() => root.props.onPointerMove({ clientX: 400, clientY: 100 }));
    expect(value.onGeometryChange).toHaveBeenLastCalledWith({ x: 100, y: 80, width: 700, height: 380 }, { userDragged: true });
  });

  it('does not close on outside focus changes and requires explicit dirty close actions', () => {
    const { tree, value } = renderPopup({ dirty: true, closeDecision: 'dirty' });
    const root = tree.root.findByProps({ 'data-tolerance-popup': true });
    expect(root.props.onBlur).toBeUndefined();
    act(() => tree.root.findByProps({ 'aria-label': '关闭公差选择器' }).props.onClick());
    expect(value.onRequestClose).toHaveBeenCalledOnce();
    act(() => tree.root.findByProps({ 'data-dirty-close': 'discard' }).props.onClick());
    act(() => tree.root.findByProps({ 'data-dirty-close': 'apply' }).props.onClick());
    expect(value.onDiscardClose).toHaveBeenCalledOnce();
    expect(value.onApplyClose).toHaveBeenCalledOnce();
  });

  it('supports Escape close and standard keyboard preview through the matrix', () => {
    const { tree, value } = renderPopup();
    const root = tree.root.findByProps({ 'data-tolerance-popup': true });
    act(() => root.props.onKeyDown({ key: 'Escape', metaKey: false, ctrlKey: false, preventDefault: vi.fn() }));
    expect(value.onRequestClose).toHaveBeenCalledOnce();
    const matrix = tree.root.findByProps({ 'data-tolerance-band-matrix': true });
    act(() => matrix.props.onKeyDown({ key: 'ArrowRight', preventDefault: vi.fn() }));
    act(() => matrix.props.onKeyDown({ key: 'Enter', preventDefault: vi.fn() }));
    expect(value.onPreview).toHaveBeenCalledWith('u6');
  });

  it('edits a standard deviation inline from the pencil beside its label', async () => {
    const { tree, value } = renderPopup({ override: { upperDeviation: .01, lowerDeviation: 0 } });
    expect(tree.root.findAllByProps({ 'data-tolerance-advanced': true })).toHaveLength(0);
    expect(tree.root.findAllByProps({ 'data-tolerance-override': 'upper' })).toHaveLength(0);
    editDeviation(tree, 'upper');

    const upper = tree.root.findByProps({ 'data-tolerance-override': 'upper' });
    act(() => upper.props.onChange({ currentTarget: { value: '0.05' } }));
    await act(async () => tree.root.findByProps({ 'data-confirm-inline-override': 'upper' }).props.onClick());
    expect(value.onOverridePreview).toHaveBeenCalledWith({ upperDeviation: .05, lowerDeviation: 0 });
  });

  it('shows stable unsupported diagnostics and manual fallback only when accepted', () => {
    const unsupported = { ...target, classification: { status: 'unsupported' as const, code: 'TOLERANCE_FEATURE_UNSUPPORTED' as const } };
    const { tree, value } = renderPopup({ target: unsupported, bands: [], preview: null });
    expect(tree.root.findByProps({ 'data-tolerance-unsupported': true }).children.join('')).not.toContain('TOLERANCE_FEATURE_UNSUPPORTED');
    openManualSettings(tree);
    const manualUpper = tree.root.findByProps({ 'data-manual-deviation': 'upper' });
    const manualLower = tree.root.findByProps({ 'data-manual-deviation': 'lower' });
    act(() => manualUpper.props.onChange({ currentTarget: { value: '0.02' } }));
    act(() => manualLower.props.onChange({ currentTarget: { value: '-0.01' } }));
    act(() => tree.root.findByProps({ 'data-preview-manual': true }).props.onClick());
    expect(value.onManualPreview).toHaveBeenCalledWith({ upperDeviation: .02, lowerDeviation: -.01 });

    const blocked = renderPopup({ target: { ...unsupported, acceptsManualTolerance: false }, bands: [], preview: null }).tree;
    expect(blocked.root.findAllByProps({ 'data-manual-deviation': 'upper' })).toHaveLength(0);
    expect(blocked.root.findByProps({ 'data-apply-tolerance': true }).props.disabled).toBe(true);
  });

  it('requires an explicit class choice for ambiguous supported linear sizes', () => {
    const ambiguous = {
      ...target,
      classification: { status: 'ambiguous' as const, code: 'TOLERANCE_FEATURE_CLASS_AMBIGUOUS' as const },
    };
    const { tree, value } = renderPopup({ target: ambiguous, bands: [], preview: null, dirty: true });
    expect(tree.root.findByProps({ 'data-tolerance-classification-step': true })).toBeDefined();
    expect(tree.root.findAllByProps({ 'data-tolerance-tab': 'recommendation' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ 'data-tolerance-override': 'upper' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ 'data-tolerance-diagnostic': true })).toHaveLength(0);
    expect(tree.root.findByProps({ 'data-tolerance-classification-title': true }).children.join('')).toContain('选择尺寸类型');
    act(() => tree.root.findByProps({ 'data-feature-class-choice': 'internal' }).props.onClick());
    act(() => tree.root.findByProps({ 'data-feature-class-choice': 'external' }).props.onClick());
    expect(value.onFeatureClassChoice).toHaveBeenNthCalledWith(1, 'internal');
    expect(value.onFeatureClassChoice).toHaveBeenNthCalledWith(2, 'external');
  });

  it('does not ask for another canvas target in the external mating requirement flow', () => {
    const { tree } = renderPopup({ tab: 'shaft-fit', preview: null });
    expect(tree.root.findAllByProps({ 'data-fit-target-classification': true })).toHaveLength(0);
    expect(tree.root.findAllByProps({ 'data-fit-selection-status': true })).toHaveLength(0);
  });

  it('renders dirty target-switch decisions and wires both explicit outcomes', () => {
    const pendingTarget = { ...target, dimensionIntentId: 'intent-2', label: '⌀20' };
    const { tree, value } = renderPopup({ pendingTarget, dirty: true });
    act(() => tree.root.findByProps({ 'data-dirty-switch': 'discard' }).props.onClick());
    act(() => tree.root.findByProps({ 'data-dirty-switch': 'apply' }).props.onClick());
    expect(value.onDiscardAndSwitch).toHaveBeenCalledOnce();
    expect(value.onApplyAndSwitch).toHaveBeenCalledOnce();
  });

  it('gates dirty decision Apply actions with the same busy and preview readiness as normal Apply', () => {
    const pendingTarget = { ...target, dimensionIntentId: 'intent-2', label: '⌀20' };
    const { tree, value } = renderPopup({
      pendingTarget, closeDecision: 'dirty', dirty: true, busy: true,
    });
    const normal = tree.root.findByProps({ 'data-apply-tolerance': true });
    const close = tree.root.findByProps({ 'data-dirty-close': 'apply' });
    const switching = tree.root.findByProps({ 'data-dirty-switch': 'apply' });
    expect(normal.props.disabled).toBe(true);
    expect(close.props.disabled).toBe(true);
    expect(switching.props.disabled).toBe(true);
    act(() => close.props.onClick());
    act(() => switching.props.onClick());
    expect(value.onApplyClose).not.toHaveBeenCalled();
    expect(value.onApplyAndSwitch).not.toHaveBeenCalled();
  });

  it('disables Apply for a clean hydrated selection', () => {
    const { tree, value } = renderPopup({ dirty: false, preview });
    expect(tree.root.findByProps({ 'data-apply-tolerance': true }).props.disabled).toBe(true);
    act(() => tree.root.findByProps({ 'data-tolerance-popup': true }).props.onKeyDown({
      key: 'Enter', metaKey: true, ctrlKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn(),
    }));
    expect(value.onApply).not.toHaveBeenCalled();
  });

  it('blocks stale standard preview after override input edits until override preview completes', async () => {
    const onOverridePreview = vi.fn(async () => undefined);
    const { tree } = renderPopup({
      dirty: true, override: { upperDeviation: .05, lowerDeviation: .04 }, onOverridePreview,
    });
    editDeviation(tree, 'upper');
    act(() => tree.root.findByProps({ 'data-tolerance-override': 'upper' }).props.onChange({ currentTarget: { value: '0.06' } }));
    expect(tree.root.findByProps({ 'data-apply-tolerance': true }).props.disabled).toBe(true);
    expect(tree.root.findAllByProps({ 'data-tolerance-result': true })).toHaveLength(1);

    await act(async () => tree.root.findByProps({ 'data-confirm-inline-override': 'upper' }).props.onClick());
    expect(onOverridePreview).toHaveBeenCalledWith({ upperDeviation: .06, lowerDeviation: .04 });
    expect(tree.root.findByProps({ 'data-apply-tolerance': true }).props.disabled).toBe(false);
  });

  it('does not re-enable Apply when an older override preview settles after another edit', async () => {
    let resolvePreview!: () => void;
    const onOverridePreview = vi.fn(() => new Promise<void>((resolve) => { resolvePreview = resolve; }));
    const { tree } = renderPopup({
      dirty: true, override: { upperDeviation: .05, lowerDeviation: .04 }, onOverridePreview,
    });
    editDeviation(tree, 'upper');
    const upper = tree.root.findByProps({ 'data-tolerance-override': 'upper' });
    act(() => upper.props.onChange({ currentTarget: { value: '0.06' } }));
    act(() => tree.root.findByProps({ 'data-confirm-inline-override': 'upper' }).props.onClick());
    act(() => upper.props.onChange({ currentTarget: { value: '0.07' } }));
    await act(async () => resolvePreview());

    expect(tree.root.findByProps({ 'data-apply-tolerance': true }).props.disabled).toBe(true);
    expect(tree.root.findAllByProps({ 'data-tolerance-result': true })).toHaveLength(1);
  });

  it('invalidates manual readiness when either manual input changes after preview', () => {
    const unsupported = {
      ...target,
      classification: { status: 'unsupported' as const, code: 'TOLERANCE_FEATURE_UNSUPPORTED' as const },
    };
    const { tree } = renderPopup({ target: unsupported, bands: [], preview: null, dirty: true });
    openManualSettings(tree);
    act(() => tree.root.findByProps({ 'data-manual-deviation': 'upper' }).props.onChange({ currentTarget: { value: '0.02' } }));
    act(() => tree.root.findByProps({ 'data-preview-manual': true }).props.onClick());
    expect(tree.root.findByProps({ 'data-apply-tolerance': true }).props.disabled).toBe(false);

    act(() => tree.root.findByProps({ 'data-manual-deviation': 'lower' }).props.onChange({ currentTarget: { value: '-0.01' } }));
    expect(tree.root.findByProps({ 'data-apply-tolerance': true }).props.disabled).toBe(true);
  });

  it('blocks a stale fit preview after either fit selector changes until re-preview', async () => {
    const internalBands = [
      { designation: 'H7', featureClass: 'internal' as const, category: 'preferred' as const, available: true },
    ];
    const externalBands = [
      { designation: 'g6', featureClass: 'external' as const, category: 'preferred' as const, available: true },
      { designation: 'u6', featureClass: 'external' as const, category: 'common' as const, available: true },
    ];
    const onPreview = vi.fn(async () => undefined);
    const { tree } = renderPopup({
      dirty: true, tab: 'hole-fit', preview: fitPreview,
      fitCatalogs: { internal: internalBands, external: externalBands }, onPreview,
    });
    act(() => tree.root.findByProps({ 'data-fit-band': 'internal' }).props.onChange({ currentTarget: { value: 'H7' } }));
    await act(async () => tree.root.findByProps({ 'data-fit-band': 'external' }).props.onChange({ currentTarget: { value: 'g6' } }));
    expect(onPreview).toHaveBeenCalledWith('H7/g6');
    expect(tree.root.findByProps({ 'data-apply-tolerance': true }).props.disabled).toBe(false);

    act(() => tree.root.findByProps({ 'data-fit-band': 'external' }).props.onChange({ currentTarget: { value: 'u6' } }));
    expect(tree.root.findByProps({ 'data-apply-tolerance': true }).props.disabled).toBe(true);
    expect(tree.root.findAllByProps({ 'data-tolerance-fit-result': true })).toHaveLength(0);
  });

  it('keeps edited fit selectors invalid after switching tabs until a fresh standard preview', async () => {
    const internalBands = [
      { designation: 'H7', featureClass: 'internal' as const, category: 'preferred' as const, available: true },
    ];
    const externalBands = [
      { designation: 'g6', featureClass: 'external' as const, category: 'preferred' as const, available: true },
      { designation: 'u6', featureClass: 'external' as const, category: 'common' as const, available: true },
    ];
    const pendingTarget = { ...target, dimensionIntentId: 'intent-2' };
    const value = props({
      dirty: true, tab: 'hole-fit', preview: fitPreview, pendingTarget, closeDecision: 'dirty',
      fitCatalogs: { internal: internalBands, external: externalBands },
    });
    const tree = create(<TolerancePopup {...value} />);
    act(() => tree.root.findByProps({ 'data-fit-band': 'internal' }).props.onChange({ currentTarget: { value: 'H7' } }));
    act(() => tree.root.findByProps({ 'data-fit-band': 'external' }).props.onChange({ currentTarget: { value: 'u6' } }));
    act(() => tree.update(<TolerancePopup {...value} tab="external" />));

    expect(tree.root.findByProps({ 'data-apply-tolerance': true }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ 'data-dirty-close': 'apply' }).props.disabled).toBe(true);
    expect(tree.root.findByProps({ 'data-dirty-switch': 'apply' }).props.disabled).toBe(true);
    expect(tree.root.findAllByProps({ 'data-tolerance-fit-result': true })).toHaveLength(0);

    await act(async () => tree.root.findByProps({ 'data-tolerance-band': 'u6' }).props.onClick());
    act(() => tree.update(<TolerancePopup {...value} tab="external" preview={preview} />));
    expect(value.onPreview).toHaveBeenCalledWith('u6');
    expect(tree.root.findByProps({ 'data-apply-tolerance': true }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ 'data-dirty-close': 'apply' }).props.disabled).toBe(false);
    expect(tree.root.findByProps({ 'data-dirty-switch': 'apply' }).props.disabled).toBe(false);
  });

  it('discards an unconfirmed manual override when cancelling the editor', async () => {
    const value = props({ dirty: false, override: null, preview });
    const tree = create(<TolerancePopup {...value} />);
    editDeviation(tree, 'upper');
    act(() => tree.root.findByProps({ 'data-tolerance-override': 'upper' }).props.onChange({ currentTarget: { value: '0.05' } }));
    expect(tree.root.findByProps({ 'data-apply-tolerance': true }).props.disabled).toBe(true);
    expect(tree.root.findAllByProps({ 'data-tolerance-result': true })).toHaveLength(1);

    act(() => tree.root.findByProps({ 'data-cancel-manual-override': 'upper' }).props.onClick());
    expect(value.onRestoreStandard).not.toHaveBeenCalled();
    expect(tree.root.findAllByProps({ 'data-tolerance-override': 'upper' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ 'data-tolerance-override': 'lower' })).toHaveLength(0);
    expect(tree.root.findByProps({ 'data-apply-tolerance': true }).props.disabled).toBe(true);
    expect(tree.root.findAllByProps({ 'data-tolerance-result': true })).toHaveLength(1);

    await act(async () => tree.root.findByProps({ 'data-tolerance-band': 'u6' }).props.onClick());
    act(() => tree.update(<TolerancePopup {...value} dirty preview={preview} />));
    expect(tree.root.findByProps({ 'data-apply-tolerance': true }).props.disabled).toBe(false);
    expect(tree.root.findAllByProps({ 'data-tolerance-result': true })).toHaveLength(1);
  });

  it('cancels inline deviation editing with Escape without closing the tolerance popup', () => {
    const { tree, value } = renderPopup();
    editDeviation(tree, 'upper');
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    act(() => tree.root.findByProps({ 'data-tolerance-override': 'upper' }).props.onKeyDown({
      key: 'Escape', preventDefault, stopPropagation,
    }));

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(value.onRequestClose).not.toHaveBeenCalled();
    expect(tree.root.findAllByProps({ 'data-tolerance-override': 'upper' })).toHaveLength(0);
  });

  it('combines only provider-backed internal and external bands into a direct fit preview', async () => {
    const internalBands = [
      { designation: 'H7', featureClass: 'internal' as const, category: 'preferred' as const, available: true },
      { designation: 'G7', featureClass: 'internal' as const, category: 'other' as const, available: false, unavailableCode: 'TOLERANCE_STANDARD_UNAVAILABLE' as const },
    ];
    const externalBands = [
      { designation: 'g6', featureClass: 'external' as const, category: 'preferred' as const, available: true },
      { designation: 'u6', featureClass: 'external' as const, category: 'other' as const, available: false, unavailableCode: 'TOLERANCE_STANDARD_UNAVAILABLE' as const },
    ];
    const { tree, value } = renderPopup({
      tab: 'hole-fit',
      fitCatalogs: { internal: internalBands, external: externalBands },
    });
    act(() => tree.root.findByProps({ 'data-fit-band': 'internal' }).props.onChange({ currentTarget: { value: 'H7' } }));
    await act(async () => tree.root.findByProps({ 'data-fit-band': 'external' }).props.onChange({ currentTarget: { value: 'g6' } }));
    expect(tree.root.findAllByProps({ 'data-preview-fit': true })).toHaveLength(0);
    expect(value.onPreview).toHaveBeenCalledWith('H7/g6');
    expect(tree.root.findByProps({ 'data-fit-band': 'internal' }).findAllByType('option').map(({ props }) => props.value)).toEqual(['', 'H7', 'G7']);
    expect(tree.root.findByProps({ 'data-fit-option': 'G7' }).props).toMatchObject({ disabled: true, title: 'TOLERANCE_STANDARD_UNAVAILABLE' });
  });

  it('resets target-local override and manual inputs when the target identity changes', () => {
    const initial = props({ override: { upperDeviation: .05, lowerDeviation: .04 } });
    const tree = create(<TolerancePopup {...initial} />);
    editDeviation(tree, 'upper');
    act(() => tree.root.findByProps({ 'data-tolerance-override': 'upper' }).props.onChange({ currentTarget: { value: '9' } }));
    act(() => tree.update(<TolerancePopup {...initial} target={{ ...target, dimensionIntentId: 'intent-2' }} override={null} />));
    editDeviation(tree, 'upper');
    expect(tree.root.findByProps({ 'data-tolerance-override': 'upper' }).props.value).toBe('0.044');
  });

  it('reflects same-target Host override hydration and restore-standard clearing', () => {
    const initial = props({ override: null });
    const tree = create(<TolerancePopup {...initial} />);
    editDeviation(tree, 'upper');

    act(() => tree.update(<TolerancePopup {...initial} override={{ upperDeviation: .05, lowerDeviation: .04 }} />));
    expect(tree.root.findByProps({ 'data-tolerance-override': 'upper' }).props.value).toBe('0.05');

    act(() => tree.update(<TolerancePopup {...initial} override={null} />));
    expect(tree.root.findByProps({ 'data-tolerance-override': 'upper' }).props.value).toBe('');
  });

  it('uses one blocked/busy predicate for keyboard and button apply and suppresses duplicates', async () => {
    let resolveApply!: () => void;
    const onApply = vi.fn(() => new Promise<void>((resolve) => { resolveApply = resolve; }));
    const { tree } = renderPopup({ onApply, dirty: true });
    const root = tree.root.findByProps({ 'data-tolerance-popup': true });
    await act(async () => {
      root.props.onKeyDown({ key: 'Enter', metaKey: true, ctrlKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() });
      root.props.onKeyDown({ key: 'Enter', metaKey: true, ctrlKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() });
    });
    expect(onApply).toHaveBeenCalledOnce();
    expect(tree.root.findByProps({ 'data-apply-tolerance': true }).props.disabled).toBe(true);
    await act(async () => resolveApply());

    const blocked = renderPopup({ busy: true }).tree;
    act(() => blocked.root.findByProps({ 'data-tolerance-popup': true }).props.onKeyDown({
      key: 'Enter', metaKey: true, ctrlKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn(),
    }));
    expect(blocked.root.findByProps({ 'data-apply-tolerance': true }).props.disabled).toBe(true);
  });

  it('does not expose internal diagnostics when no automatic recommendation is available', () => {
    const tree = renderPopup({ recommendation: null }).tree;
    expect(tree.root.findAllByProps({ 'data-restore-recommendation': true })).toHaveLength(0);
    expect(tree.root.findAllByProps({ 'data-recommendation-unavailable': true })).toHaveLength(0);
  });

  it('keeps a dedicated notice row and the action footer outside scrollable content', () => {
    const tree = renderPopup().tree;
    expect(tree.root.findByProps({ 'data-tolerance-notices': true })).toBeDefined();
    expect(tree.root.findByProps({ 'data-tolerance-content': true })).toBeDefined();
    expect(tree.root.findByProps({ 'data-tolerance-footer': true })).toBeDefined();
  });

  it('retains an async Apply failure as an in-popup diagnostic', async () => {
    const tree = renderPopup({ dirty: true, onApply: vi.fn(async () => { throw new Error('REMOTE_APPLY_FAILED'); }) }).tree;
    await act(async () => {
      tree.root.findByProps({ 'data-apply-tolerance': true }).props.onClick();
    });
    expect(tree.root.findAllByProps({ role: 'alert' }).some(({ children }) => children.includes('REMOTE_APPLY_FAILED'))).toBe(true);
  });

  it('renders known Host errors as user-facing guidance instead of protocol codes', () => {
    const tree = renderPopup({ error: 'TOLERANCE_FEATURE_CLASS_AMBIGUOUS' }).tree;
    const alert = tree.root.findByProps({ role: 'alert' });
    expect(alert.children.join('')).toContain('重新选择尺寸类型');
    expect(alert.children.join('')).not.toContain('TOLERANCE_FEATURE_CLASS_AMBIGUOUS');
  });
});
