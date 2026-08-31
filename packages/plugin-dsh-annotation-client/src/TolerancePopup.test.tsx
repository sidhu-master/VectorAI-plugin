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
    standardRef: { id: 'GB/T 1800', edition: '2020' },
    ruleRef: { id: 'GB/T 1800', version: '2020', inputDigest: 'sha256:x' },
  },
};

function props(overrides: Partial<TolerancePopupProps> = {}): TolerancePopupProps {
  return {
    geometry: { x: 100, y: 80, width: 700, height: 480 },
    viewport: { width: 1_000, height: 700 },
    target,
    bands,
    tab: 'external', zoom: 1, standardEdition: '2020',
    datasetCompleteness: 'partial',
    preview,
    displayPreference: 'deviations',
    dirty: false, closeDecision: null, busy: false, error: null,
    onPreview: vi.fn(), onApply: vi.fn(), onRequestClose: vi.fn(),
    onDiscardClose: vi.fn(), onApplyClose: vi.fn(), onGeometryChange: vi.fn(),
    onTabChange: vi.fn(), onZoomChange: vi.fn(), onDisplayPreferenceChange: vi.fn(),
    onOverridePreview: vi.fn(), onRestoreStandard: vi.fn(), onRestoreRecommendation: vi.fn(),
    onFeatureClassChoice: vi.fn(), onManualPreview: vi.fn(),
    ...overrides,
  };
}

function renderPopup(overrides: Partial<TolerancePopupProps> = {}): { tree: ReactTestRenderer; value: TolerancePopupProps } {
  const value = props(overrides);
  return { tree: create(<TolerancePopup {...value} />), value };
}

describe('TolerancePopup', () => {
  it('previews on click, applies with Command/Control+Enter, and isolates canvas events', () => {
    const { tree, value } = renderPopup();
    act(() => tree.root.findByProps({ 'data-tolerance-band': 'u6' }).props.onClick());
    expect(value.onPreview).toHaveBeenCalledWith('u6');
    const root = tree.root.findByProps({ 'data-tolerance-popup': true });
    const preventDefault = vi.fn();
    act(() => root.props.onKeyDown({ key: 'Enter', metaKey: true, ctrlKey: false, preventDefault }));
    act(() => root.props.onKeyDown({ key: 'Enter', metaKey: false, ctrlKey: true, preventDefault }));
    expect(value.onApply).toHaveBeenCalledTimes(2);
    expect(preventDefault).toHaveBeenCalledTimes(2);

    for (const handler of ['onPointerDown', 'onMouseDown', 'onClick', 'onContextMenu', 'onWheel'] as const) {
      const stopPropagation = vi.fn();
      act(() => root.props[handler]({ stopPropagation }));
      expect(stopPropagation, handler).toHaveBeenCalledOnce();
    }
  });

  it('shows Host-returned single and fit values without deriving replacement values', () => {
    const single = renderPopup().tree.root.findByProps({ 'data-tolerance-result': true });
    expect(single.findAllByType('dd').flatMap(({ children }) => children)).toEqual(expect.arrayContaining([
      'u6', '13', '0.044', '0.033', '13.044', '13.033',
    ]));
    const fitPreview = {
      type: 'fit' as const, drawingRef: target.drawingRef,
      holeDimensionIntentId: 'hole-1', shaftDimensionIntentId: 'shaft-1', status: 'resolved' as const,
      result: {
        designation: 'H7/g6', basis: 'hole' as const,
        hole: { ...preview.result, designation: 'H7', featureClass: 'internal' as const, upperDeviation: .018, lowerDeviation: 0, upperLimitSize: 13.018, lowerLimitSize: 13 },
        shaft: { ...preview.result, designation: 'g6', upperDeviation: -.006, lowerDeviation: -.017, upperLimitSize: 12.994, lowerLimitSize: 12.983 },
        fitType: 'clearance' as const, minimumClearance: .006, maximumClearance: .035,
      },
    };
    const fit = renderPopup({ preview: fitPreview }).tree.root.findByProps({ 'data-tolerance-fit-result': true });
    expect(fit.findAllByType('dd').flatMap(({ children }) => children)).toEqual(expect.arrayContaining([
      'H7/g6', 'clearance', '0.006', '0.035',
    ]));
  });

  it('switches explicit internal/external and fit tabs and reports partial data', () => {
    const { tree, value } = renderPopup();
    act(() => tree.root.findByProps({ 'data-tolerance-tab': 'internal' }).props.onClick());
    act(() => tree.root.findByProps({ 'data-tolerance-tab': 'hole-fit' }).props.onClick());
    expect(value.onTabChange).toHaveBeenNthCalledWith(1, 'internal');
    expect(value.onTabChange).toHaveBeenNthCalledWith(2, 'hole-fit');
    expect(tree.root.findByProps({ 'data-tolerance-dataset': 'partial' }).children.join('')).toContain('部分数据');
  });

  it('drags only from the title and clamps southeast resizing to viewport limits', () => {
    const { tree, value } = renderPopup();
    const root = tree.root.findByProps({ 'data-tolerance-popup': true });
    act(() => root.props.onPointerMove({ clientX: 500, clientY: 500 }));
    expect(value.onGeometryChange).not.toHaveBeenCalled();

    const setPointerCapture = vi.fn();
    act(() => tree.root.findByProps({ 'data-tolerance-title': true }).props.onPointerDown({
      clientX: 120, clientY: 100, pointerId: 4, currentTarget: { setPointerCapture }, stopPropagation: vi.fn(),
    }));
    act(() => root.props.onPointerMove({ clientX: 160, clientY: 135 }));
    expect(setPointerCapture).toHaveBeenCalledWith(4);
    expect(value.onGeometryChange).toHaveBeenLastCalledWith({ x: 140, y: 115, width: 700, height: 480 }, { userDragged: true });

    act(() => root.props.onPointerUp());
    act(() => tree.root.findByProps({ 'data-tolerance-resize': 'se' }).props.onPointerDown({
      clientX: 800, clientY: 560, pointerId: 5, currentTarget: { setPointerCapture }, stopPropagation: vi.fn(),
    }));
    act(() => root.props.onPointerMove({ clientX: 2_000, clientY: 2_000 }));
    expect(value.onGeometryChange).toHaveBeenLastCalledWith({ x: 100, y: 80, width: 800, height: 560 }, { userDragged: true });
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

  it('owns display preference and standard/manual override controls', () => {
    const { tree, value } = renderPopup();
    act(() => tree.root.findByProps({ 'data-display-preference': 'designation' }).props.onClick());
    act(() => tree.root.findByProps({ 'data-display-preference': 'both' }).props.onClick());
    expect(value.onDisplayPreferenceChange).toHaveBeenNthCalledWith(1, 'designation');
    expect(value.onDisplayPreferenceChange).toHaveBeenNthCalledWith(2, 'both');

    const upper = tree.root.findByProps({ 'data-tolerance-override': 'upper' });
    const lower = tree.root.findByProps({ 'data-tolerance-override': 'lower' });
    act(() => upper.props.onChange({ currentTarget: { value: '0.05' } }));
    act(() => lower.props.onChange({ currentTarget: { value: '0.04' } }));
    act(() => tree.root.findByProps({ 'data-preview-override': true }).props.onClick());
    expect(value.onOverridePreview).toHaveBeenCalledWith({ upperDeviation: .05, lowerDeviation: .04 });
    act(() => tree.root.findByProps({ 'data-restore-standard': true }).props.onClick());
    act(() => tree.root.findByProps({ 'data-restore-recommendation': true }).props.onClick());
    expect(value.onRestoreStandard).toHaveBeenCalledOnce();
    expect(value.onRestoreRecommendation).toHaveBeenCalledOnce();
  });

  it('shows stable unsupported diagnostics and manual fallback only when accepted', () => {
    const unsupported = { ...target, classification: { status: 'unsupported' as const, code: 'TOLERANCE_FEATURE_UNSUPPORTED' as const } };
    const { tree, value } = renderPopup({ target: unsupported, bands: [], preview: null });
    expect(tree.root.findByProps({ 'data-tolerance-diagnostic': true }).children).toContain('TOLERANCE_FEATURE_UNSUPPORTED');
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
    const { tree, value } = renderPopup({ target: ambiguous, bands: [], preview: null });
    expect(tree.root.findByProps({ 'data-tolerance-diagnostic': true }).children).toContain('TOLERANCE_FEATURE_CLASS_AMBIGUOUS');
    act(() => tree.root.findByProps({ 'data-feature-class-choice': 'internal' }).props.onClick());
    act(() => tree.root.findByProps({ 'data-feature-class-choice': 'external' }).props.onClick());
    expect(value.onFeatureClassChoice).toHaveBeenNthCalledWith(1, 'internal');
    expect(value.onFeatureClassChoice).toHaveBeenNthCalledWith(2, 'external');
    expect(tree.root.findByProps({ 'data-apply-tolerance': true }).props.disabled).toBe(true);
  });
});
