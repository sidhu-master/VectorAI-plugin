// SPDX-License-Identifier: Apache-2.0

import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { DrawingSurfaceObservable } from '@vectorai/drawing-surface-api';
import type {
  DimensionPlanSessionSnapshot,
  DrawingRef,
  ToleranceCatalogRequest,
  ToleranceCatalogResult,
  ToleranceEditCommand,
  TolerancePreviewRequest,
  TolerancePreviewResult,
} from '@vectorai/plugin-space-contracts';

export const TOLERANCE_POPUP_DEFAULT_SIZE = { width: 760, height: 520 } as const;
export const TOLERANCE_POPUP_MIN_SIZE = { width: 560, height: 380 } as const;

export type TolerancePopupTab = 'recommendation' | 'external' | 'internal' | 'hole-fit' | 'shaft-fit';
export type ToleranceDisplayPreference = 'deviations' | 'designation' | 'both';
export interface PopupPoint { x: number; y: number }
export interface PopupSize { width: number; height: number }
export interface PopupRect extends PopupPoint, PopupSize {}

export type ToleranceClassification =
  | { status: 'resolved'; featureClass: 'internal' | 'external' }
  | { status: 'ambiguous'; code: 'TOLERANCE_FEATURE_CLASS_AMBIGUOUS' }
  | { status: 'unsupported'; code: 'TOLERANCE_FEATURE_UNSUPPORTED' };

export interface ToleranceTarget {
  dimensionIntentId: string;
  drawingRef: DrawingRef;
  anchor: PopupPoint;
  annotationBounds?: PopupRect;
  viewport?: PopupSize;
  basicSize?: number;
  label?: string;
  classification: ToleranceClassification;
  acceptsManualTolerance: boolean;
}

export interface ToleranceRemote {
  queryToleranceCatalog(sessionId: string, request: ToleranceCatalogRequest): Promise<RemoteResult<ToleranceCatalogResult>>;
  previewTolerance(sessionId: string, request: TolerancePreviewRequest): Promise<RemoteResult<TolerancePreviewResult>>;
  editTolerance(sessionId: string, command: ToleranceEditCommand): Promise<RemoteResult<DimensionPlanSessionSnapshot>>;
}

export interface TolerancePopupStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type ToleranceSelection =
  | {
    kind: 'single'; featureClass: 'internal' | 'external'; designation: string;
    source: 'rule' | 'ai-recommended' | 'manual'; evidenceRefs: string[];
  }
  | {
    kind: 'fit'; basis: 'hole' | 'shaft'; designation: string;
    holeDimensionIntentId: string; shaftDimensionIntentId: string;
    source: 'rule' | 'ai-recommended' | 'manual'; evidenceRefs: string[];
  }
  | {
    kind: 'manual'; upperDeviation?: number; lowerDeviation?: number;
  };

export interface TolerancePreview {
  host: TolerancePreviewResult;
  override: { upperDeviation: number; lowerDeviation: number } | null;
  displayPreference: ToleranceDisplayPreference;
}

export interface ToleranceControllerState {
  instanceId: 1;
  visible: boolean;
  geometry: PopupRect;
  userPositioned: boolean;
  tab: TolerancePopupTab;
  zoom: number;
  standardEdition: string;
  target: ToleranceTarget | null;
  pendingTarget: ToleranceTarget | null;
  catalog: ToleranceCatalogResult | null;
  fitCatalogs: { internal: ToleranceCatalogResult; external: ToleranceCatalogResult } | null;
  preview: TolerancePreviewResult | null;
  canvasPreview: TolerancePreview | null;
  selection: ToleranceSelection | null;
  override: { upperDeviation: number; lowerDeviation: number } | null;
  displayPreference: ToleranceDisplayPreference;
  fit: {
    basis: 'hole' | 'shaft';
    selectingSecondTarget: boolean;
    secondTarget: ToleranceTarget | null;
  } | null;
  fitDiagnostic: string | null;
  dirty: boolean;
  closeDecision: 'dirty' | null;
  busy: boolean;
  error: string | null;
}

export interface ToleranceController {
  state: DrawingSurfaceObservable<ToleranceControllerState>;
  actions: {
    open(target: ToleranceTarget): Promise<void>;
    openFromContextMenu(target: ToleranceTarget): Promise<void>;
    openFromDesignationDoubleClick(target: ToleranceTarget): Promise<void>;
    requestTarget(target: ToleranceTarget): void;
    applyAndSwitch(): Promise<void>;
    discardAndSwitch(): Promise<void>;
    requestClose(): void;
    applyAndClose(): Promise<void>;
    discardAndClose(): void;
    cancelPreview(): void;
    refreshCatalog(): Promise<void>;
    chooseFeatureClass(featureClass: 'internal' | 'external'): Promise<void>;
    preview(selection:
      | { kind: 'single'; featureClass: 'internal' | 'external'; designation: string; source?: 'rule' | 'ai-recommended' | 'manual'; evidenceRefs?: string[] }
      | { kind: 'fit'; basis: 'hole' | 'shaft'; designation: string; source?: 'rule' | 'ai-recommended' | 'manual'; evidenceRefs?: string[] }
    ): Promise<void>;
    previewManual(value: { upperDeviation?: number; lowerDeviation?: number }): void;
    previewOverride(value: { upperDeviation: number; lowerDeviation: number }): Promise<void>;
    restoreStandard(): void;
    restoreRecommendation(): Promise<void>;
    apply(): Promise<void>;
    beginFit(basis: 'hole' | 'shaft'): Promise<void>;
    selectFitTarget(target: ToleranceTarget): void;
    chooseFitTargetFeatureClass(featureClass: 'internal' | 'external'): void;
    cancelFitTargetSelection(): void;
    setGeometry(geometry: PopupRect, options?: { userDragged?: boolean }): void;
    setTab(tab: TolerancePopupTab): void;
    setZoom(zoom: number): void;
    setDisplayPreference(displayPreference: ToleranceDisplayPreference): void;
  };
  dispose(): void;
}

interface StoredPreferences extends PopupRect {
  tab: TolerancePopupTab;
  zoom: number;
  standardEdition: string;
}

export function createToleranceController(input: {
  remote: ToleranceRemote | (() => ToleranceRemote);
  sessionId: string;
  storage?: TolerancePopupStorage | null;
  viewport?: PopupSize;
}): ToleranceController {
  const storage = input.storage ?? null;
  const storageKey = `vectorai:tolerance-popup:${input.sessionId}`;
  let viewport = input.viewport ?? { width: 1_200, height: 800 };
  const stored = readPreferences(storage, storageKey, viewport);
  let current: ToleranceControllerState = {
    instanceId: 1,
    visible: false,
    geometry: stored === null
      ? clampGeometry({ x: 0, y: 0, ...TOLERANCE_POPUP_DEFAULT_SIZE }, viewport)
      : pickGeometry(stored),
    userPositioned: stored !== null,
    tab: stored?.tab ?? 'recommendation',
    zoom: stored?.zoom ?? 1,
    standardEdition: stored?.standardEdition ?? '2020',
    target: null,
    pendingTarget: null,
    catalog: null,
    fitCatalogs: null,
    preview: null,
    canvasPreview: null,
    selection: null,
    override: null,
    displayPreference: 'deviations',
    fit: null,
    fitDiagnostic: null,
    dirty: false,
    closeDecision: null,
    busy: false,
    error: null,
  };
  const listeners = new Set<() => void>();
  let disposed = false;
  let pendingOverrideEdit: 'set' | 'clear' | null = null;
  let appliedOverrideDesignation: string | null = null;
  let targetEpoch = 0;
  let catalogGeneration = 0;
  let fitCatalogGeneration = 0;
  let previewGeneration = 0;
  let pendingTargetGeneration = 0;
  let selectionEpoch: number | null = null;
  let pendingRequests = 0;
  let applying: Promise<void> | null = null;

  const update = (changes: Partial<ToleranceControllerState>) => {
    if (disposed) return;
    current = { ...current, ...changes };
    for (const listener of listeners) listener();
  };
  const persist = () => {
    if (storage === null) return;
    const value: StoredPreferences = {
      ...pickGeometry(current.geometry),
      tab: current.tab,
      zoom: current.zoom,
      standardEdition: current.standardEdition,
    };
    try { storage.setItem(storageKey, JSON.stringify(value)); }
    catch { /* Browser storage is optional. */ }
  };
  const remote = () => typeof input.remote === 'function' ? input.remote() : input.remote;
  const run = async <T>(
    operation: () => Promise<RemoteResult<T>>,
    epoch = targetEpoch,
    isCurrent: () => boolean = () => true,
  ): Promise<T> => {
    pendingRequests += 1;
    if (epoch === targetEpoch && isCurrent()) update({ busy: true, error: null });
    try { return unwrap(await operation()); }
    catch (error) {
      if (epoch === targetEpoch && isCurrent()) update({ error: errorText(error) });
      throw error;
    } finally {
      pendingRequests -= 1;
      update({ busy: pendingRequests > 0 });
    }
  };
  const requireTarget = () => {
    if (current.target === null) throw new Error('TOLERANCE_TARGET_REQUIRED');
    return current.target;
  };
  const refreshCatalogFor = async (
    target: ToleranceTarget,
    featureClass: 'internal' | 'external',
    epoch: number,
    hydrate: boolean,
  ): Promise<void> => {
    const generation = ++catalogGeneration;
    const isCurrent = () => epoch === targetEpoch && generation === catalogGeneration;
    const result = await run(() => remote().queryToleranceCatalog(input.sessionId, {
      expectedDrawingRef: target.drawingRef,
      dimensionIntentId: target.dimensionIntentId,
      featureClass,
    }), epoch, isCurrent);
    if (!isCurrent() || !catalogMatches(result, target, featureClass)) return;
    appliedOverrideDesignation = result.selection?.override === undefined
      ? null
      : result.selection.designation;
    update({ catalog: clone(result), standardEdition: result.standardRef.edition });
    if ((hydrate || (!current.dirty && current.preview === null)) && result.selection !== undefined) {
      const selection = result.selection;
      const hydrationGeneration = ++previewGeneration;
      const isCurrentHydration = () => isCurrent() && hydrationGeneration === previewGeneration;
      const host = await run(() => remote().previewTolerance(input.sessionId, {
        type: 'single', expectedDrawingRef: target.drawingRef,
        dimensionIntentId: target.dimensionIntentId, featureClass,
        designation: selection.designation,
      }), epoch, isCurrentHydration);
      if (!isCurrentHydration() || !singlePreviewMatches(host, target, featureClass, selection.designation)) return;
      const preview = clone(host);
      const override = selection.override === undefined ? null : { ...selection.override };
      selectionEpoch = epoch;
      update({
        preview,
        canvasPreview: null,
        selection: {
          kind: 'single', featureClass, designation: selection.designation,
          source: selection.source, evidenceRefs: [...selection.evidenceRefs],
        },
        override,
        displayPreference: selection.displayPreference,
        dirty: false,
      });
    }
    persist();
  };
  const activateTarget = async (target: ToleranceTarget): Promise<void> => {
    const sameTarget = current.target !== null && sameTargetIdentity(current.target, target);
    targetEpoch += 1;
    catalogGeneration += 1;
    fitCatalogGeneration += 1;
    previewGeneration += 1;
    const epoch = targetEpoch;
    selectionEpoch = null;
    viewport = target.viewport ?? viewport;
    const geometry = current.userPositioned || sameTarget
      ? clampGeometry(current.geometry, viewport)
      : initialGeometry(target, current.geometry, viewport);
    pendingOverrideEdit = null;
    appliedOverrideDesignation = null;
    update({
      visible: true,
      geometry,
      target: clone(target),
      pendingTarget: null,
      catalog: sameTarget ? current.catalog : null,
      fitCatalogs: null,
      preview: null,
      canvasPreview: null,
      selection: null,
      override: null,
      fit: null,
      fitDiagnostic: null,
      dirty: false,
      closeDecision: null,
      error: null,
    });
    persist();
    if (target.classification.status === 'resolved') {
      await refreshCatalogFor(target, target.classification.featureClass, epoch, false);
    }
  };

  const actions: ToleranceController['actions'] = {
    open: activateTarget,
    openFromContextMenu(target) {
      if (!current.visible) return activateTarget(target);
      actions.requestTarget(target);
      return Promise.resolve();
    },
    openFromDesignationDoubleClick(target) {
      if (!current.visible) return activateTarget(target);
      actions.requestTarget(target);
      return Promise.resolve();
    },
    requestTarget(target) {
      if (current.target !== null && sameTargetIdentity(current.target, target)) {
        update({ target: clone(target), visible: true });
        return;
      }
      if (current.dirty) {
        pendingTargetGeneration += 1;
        update({ pendingTarget: clone(target), closeDecision: null });
        return;
      }
      void activateTarget(target).catch(() => undefined);
    },
    async applyAndSwitch() {
      const pending = current.pendingTarget;
      if (pending === null) return;
      const epoch = targetEpoch;
      const pendingGeneration = pendingTargetGeneration;
      await actions.apply();
      if (epoch !== targetEpoch) return;
      if (pendingGeneration !== pendingTargetGeneration) {
        const latest = current.pendingTarget;
        if (latest !== null) await activateTarget(latest);
        return;
      }
      if (current.pendingTarget === null || !sameTargetIdentity(current.pendingTarget, pending)) return;
      await activateTarget(current.pendingTarget);
    },
    async discardAndSwitch() {
      const pending = current.pendingTarget;
      if (pending === null) return;
      pendingOverrideEdit = null;
      selectionEpoch = null;
      update({ dirty: false, preview: null, canvasPreview: null, selection: null, override: null });
      await activateTarget(pending);
    },
    requestClose() {
      if (current.dirty) update({ closeDecision: 'dirty' });
      else {
        targetEpoch += 1;
        catalogGeneration += 1;
        previewGeneration += 1;
        selectionEpoch = null;
        update({ visible: false, closeDecision: null, preview: null, canvasPreview: null, selection: null, override: null });
      }
    },
    async applyAndClose() {
      const epoch = targetEpoch;
      const pendingGeneration = pendingTargetGeneration;
      await actions.apply();
      if (epoch !== targetEpoch) return;
      if (pendingGeneration !== pendingTargetGeneration && current.pendingTarget !== null) {
        await activateTarget(current.pendingTarget);
        return;
      }
      if (current.pendingTarget !== null) {
        await activateTarget(current.pendingTarget);
        return;
      }
      targetEpoch += 1;
      catalogGeneration += 1;
      fitCatalogGeneration += 1;
      previewGeneration += 1;
      selectionEpoch = null;
      update({ visible: false, closeDecision: null, preview: null, canvasPreview: null, selection: null, override: null });
    },
    discardAndClose() {
      pendingOverrideEdit = null;
      targetEpoch += 1;
      catalogGeneration += 1;
      previewGeneration += 1;
      selectionEpoch = null;
      update({ visible: false, dirty: false, closeDecision: null, preview: null, canvasPreview: null, selection: null, override: null });
    },
    cancelPreview() {
      pendingOverrideEdit = null;
      previewGeneration += 1;
      selectionEpoch = null;
      update({ dirty: false, closeDecision: null, preview: null, canvasPreview: null, selection: null, override: null });
    },
    async refreshCatalog() {
      const target = requireTarget();
      if (target.classification.status !== 'resolved') throw new Error(target.classification.code);
      await refreshCatalogFor(target, target.classification.featureClass, targetEpoch, false);
    },
    async chooseFeatureClass(featureClass) {
      const target = requireTarget();
      targetEpoch += 1;
      const epoch = targetEpoch;
      selectionEpoch = null;
      appliedOverrideDesignation = null;
      const resolvedTarget: ToleranceTarget = { ...target, classification: { status: 'resolved', featureClass } };
      update({
        target: resolvedTarget, tab: featureClass, catalog: null, fitCatalogs: null,
        preview: null, canvasPreview: null, selection: null, override: null, dirty: false,
      });
      await refreshCatalogFor(resolvedTarget, featureClass, epoch, false);
      persist();
    },
    async preview(selection) {
      const target = requireTarget();
      let request: TolerancePreviewRequest;
      let normalized: ToleranceSelection | null;
      if (selection.kind === 'single') {
        request = {
          type: 'single', expectedDrawingRef: target.drawingRef,
          dimensionIntentId: target.dimensionIntentId,
          featureClass: selection.featureClass,
          designation: selection.designation,
        };
        normalized = {
          kind: 'single', featureClass: selection.featureClass, designation: selection.designation,
          source: selection.source ?? 'manual', evidenceRefs: [...(selection.evidenceRefs ?? [])],
        };
      } else {
        const fit = current.fit;
        if (fit?.secondTarget === null || fit === null) throw new Error('FIT_PAIR_TARGET_REQUIRED');
        const primaryClass = resolvedFeatureClass(target);
        const secondaryClass = resolvedFeatureClass(fit.secondTarget);
        request = {
          type: 'fit', expectedDrawingRef: target.drawingRef,
          primaryDimensionIntentId: target.dimensionIntentId,
          primaryFeatureClass: primaryClass,
          secondaryDimensionIntentId: fit.secondTarget.dimensionIntentId,
          secondaryFeatureClass: secondaryClass,
          basis: selection.basis, designation: selection.designation,
        };
        normalized = null;
      }
      const epoch = targetEpoch;
      const generation = ++previewGeneration;
      const isCurrent = () => epoch === targetEpoch && generation === previewGeneration;
      const result = await run(() => remote().previewTolerance(input.sessionId, request), epoch, isCurrent);
      if (!isCurrent() || !previewMatchesRequest(result, request)) return;
      if (selection.kind === 'fit') {
        if (result.type !== 'fit') return;
        normalized = {
          kind: 'fit', basis: selection.basis, designation: selection.designation,
          holeDimensionIntentId: result.holeDimensionIntentId,
          shaftDimensionIntentId: result.shaftDimensionIntentId,
          source: selection.source ?? 'manual', evidenceRefs: [...(selection.evidenceRefs ?? [])],
        };
      }
      if (normalized === null) return;
      const preview = clone(result);
      pendingOverrideEdit = null;
      selectionEpoch = epoch;
      update({
        preview,
        canvasPreview: { host: clone(preview), override: null, displayPreference: current.displayPreference },
        selection: normalized, override: null, dirty: true,
      });
    },
    previewManual(value) {
      const target = requireTarget();
      if (!target.acceptsManualTolerance) throw new Error('TOLERANCE_MANUAL_UNSUPPORTED');
      if (value.upperDeviation === undefined && value.lowerDeviation === undefined) throw new Error('TOLERANCE_DEVIATION_REQUIRED');
      pendingOverrideEdit = null;
      selectionEpoch = targetEpoch;
      update({ selection: { kind: 'manual', ...value }, preview: null, canvasPreview: null, override: null, dirty: true, error: null });
    },
    async previewOverride(value) {
      if (!Number.isFinite(value.upperDeviation) || !Number.isFinite(value.lowerDeviation)) {
        throw new Error('TOLERANCE_RESULT_INVALID');
      }
      const selection = current.selection;
      if (selection?.kind !== 'single') throw new Error('TOLERANCE_STANDARD_SELECTION_REQUIRED');
      const epoch = targetEpoch;
      const previewing = actions.preview(selection);
      const generation = previewGeneration;
      await previewing;
      const target = current.target;
      if (epoch !== targetEpoch
        || generation !== previewGeneration
        || target === null
        || selectionEpoch !== epoch
        || !selectionHasCurrentPreview(selection, current.preview, target)) return;
      pendingOverrideEdit = 'set';
      update({
        override: { ...value },
        canvasPreview: current.preview === null ? null : {
          host: clone(current.preview), override: { ...value }, displayPreference: current.displayPreference,
        },
        dirty: true,
      });
    },
    restoreStandard() {
      previewGeneration += 1;
      const selection = current.selection;
      const appliedSelection = selection?.kind === 'single'
        && current.catalog?.selection?.designation === selection.designation;
      const clearsAppliedOverride = selection?.kind === 'single'
        && appliedOverrideDesignation === selection.designation;
      const cancelsPendingOverride = pendingOverrideEdit === 'set';
      if (!clearsAppliedOverride && !cancelsPendingOverride) return;
      pendingOverrideEdit = clearsAppliedOverride ? 'clear' : null;
      update({
        override: null,
        canvasPreview: current.preview === null ? null : {
          host: clone(current.preview), override: null, displayPreference: current.displayPreference,
        },
        dirty: clearsAppliedOverride ? true : appliedSelection ? false : current.dirty,
      });
    },
    async restoreRecommendation() {
      const recommendation = current.catalog?.recommendation;
      const target = requireTarget();
      if (recommendation === undefined || target.classification.status !== 'resolved') {
        throw new Error('TOLERANCE_RECOMMENDATION_UNAVAILABLE');
      }
      await actions.preview({
        kind: 'single', featureClass: target.classification.featureClass,
        designation: recommendation.designation,
        source: recommendation.source, evidenceRefs: recommendation.evidenceRefs,
      });
    },
    async apply() {
      if (applying !== null) return applying;
      const task = (async () => {
        const target = requireTarget();
        const selection = current.selection;
        if (selection === null) throw new Error('TOLERANCE_SELECTION_REQUIRED');
        if (!current.dirty || !selectionHasCurrentPreview(selection, current.preview, target)) {
          throw new Error('TOLERANCE_PREVIEW_REQUIRED');
        }
        const epoch = targetEpoch;
        if (selectionEpoch !== epoch) throw new Error('TOLERANCE_TARGET_STALE');
        let command: ToleranceEditCommand;
        if (pendingOverrideEdit !== null) {
          if (selection.kind !== 'single' || current.catalog?.selection?.designation !== selection.designation) {
            throw new Error('TOLERANCE_OVERRIDE_REQUIRES_APPLIED_STANDARD');
          }
          if (pendingOverrideEdit === 'set') {
            const override = current.override;
            if (override === null) throw new Error('TOLERANCE_OVERRIDE_REQUIRED');
            command = {
              type: 'standard.override.set', expectedDrawingRef: target.drawingRef,
              dimensionIntentId: target.dimensionIntentId,
              ...override,
            };
          } else {
            command = {
              type: 'standard.override.clear', expectedDrawingRef: target.drawingRef,
              dimensionIntentId: target.dimensionIntentId,
            };
          }
        } else if (selection.kind === 'single') {
          command = {
            type: 'standard.single.apply', expectedDrawingRef: target.drawingRef,
            dimensionIntentId: target.dimensionIntentId,
            featureClass: selection.featureClass, designation: selection.designation,
            expectedInputDigest: current.preview!.type === 'single'
              ? current.preview!.result.ruleRef.inputDigest
              : '',
            selectionSource: selection.source, displayPreference: current.displayPreference,
            evidenceRefs: [...selection.evidenceRefs],
          };
        } else if (selection.kind === 'fit') {
          command = {
            type: 'standard.fit.apply', expectedDrawingRef: target.drawingRef,
            holeDimensionIntentId: selection.holeDimensionIntentId,
            shaftDimensionIntentId: selection.shaftDimensionIntentId,
            basis: selection.basis, designation: selection.designation,
            expectedHoleInputDigest: current.preview!.type === 'fit'
              ? current.preview!.result.hole.ruleRef.inputDigest
              : '',
            expectedShaftInputDigest: current.preview!.type === 'fit'
              ? current.preview!.result.shaft.ruleRef.inputDigest
              : '',
            selectionSource: selection.source, displayPreference: current.displayPreference,
            evidenceRefs: [...selection.evidenceRefs],
          };
        } else {
          command = {
            type: 'manual.apply', expectedDrawingRef: target.drawingRef,
            dimensionIntentId: target.dimensionIntentId,
            mode: selection.upperDeviation !== undefined && selection.lowerDeviation !== undefined ? 'bilateral' : 'unilateral',
            ...(selection.upperDeviation === undefined ? {} : { upperDeviation: selection.upperDeviation }),
            ...(selection.lowerDeviation === undefined ? {} : { lowerDeviation: selection.lowerDeviation }),
            displayPreference: current.displayPreference,
            evidenceRefs: [],
          };
        }
        const snapshot = await run(() => remote().editTolerance(input.sessionId, command), epoch);
        if (epoch !== targetEpoch || !commandTargets(command, target)) return;
        if (command.type === 'standard.override.set') appliedOverrideDesignation = selection.kind === 'single'
          ? selection.designation
          : null;
        if (command.type === 'standard.override.clear') appliedOverrideDesignation = null;
        pendingOverrideEdit = null;
        update({ dirty: false, closeDecision: null, error: null, canvasPreview: null });
        if (command.type === 'standard.single.apply') {
          const nextTarget = { ...target, drawingRef: snapshot.drawingRef ?? target.drawingRef };
          update({ target: nextTarget, preview: null, canvasPreview: null });
          await refreshCatalogFor(nextTarget, command.featureClass, epoch, true);
        }
      })();
      applying = task;
      try { await task; } finally { if (applying === task) applying = null; }
    },
    async beginFit(basis) {
      const target = requireTarget();
      const epoch = targetEpoch;
      const generation = ++fitCatalogGeneration;
      const isCurrent = () => epoch === targetEpoch && generation === fitCatalogGeneration;
      update({
        tab: basis === 'hole' ? 'hole-fit' : 'shaft-fit',
        fit: {
          basis, selectingSecondTarget: true,
          secondTarget: current.fit?.basis === basis ? current.fit.secondTarget : null,
        },
        fitCatalogs: null,
        fitDiagnostic: null,
        error: null,
      });
      persist();
      let internal: ToleranceCatalogResult;
      let external: ToleranceCatalogResult;
      try {
        [internal, external] = await Promise.all([
          run(() => remote().queryToleranceCatalog(input.sessionId, {
            expectedDrawingRef: target.drawingRef,
            dimensionIntentId: target.dimensionIntentId,
            featureClass: 'internal',
          }), epoch, isCurrent),
          run(() => remote().queryToleranceCatalog(input.sessionId, {
            expectedDrawingRef: target.drawingRef,
            dimensionIntentId: target.dimensionIntentId,
            featureClass: 'external',
          }), epoch, isCurrent),
        ]);
      } catch (error) {
        if (!isCurrent()) return;
        throw error;
      }
      if (!isCurrent()
        || !catalogMatches(internal, target, 'internal')
        || !catalogMatches(external, target, 'external')) return;
      update({ fitCatalogs: { internal: clone(internal), external: clone(external) } });
    },
    selectFitTarget(target) {
      requireTarget();
      const fit = current.fit;
      if (fit === null) throw new Error('FIT_PAIR_SELECTION_INACTIVE');
      previewGeneration += 1;
      selectionEpoch = null;
      pendingOverrideEdit = null;
      const invalidatedPreview = {
        preview: null,
        canvasPreview: null,
        selection: null,
        override: null,
        dirty: false,
        closeDecision: null,
      } as const;
      if (target.classification.status === 'unsupported') {
        update({ ...invalidatedPreview, fitDiagnostic: target.classification.code });
        return;
      }
      update({
        ...invalidatedPreview,
        fit: { ...fit, selectingSecondTarget: false, secondTarget: clone(target) },
        fitDiagnostic: target.classification.status === 'ambiguous' ? target.classification.code : null,
        error: null,
      });
    },
    chooseFitTargetFeatureClass(featureClass) {
      const fit = current.fit;
      if (fit?.secondTarget === null || fit === null) throw new Error('FIT_PAIR_TARGET_REQUIRED');
      previewGeneration += 1;
      selectionEpoch = null;
      pendingOverrideEdit = null;
      update({
        fit: {
          ...fit,
          secondTarget: { ...fit.secondTarget, classification: { status: 'resolved', featureClass } },
        },
        fitDiagnostic: null,
        preview: null,
        canvasPreview: null,
        selection: null,
        override: null,
        dirty: false,
        closeDecision: null,
      });
    },
    cancelFitTargetSelection() {
      const fit = current.fit;
      if (fit === null) return;
      update({ fit: { ...fit, selectingSecondTarget: false }, fitDiagnostic: null });
    },
    setGeometry(geometry, options) {
      update({ geometry: clampGeometry(geometry, viewport), userPositioned: current.userPositioned || options?.userDragged === true });
      persist();
    },
    setTab(tab) { update({ tab }); persist(); },
    setZoom(zoom) { update({ zoom: clamp(zoom, .5, 2) }); persist(); },
    setDisplayPreference(displayPreference) {
      update({
        displayPreference,
        canvasPreview: current.preview === null ? null : {
          host: clone(current.preview), override: current.override === null ? null : { ...current.override }, displayPreference,
        },
        dirty: current.selection === null ? current.dirty : true,
      });
    },
  };

  return {
    state: {
      getSnapshot: () => current,
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    },
    actions,
    dispose() { disposed = true; listeners.clear(); },
  };
}

function initialGeometry(target: ToleranceTarget, previous: PopupRect, viewport: PopupSize): PopupRect {
  const size = clampGeometry({ x: 0, y: 0, width: previous.width, height: previous.height }, viewport);
  const bounds = target.annotationBounds;
  if (bounds === undefined) {
    return clampGeometry({ ...size, x: target.anchor.x + 12, y: target.anchor.y + 12 }, viewport);
  }
  const gap = 12;
  const candidates = [
    { ...size, x: bounds.x + bounds.width + gap, y: bounds.y },
    { ...size, x: bounds.x - size.width - gap, y: bounds.y },
    { ...size, x: bounds.x, y: bounds.y + bounds.height + gap },
    { ...size, x: bounds.x, y: bounds.y - size.height - gap },
  ];
  const fitting = candidates.find((candidate) => fitsViewport(candidate, viewport) && !rectanglesOverlap(candidate, bounds));
  return fitting ?? clampGeometry(candidates[0]!, viewport);
}

export function clampTolerancePopupGeometry(geometry: PopupRect, viewport: PopupSize): PopupRect {
  return clampGeometry(geometry, viewport);
}

function clampGeometry(geometry: PopupRect, viewport: PopupSize): PopupRect {
  const maxWidth = Math.max(TOLERANCE_POPUP_MIN_SIZE.width, viewport.width * .8);
  const maxHeight = Math.max(TOLERANCE_POPUP_MIN_SIZE.height, viewport.height * .8);
  const width = clamp(geometry.width, TOLERANCE_POPUP_MIN_SIZE.width, maxWidth);
  const height = clamp(geometry.height, TOLERANCE_POPUP_MIN_SIZE.height, maxHeight);
  return {
    x: clamp(geometry.x, 0, Math.max(0, viewport.width - width)),
    y: clamp(geometry.y, 0, Math.max(0, viewport.height - height)),
    width,
    height,
  };
}

function readPreferences(storage: TolerancePopupStorage | null, key: string, viewport: PopupSize): StoredPreferences | null {
  if (storage === null) return null;
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? 'null') as Partial<StoredPreferences> | null;
    if (parsed === null
      || !finite(parsed.x) || !finite(parsed.y) || !finite(parsed.width) || !finite(parsed.height)
      || !isTab(parsed.tab) || !finite(parsed.zoom)
      || typeof parsed.standardEdition !== 'string' || parsed.standardEdition.trim() === '') return null;
    return {
      ...clampGeometry({ x: parsed.x, y: parsed.y, width: parsed.width, height: parsed.height }, viewport),
      tab: parsed.tab,
      zoom: clamp(parsed.zoom, .5, 2),
      standardEdition: parsed.standardEdition,
    };
  } catch { return null; }
}

function pickGeometry(value: PopupRect): PopupRect {
  return { x: value.x, y: value.y, width: value.width, height: value.height };
}

function isTab(value: unknown): value is TolerancePopupTab {
  return ['recommendation', 'external', 'internal', 'hole-fit', 'shaft-fit'].includes(String(value));
}

function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function clamp(value: number, minimum: number, maximum: number): number { return Math.min(maximum, Math.max(minimum, value)); }
function clone<T>(value: T): T { return structuredClone(value); }
function errorText(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function unwrap<T>(result: RemoteResult<T>): T {
  if (result.ok !== true) throw new Error(result.error.message);
  return clone(result.value);
}

function sameDrawingRef(first: DrawingRef, second: DrawingRef): boolean {
  return first.drawingId === second.drawingId && first.revision === second.revision;
}

function sameTargetIdentity(first: ToleranceTarget, second: ToleranceTarget): boolean {
  return first.dimensionIntentId === second.dimensionIntentId && sameDrawingRef(first.drawingRef, second.drawingRef);
}

function catalogMatches(
  result: ToleranceCatalogResult,
  target: ToleranceTarget,
  featureClass: 'internal' | 'external',
): boolean {
  return result.dimensionIntentId === target.dimensionIntentId
    && result.featureClass === featureClass
    && sameDrawingRef(result.drawingRef, target.drawingRef);
}

function singlePreviewMatches(
  result: TolerancePreviewResult,
  target: ToleranceTarget,
  featureClass: 'internal' | 'external',
  designation: string,
): boolean {
  return result.type === 'single'
    && result.dimensionIntentId === target.dimensionIntentId
    && sameDrawingRef(result.drawingRef, target.drawingRef)
    && result.result.featureClass === featureClass
    && result.result.designation === designation;
}

function previewMatchesRequest(result: TolerancePreviewResult, request: TolerancePreviewRequest): boolean {
  if (!sameDrawingRef(result.drawingRef, request.expectedDrawingRef) || result.type !== request.type) return false;
  return request.type === 'single' && result.type === 'single'
    ? result.dimensionIntentId === request.dimensionIntentId
      && result.result.featureClass === request.featureClass
      && result.result.designation === request.designation
    : request.type === 'fit' && result.type === 'fit'
      && new Set([result.holeDimensionIntentId, result.shaftDimensionIntentId]).size === 2
      && new Set([result.holeDimensionIntentId, result.shaftDimensionIntentId]).has(request.primaryDimensionIntentId)
      && new Set([result.holeDimensionIntentId, result.shaftDimensionIntentId]).has(request.secondaryDimensionIntentId)
      && result.result.basis === request.basis
      && result.result.designation === request.designation;
}

function selectionHasCurrentPreview(
  selection: ToleranceSelection,
  preview: TolerancePreviewResult | null,
  target: ToleranceTarget,
): boolean {
  if (selection.kind === 'manual') return true;
  if (preview === null || !sameDrawingRef(preview.drawingRef, target.drawingRef)) return false;
  if (selection.kind === 'single') {
    return singlePreviewMatches(preview, target, selection.featureClass, selection.designation);
  }
  return preview.type === 'fit'
    && preview.holeDimensionIntentId === selection.holeDimensionIntentId
    && preview.shaftDimensionIntentId === selection.shaftDimensionIntentId
    && preview.result.basis === selection.basis
    && preview.result.designation === selection.designation;
}

function commandTargets(command: ToleranceEditCommand, target: ToleranceTarget): boolean {
  if (!sameDrawingRef(command.expectedDrawingRef, target.drawingRef)) return false;
  return command.type === 'standard.fit.apply'
    ? command.holeDimensionIntentId === target.dimensionIntentId || command.shaftDimensionIntentId === target.dimensionIntentId
    : command.dimensionIntentId === target.dimensionIntentId;
}

function fitsViewport(rect: PopupRect, viewport: PopupSize): boolean {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= viewport.width && rect.y + rect.height <= viewport.height;
}

function rectanglesOverlap(first: PopupRect, second: PopupRect): boolean {
  return first.x < second.x + second.width && first.x + first.width > second.x
    && first.y < second.y + second.height && first.y + first.height > second.y;
}
function resolvedFeatureClass(target: ToleranceTarget): 'internal' | 'external' {
  if (target.classification.status !== 'resolved') throw new Error(target.classification.code);
  return target.classification.featureClass;
}
