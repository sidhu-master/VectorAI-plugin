// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { ToleranceCatalogResult, TolerancePreviewResult } from '@vectorai/plugin-space-contracts';

import {
  createToleranceController,
  type TolerancePopupStorage,
  type ToleranceRemote,
  type ToleranceTarget,
} from './tolerance-controller';

const drawingRef = { drawingId: 'drawing-1', revision: 3 } as const;
const externalTarget: ToleranceTarget = {
  dimensionIntentId: 'intent-1',
  drawingRef,
  anchor: { x: 300, y: 180 },
  annotationBounds: { x: 280, y: 160, width: 80, height: 32 },
  viewport: { width: 1_200, height: 800 },
  basicSize: 13,
  classification: { status: 'resolved', featureClass: 'external' },
  acceptsManualTolerance: true,
};

function catalog(dimensionIntentId = 'intent-1', featureClass: 'internal' | 'external' = 'external') {
  return {
    drawingRef,
    dimensionIntentId,
    featureClass,
    standardRef: { id: 'GB/T 1800', edition: '2020' },
    datasetMetadata: {
      completeness: 'partial' as const,
      catalogClassification: 'unverified' as const,
      numericProvenance: [{ kind: 'plan-reference-vector' as const, referenceId: 'plan', description: 'Partial data' }],
    },
    bands: [
      { designation: featureClass === 'external' ? 'u6' : 'H7', featureClass, category: 'unknown' as const, available: true },
      { designation: featureClass === 'external' ? 'h6' : 'G7', featureClass, category: 'unknown' as const, available: false, unavailableCode: 'TOLERANCE_STANDARD_UNAVAILABLE' as const },
    ],
    recommendation: { designation: featureClass === 'external' ? 'u6' : 'H7', source: 'ai-recommended' as const, evidenceRefs: ['evidence-1'] },
  };
}

function singlePreview(dimensionIntentId = 'intent-1', designation = 'u6', featureClass: 'internal' | 'external' = 'external') {
  return {
    type: 'single' as const,
    drawingRef,
    dimensionIntentId,
    status: 'resolved' as const,
    result: {
      designation,
      featureClass,
      basicSize: 13,
      unit: 'mm' as const,
      upperDeviation: .044,
      lowerDeviation: .033,
      toleranceMagnitude: .011,
      upperLimitSize: 13.044,
      lowerLimitSize: 13.033,
      standardRef: { id: 'GB/T 1800', edition: '2020' },
      ruleRef: { id: 'GB/T 1800', version: '2020', inputDigest: 'sha256:input' },
    },
  };
}

function remote(overrides: Partial<ToleranceRemote> = {}): ToleranceRemote {
  return {
    queryToleranceCatalog: vi.fn(async (_sessionId, request) => success(catalog(request.dimensionIntentId, request.featureClass))),
    previewTolerance: vi.fn(async (_sessionId, request) => success(request.type === 'single'
        ? singlePreview(request.dimensionIntentId, request.designation, request.featureClass)
        : {
          type: 'fit' as const, drawingRef,
          holeDimensionIntentId: request.holeDimensionIntentId,
          shaftDimensionIntentId: request.shaftDimensionIntentId,
          status: 'resolved' as const,
          result: {
            designation: request.designation, basis: request.basis,
            hole: singlePreview(request.holeDimensionIntentId, 'H7', 'internal').result,
            shaft: singlePreview(request.shaftDimensionIntentId, 'g6', 'external').result,
            fitType: 'clearance' as const, minimumClearance: .006, maximumClearance: .035,
          },
        })),
    editTolerance: vi.fn(async () => success({
      version: 1 as const, phase: 'editing' as const, drawingRef, canUndo: true, canRedo: false, updatedAt: 1,
    })),
    ...overrides,
  };
}

function memoryStorage(initial?: unknown): TolerancePopupStorage & { writes: string[] } {
  let value = initial === undefined ? null : JSON.stringify(initial);
  const writes: string[] = [];
  return {
    writes,
    getItem: () => value,
    setItem: (_key, next) => { value = next; writes.push(next); },
  };
}

describe('createToleranceController', () => {
  it('keeps one popup instance and requires a dirty-switch decision', async () => {
    const api = remote();
    const controller = createToleranceController({ remote: api, sessionId: 's', storage: memoryStorage() });
    await controller.actions.open(externalTarget);
    await controller.actions.preview({ kind: 'single', featureClass: 'external', designation: 'u6' });
    controller.actions.requestTarget({ ...externalTarget, dimensionIntentId: 'intent-2', anchor: { x: 410, y: 210 } });
    expect(controller.state.getSnapshot()).toMatchObject({
      instanceId: 1, visible: true, dirty: true, pendingTarget: { dimensionIntentId: 'intent-2' },
    });

    await controller.actions.applyAndSwitch();

    expect(controller.state.getSnapshot()).toMatchObject({
      instanceId: 1, target: { dimensionIntentId: 'intent-2' }, pendingTarget: null, dirty: false,
    });
    expect(api.editTolerance).toHaveBeenCalledOnce();
  });

  it('discards a dirty preview before switching and switches clean targets immediately', async () => {
    const controller = createToleranceController({ remote: remote(), sessionId: 's', storage: memoryStorage() });
    await controller.actions.open(externalTarget);
    await controller.actions.preview({ kind: 'single', featureClass: 'external', designation: 'u6' });
    controller.actions.requestTarget({ ...externalTarget, dimensionIntentId: 'intent-2' });
    await controller.actions.discardAndSwitch();
    expect(controller.state.getSnapshot()).toMatchObject({
      target: { dimensionIntentId: 'intent-2' }, preview: null, selection: null, dirty: false,
    });

    controller.actions.requestTarget({ ...externalTarget, dimensionIntentId: 'intent-3' });
    await vi.waitFor(() => expect(controller.state.getSnapshot().target?.dimensionIntentId).toBe('intent-3'));
    expect(controller.state.getSnapshot().pendingTarget).toBeNull();
  });

  it('closes immediately when clean and requires an explicit dirty close action', async () => {
    const api = remote();
    const controller = createToleranceController({ remote: api, sessionId: 's', storage: memoryStorage() });
    await controller.actions.open(externalTarget);
    controller.actions.requestClose();
    expect(controller.state.getSnapshot()).toMatchObject({ visible: false, closeDecision: null });

    await controller.actions.open(externalTarget);
    await controller.actions.preview({ kind: 'single', featureClass: 'external', designation: 'u6' });
    controller.actions.requestClose();
    expect(controller.state.getSnapshot()).toMatchObject({ visible: true, closeDecision: 'dirty' });
    controller.actions.discardAndClose();
    expect(controller.state.getSnapshot()).toMatchObject({ visible: false, dirty: false, preview: null });

    await controller.actions.open(externalTarget);
    await controller.actions.preview({ kind: 'single', featureClass: 'external', designation: 'u6' });
    controller.actions.requestClose();
    await controller.actions.applyAndClose();
    expect(controller.state.getSnapshot()).toMatchObject({ visible: false, dirty: false });
    expect(api.editTolerance).toHaveBeenCalledOnce();
  });

  it('validates a complementary equal-size second target before fit preview', async () => {
    const controller = createToleranceController({ remote: remote(), sessionId: 's', storage: memoryStorage() });
    await controller.actions.open({ ...externalTarget, classification: { status: 'resolved', featureClass: 'internal' } });
    controller.actions.beginFit('hole');
    controller.actions.selectFitTarget({
      ...externalTarget, dimensionIntentId: 'shaft-1', classification: { status: 'resolved', featureClass: 'external' },
    });
    expect(controller.state.getSnapshot()).toMatchObject({
      fit: { basis: 'hole', selectingSecondTarget: false, secondTarget: { dimensionIntentId: 'shaft-1' } }, error: null,
    });

    controller.actions.beginFit('hole');
    controller.actions.selectFitTarget({
      ...externalTarget, dimensionIntentId: 'hole-2', classification: { status: 'resolved', featureClass: 'internal' },
    });
    expect(controller.state.getSnapshot()).toMatchObject({ error: 'FIT_PAIR_CLASS_INCOMPATIBLE', fit: { selectingSecondTarget: true } });

    controller.actions.selectFitTarget({
      ...externalTarget, dimensionIntentId: 'shaft-2', basicSize: 14, classification: { status: 'resolved', featureClass: 'external' },
    });
    expect(controller.state.getSnapshot()).toMatchObject({ error: 'FIT_PAIR_BASIC_SIZE_MISMATCH', fit: { selectingSecondTarget: true } });
  });

  it('clamps restored bounds and persists preferences without preview values', async () => {
    const storage = memoryStorage({
      x: 9_000, y: -200, width: 2_000, height: 2_000,
      tab: 'internal', zoom: 9, standardEdition: '2020',
      preview: { designation: 'must-not-return' }, dirty: true,
    });
    const controller = createToleranceController({
      remote: remote(), sessionId: 's', storage, viewport: { width: 1_000, height: 700 },
    });
    expect(controller.state.getSnapshot()).toMatchObject({
      geometry: { x: 200, y: 0, width: 800, height: 560 }, tab: 'internal', zoom: 2,
      preview: null, dirty: false,
    });
    controller.actions.setTab('external');
    controller.actions.setZoom(1.25);
    const persisted = JSON.parse(storage.writes.at(-1)!);
    expect(persisted).toEqual({
      x: 200, y: 0, width: 800, height: 560, tab: 'external', zoom: 1.25, standardEdition: '2020',
    });
  });

  it('retains the last catalog and preview when later remote calls fail', async () => {
    let failQuery = false;
    let failPreview = false;
    const api = remote({
      queryToleranceCatalog: vi.fn(async (_sessionId, request) => failQuery
        ? failure<ToleranceCatalogResult>('TOLERANCE_STANDARD_UNAVAILABLE')
        : success<ToleranceCatalogResult>(catalog(request.dimensionIntentId, request.featureClass))),
      previewTolerance: vi.fn(async (_sessionId, request) => failPreview
        ? failure<TolerancePreviewResult>('TOLERANCE_RESULT_INVALID')
        : success<TolerancePreviewResult>(singlePreview(request.type === 'single' ? request.dimensionIntentId : 'intent-1'))),
    });
    const controller = createToleranceController({ remote: api, sessionId: 's', storage: memoryStorage() });
    await controller.actions.open(externalTarget);
    await controller.actions.preview({ kind: 'single', featureClass: 'external', designation: 'u6' });
    const firstCatalog = controller.state.getSnapshot().catalog;
    const firstPreview = controller.state.getSnapshot().preview;

    failQuery = true;
    await expect(controller.actions.refreshCatalog()).rejects.toThrow('TOLERANCE_STANDARD_UNAVAILABLE');
    expect(controller.state.getSnapshot()).toMatchObject({ catalog: firstCatalog, preview: firstPreview, error: 'TOLERANCE_STANDARD_UNAVAILABLE' });
    failPreview = true;
    await expect(controller.actions.preview({ kind: 'single', featureClass: 'external', designation: 'h6' })).rejects.toThrow('TOLERANCE_RESULT_INVALID');
    expect(controller.state.getSnapshot()).toMatchObject({ catalog: firstCatalog, preview: firstPreview, error: 'TOLERANCE_RESULT_INVALID' });
  });

  it('preserves partial and unavailable provider semantics without filtering or recategorizing', async () => {
    const controller = createToleranceController({ remote: remote(), sessionId: 's', storage: memoryStorage() });
    await controller.actions.open(externalTarget);
    expect(controller.state.getSnapshot().catalog).toMatchObject({
      datasetMetadata: { completeness: 'partial', catalogClassification: 'unverified' },
      bands: [
        { designation: 'u6', category: 'unknown', available: true },
        { designation: 'h6', category: 'unknown', available: false, unavailableCode: 'TOLERANCE_STANDARD_UNAVAILABLE' },
      ],
    });
  });

  it('requires an explicit class choice for an ambiguous target and gates manual fallback', async () => {
    const api = remote();
    const controller = createToleranceController({ remote: api, sessionId: 's', storage: memoryStorage() });
    await controller.actions.open({
      ...externalTarget,
      classification: { status: 'ambiguous', code: 'TOLERANCE_FEATURE_CLASS_AMBIGUOUS' },
      acceptsManualTolerance: false,
    });
    expect(api.queryToleranceCatalog).not.toHaveBeenCalled();
    await controller.actions.chooseFeatureClass('internal');
    expect(api.queryToleranceCatalog).toHaveBeenCalledWith('s', expect.objectContaining({ featureClass: 'internal' }));

    await controller.actions.open({
      ...externalTarget, dimensionIntentId: 'radius-1',
      classification: { status: 'unsupported', code: 'TOLERANCE_FEATURE_UNSUPPORTED' },
      acceptsManualTolerance: false,
    });
    expect(() => controller.actions.previewManual({ upperDeviation: .02, lowerDeviation: -.01 })).toThrow('TOLERANCE_MANUAL_UNSUPPORTED');

    await controller.actions.open({
      ...externalTarget, dimensionIntentId: 'legacy-1',
      classification: { status: 'unsupported', code: 'TOLERANCE_FEATURE_UNSUPPORTED' },
      acceptsManualTolerance: true,
    });
    controller.actions.previewManual({ upperDeviation: .02, lowerDeviation: -.01 });
    expect(controller.state.getSnapshot()).toMatchObject({ dirty: true, selection: { kind: 'manual', upperDeviation: .02, lowerDeviation: -.01 } });
  });

  it('keeps provider results immutable while previewing and clearing overrides', async () => {
    const controller = createToleranceController({ remote: remote(), sessionId: 's', storage: memoryStorage() });
    await controller.actions.open(externalTarget);
    await controller.actions.preview({ kind: 'single', featureClass: 'external', designation: 'u6' });
    const providerResult = structuredClone(controller.state.getSnapshot().preview);
    await controller.actions.previewOverride({ upperDeviation: .05, lowerDeviation: .04 });
    expect(controller.state.getSnapshot()).toMatchObject({
      preview: providerResult, override: { upperDeviation: .05, lowerDeviation: .04 }, dirty: true,
      canvasPreview: {
        host: providerResult,
        override: { upperDeviation: .05, lowerDeviation: .04 },
        displayPreference: 'deviations',
      },
    });
    controller.actions.restoreStandard();
    expect(controller.state.getSnapshot()).toMatchObject({
      preview: providerResult, override: null, dirty: true,
      canvasPreview: { host: providerResult, override: null, displayPreference: 'deviations' },
    });
    controller.actions.setDisplayPreference('both');
    expect(controller.state.getSnapshot()).toMatchObject({
      displayPreference: 'both', dirty: true,
      canvasPreview: { host: providerResult, override: null, displayPreference: 'both' },
    });
  });

  it('hydrates an existing standard selection through the Host without making it dirty', async () => {
    const api = remote({
      queryToleranceCatalog: vi.fn(async (_sessionId, request) => success<ToleranceCatalogResult>({
        ...catalog(request.dimensionIntentId, request.featureClass),
        selection: {
          designation: 'u6', source: 'manual', evidenceRefs: ['existing:tolerance'], displayPreference: 'both',
          override: { upperDeviation: .05, lowerDeviation: .04 },
        },
      })),
    });
    const controller = createToleranceController({ remote: api, sessionId: 's', storage: memoryStorage() });

    await controller.actions.openFromDesignationDoubleClick(externalTarget);

    expect(api.previewTolerance).toHaveBeenCalledWith('s', expect.objectContaining({ designation: 'u6' }));
    expect(controller.state.getSnapshot()).toMatchObject({
      dirty: false,
      selection: { kind: 'single', designation: 'u6', source: 'manual', evidenceRefs: ['existing:tolerance'] },
      preview: { result: { designation: 'u6' } },
      override: { upperDeviation: .05, lowerDeviation: .04 },
      displayPreference: 'both',
      canvasPreview: {
        host: { result: { designation: 'u6' } },
        override: { upperDeviation: .05, lowerDeviation: .04 }, displayPreference: 'both',
      },
    });
  });

  it('applies override set and restore-standard as one Host edit each', async () => {
    const api = remote({
      queryToleranceCatalog: vi.fn(async (_sessionId, request) => success<ToleranceCatalogResult>({
        ...catalog(request.dimensionIntentId, request.featureClass),
        selection: {
          designation: 'u6', source: 'manual', evidenceRefs: ['existing:tolerance'], displayPreference: 'deviations',
        },
      })),
    });
    const controller = createToleranceController({ remote: api, sessionId: 's', storage: memoryStorage() });
    await controller.actions.open(externalTarget);
    await controller.actions.previewOverride({ upperDeviation: .05, lowerDeviation: .04 });

    await controller.actions.apply();

    expect(api.editTolerance).toHaveBeenCalledTimes(1);
    expect(api.editTolerance).toHaveBeenLastCalledWith('s', {
      type: 'standard.override.set', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-1',
      upperDeviation: .05, lowerDeviation: .04,
    });

    controller.actions.restoreStandard();
    expect(controller.state.getSnapshot().dirty).toBe(true);
    await controller.actions.apply();
    expect(api.editTolerance).toHaveBeenCalledTimes(2);
    expect(api.editTolerance).toHaveBeenLastCalledWith('s', {
      type: 'standard.override.clear', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-1',
    });
  });

  it('restores the validated recommendation with its source and evidence', async () => {
    const controller = createToleranceController({ remote: remote(), sessionId: 's', storage: memoryStorage() });
    await controller.actions.open(externalTarget);
    await controller.actions.preview({ kind: 'single', featureClass: 'external', designation: 'h6' });
    await controller.actions.restoreRecommendation();
    expect(controller.state.getSnapshot()).toMatchObject({
      selection: { kind: 'single', designation: 'u6', source: 'ai-recommended', evidenceRefs: ['evidence-1'] },
      preview: { result: { designation: 'u6' } },
    });
  });

  it('reuses both entry points and does not move a user-dragged popup after a new canvas anchor', async () => {
    const controller = createToleranceController({ remote: remote(), sessionId: 's', storage: memoryStorage() });
    await controller.actions.openFromContextMenu(externalTarget);
    const initial = controller.state.getSnapshot();
    expect(initial.geometry.x).toBe(externalTarget.annotationBounds!.x + externalTarget.annotationBounds!.width + 12);
    controller.actions.setGeometry({ x: 44, y: 55, width: 700, height: 480 }, { userDragged: true });

    await controller.actions.openFromDesignationDoubleClick({
      ...externalTarget, anchor: { x: 900, y: 600 }, annotationBounds: { x: 850, y: 580, width: 100, height: 30 },
    });
    expect(controller.state.getSnapshot()).toMatchObject({
      instanceId: 1, geometry: { x: 44, y: 55, width: 700, height: 480 }, userPositioned: true,
    });
  });

  it('ignores late catalog results after a clean target switch and keeps busy until all requests settle', async () => {
    const pending = new Map<string, ReturnType<typeof deferred<RemoteResult<ToleranceCatalogResult>>>>();
    const api = remote({
      queryToleranceCatalog: vi.fn((_sessionId, request) => {
        const requestDeferred = deferred<RemoteResult<ToleranceCatalogResult>>();
        pending.set(request.dimensionIntentId, requestDeferred);
        return requestDeferred.promise;
      }),
    });
    const controller = createToleranceController({ remote: api, sessionId: 's', storage: memoryStorage() });
    const openA = controller.actions.open(externalTarget);
    await vi.waitFor(() => expect(pending.has('intent-1')).toBe(true));
    controller.actions.requestTarget({ ...externalTarget, dimensionIntentId: 'intent-2' });
    await vi.waitFor(() => expect(pending.has('intent-2')).toBe(true));

    pending.get('intent-2')!.resolve(success(catalog('intent-2')));
    await vi.waitFor(() => expect(controller.state.getSnapshot().catalog?.dimensionIntentId).toBe('intent-2'));
    expect(controller.state.getSnapshot().busy).toBe(true);
    pending.get('intent-1')!.resolve(success(catalog('intent-1')));
    await openA;

    expect(controller.state.getSnapshot()).toMatchObject({
      target: { dimensionIntentId: 'intent-2' }, catalog: { dimensionIntentId: 'intent-2' }, busy: false,
    });
  });

  it('ignores an older same-target catalog refresh that resolves after a newer refresh', async () => {
    const pending: Array<ReturnType<typeof deferred<RemoteResult<ToleranceCatalogResult>>>> = [];
    const api = remote({
      queryToleranceCatalog: vi.fn(() => {
        const request = deferred<RemoteResult<ToleranceCatalogResult>>();
        pending.push(request);
        return request.promise;
      }),
    });
    const controller = createToleranceController({ remote: api, sessionId: 's', storage: memoryStorage() });
    const opening = controller.actions.open(externalTarget);
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    const refreshing = controller.actions.refreshCatalog();
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    pending[1]!.resolve(success({ ...catalog('intent-1'), standardRef: { id: 'GB/T 1800', edition: '2024' } }));
    await refreshing;
    pending[0]!.resolve(success(catalog('intent-1')));
    await opening;

    expect(controller.state.getSnapshot()).toMatchObject({ standardEdition: '2024', catalog: { standardRef: { edition: '2024' } } });
  });

  it('drops a late preview for target A and never applies it to target B', async () => {
    const previewDeferred = deferred<RemoteResult<TolerancePreviewResult>>();
    const api = remote({ previewTolerance: vi.fn(() => previewDeferred.promise) });
    const controller = createToleranceController({ remote: api, sessionId: 's', storage: memoryStorage() });
    await controller.actions.open(externalTarget);
    const previewA = controller.actions.preview({ kind: 'single', featureClass: 'external', designation: 'u6' });
    controller.actions.requestTarget({ ...externalTarget, dimensionIntentId: 'intent-2' });
    await vi.waitFor(() => expect(controller.state.getSnapshot().target?.dimensionIntentId).toBe('intent-2'));
    previewDeferred.resolve(success(singlePreview('intent-1')));
    await previewA;

    expect(controller.state.getSnapshot()).toMatchObject({
      target: { dimensionIntentId: 'intent-2' }, selection: null, preview: null, dirty: false,
    });
    await expect(controller.actions.apply()).rejects.toThrow('TOLERANCE_SELECTION_REQUIRED');
    expect(api.editTolerance).not.toHaveBeenCalled();
  });

  it('keeps the newest same-target preview when an older preview resolves last', async () => {
    const pending: Array<ReturnType<typeof deferred<RemoteResult<TolerancePreviewResult>>>> = [];
    const api = remote({
      previewTolerance: vi.fn(() => {
        const request = deferred<RemoteResult<TolerancePreviewResult>>();
        pending.push(request);
        return request.promise;
      }),
    });
    const controller = createToleranceController({ remote: api, sessionId: 's', storage: memoryStorage() });
    await controller.actions.open(externalTarget);
    const first = controller.actions.preview({ kind: 'single', featureClass: 'external', designation: 'u6' });
    const second = controller.actions.preview({ kind: 'single', featureClass: 'external', designation: 'h6' });
    pending[1]!.resolve(success(singlePreview('intent-1', 'h6')));
    await second;
    pending[0]!.resolve(success(singlePreview('intent-1', 'u6')));
    await first;

    expect(controller.state.getSnapshot()).toMatchObject({
      selection: { designation: 'h6' }, preview: { result: { designation: 'h6' } }, busy: false,
    });
  });

  it('invalidates a late preview when a clean popup closes', async () => {
    const pending = deferred<RemoteResult<TolerancePreviewResult>>();
    const controller = createToleranceController({
      remote: remote({ previewTolerance: vi.fn(() => pending.promise) }), sessionId: 's', storage: memoryStorage(),
    });
    await controller.actions.open(externalTarget);
    const previewing = controller.actions.preview({ kind: 'single', featureClass: 'external', designation: 'u6' });
    controller.actions.requestClose();
    pending.resolve(success(singlePreview()));
    await previewing;
    expect(controller.state.getSnapshot()).toMatchObject({ visible: false, preview: null, selection: null, dirty: false });
  });

  it('loads provider-backed internal and external catalogs for fit selection', async () => {
    const api = remote();
    const controller = createToleranceController({ remote: api, sessionId: 's', storage: memoryStorage() });
    await controller.actions.open(externalTarget);

    await controller.actions.beginFit('hole');

    expect(api.queryToleranceCatalog).toHaveBeenCalledWith('s', expect.objectContaining({ featureClass: 'internal' }));
    expect(api.queryToleranceCatalog).toHaveBeenCalledWith('s', expect.objectContaining({ featureClass: 'external' }));
    expect(controller.state.getSnapshot()).toMatchObject({
      fitCatalogs: {
        internal: { featureClass: 'internal', bands: [{ designation: 'H7' }, { designation: 'G7', available: false }] },
        external: { featureClass: 'external', bands: [{ designation: 'u6' }, { designation: 'h6', available: false }] },
      },
    });
  });

  it('rejects a fit second target with either basic size missing and retains selection mode', async () => {
    const controller = createToleranceController({ remote: remote(), sessionId: 's', storage: memoryStorage() });
    await controller.actions.open({ ...externalTarget, classification: { status: 'resolved', featureClass: 'internal' } });
    await controller.actions.beginFit('hole');
    controller.actions.selectFitTarget({
      ...externalTarget, dimensionIntentId: 'shaft-missing', basicSize: undefined,
      classification: { status: 'resolved', featureClass: 'external' },
    });
    expect(controller.state.getSnapshot()).toMatchObject({
      error: 'TOLERANCE_BASIC_SIZE_INVALID',
      fit: { selectingSecondTarget: true, secondTarget: null },
    });

    const missingPrimary = createToleranceController({ remote: remote(), sessionId: 's', storage: memoryStorage() });
    await missingPrimary.actions.open({
      ...externalTarget, basicSize: undefined, classification: { status: 'resolved', featureClass: 'internal' },
    });
    await missingPrimary.actions.beginFit('hole');
    missingPrimary.actions.selectFitTarget({
      ...externalTarget, dimensionIntentId: 'shaft-1', classification: { status: 'resolved', featureClass: 'external' },
    });
    expect(missingPrimary.state.getSnapshot()).toMatchObject({
      error: 'TOLERANCE_BASIC_SIZE_INVALID', fit: { selectingSecondTarget: true, secondTarget: null },
    });
  });

  it('refreshes and hydrates the applied selection before enabling immediate override', async () => {
    let queryCount = 0;
    const api = remote({
      queryToleranceCatalog: vi.fn(async (_sessionId, request) => {
        queryCount += 1;
        return success<ToleranceCatalogResult>({
          ...catalog(request.dimensionIntentId, request.featureClass),
          ...(queryCount === 1 ? {} : {
            selection: {
              designation: 'u6', source: 'manual' as const, evidenceRefs: [], displayPreference: 'deviations',
            },
          }),
        });
      }),
    });
    const controller = createToleranceController({ remote: api, sessionId: 's', storage: memoryStorage() });
    await controller.actions.open(externalTarget);
    await controller.actions.preview({ kind: 'single', featureClass: 'external', designation: 'u6' });

    await controller.actions.apply();

    expect(controller.state.getSnapshot()).toMatchObject({
      dirty: false, catalog: { selection: { designation: 'u6' } }, selection: { designation: 'u6' },
    });
    await controller.actions.previewOverride({ upperDeviation: .05, lowerDeviation: .04 });
    expect(controller.state.getSnapshot().override).toEqual({ upperDeviation: .05, lowerDeviation: .04 });
  });

  it('tries below the annotation when right and left do not fit without overlap', async () => {
    const controller = createToleranceController({ remote: remote(), sessionId: 's', storage: memoryStorage() });
    await controller.actions.open({
      ...externalTarget,
      anchor: { x: 500, y: 65 },
      annotationBounds: { x: 200, y: 50, width: 600, height: 30 },
      viewport: { width: 1_200, height: 800 },
    });
    expect(controller.state.getSnapshot().geometry).toMatchObject({ x: 200, y: 92 });
  });
});

function success<T>(value: T): RemoteResult<T> { return { ok: true, value }; }
function failure<T>(message: string): RemoteResult<T> {
  return { ok: false, error: { code: 'REMOTE', message, details: {} } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
