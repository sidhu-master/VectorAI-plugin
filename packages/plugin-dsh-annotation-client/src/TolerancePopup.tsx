// SPDX-License-Identifier: Apache-2.0

import type { ToleranceCatalogResult, TolerancePreviewResult } from '@vectorai/plugin-space-contracts';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type SyntheticEvent } from 'react';
import { clampTolerancePopupGeometry, type PopupRect, type PopupSize, type ToleranceDisplayPreference, type TolerancePopupTab, type ToleranceTarget } from './tolerance-controller';
import { ToleranceBandMatrix, type ToleranceBand } from './ToleranceBandMatrix';

export interface TolerancePopupProps {
  geometry: PopupRect;
  viewport: PopupSize;
  target: ToleranceTarget;
  bands: readonly ToleranceBand[];
  fitCatalogs?: { internal: readonly ToleranceBand[]; external: readonly ToleranceBand[] } | null;
  tab: TolerancePopupTab;
  zoom: number;
  standardEdition: string;
  datasetCompleteness?: 'complete' | 'partial';
  preview: TolerancePreviewResult | null;
  displayPreference: ToleranceDisplayPreference;
  dirty: boolean;
  closeDecision: 'dirty' | null;
  pendingTarget?: ToleranceTarget | null;
  recommendation?: string | null;
  recommendations?: NonNullable<ToleranceCatalogResult['recommendations']>;
  busy: boolean;
  error: string | null;
  fitStatus?: string | null;
  fitTargetClassification?: ToleranceTarget['classification'] | null;
  override?: { upperDeviation: number; lowerDeviation: number } | null;
  onPreview(designation: string): void | Promise<void>;
  onApply(): void | Promise<void>;
  onRequestClose(): void;
  onDiscardClose(): void;
  onApplyClose(): void | Promise<void>;
  onDiscardAndSwitch(): void;
  onApplyAndSwitch(): void | Promise<void>;
  onGeometryChange(geometry: PopupRect, options: { userDragged: true }): void;
  onTabChange(tab: TolerancePopupTab): void;
  onZoomChange(zoom: number): void;
  onDisplayPreferenceChange(preference: ToleranceDisplayPreference): void;
  onOverridePreview(value: { upperDeviation: number; lowerDeviation: number }): void | Promise<void>;
  onRestoreStandard(): void;
  onRestoreRecommendation(): void;
  onFeatureClassChoice(featureClass: 'internal' | 'external'): void;
  onFitTargetFeatureClassChoice(featureClass: 'internal' | 'external'): void;
  onManualPreview(value: { upperDeviation?: number; lowerDeviation?: number }): void;
}

type PointerOperation =
  | { kind: 'drag'; pointer: { x: number; y: number }; geometry: PopupRect }
  | { kind: 'resize-e'; pointer: { x: number; y: number }; geometry: PopupRect }
  | { kind: 'resize-s'; pointer: { x: number; y: number }; geometry: PopupRect }
  | { kind: 'resize-se'; pointer: { x: number; y: number }; geometry: PopupRect };

export function TolerancePopup(props: TolerancePopupProps) {
  const initialFit = fitSelectionFromPreview(props.preview);
  const operation = useRef<PointerOperation | null>(null);
  const capture = useRef<{ owner: HTMLElement; pointerId: number } | null>(null);
  const [inspectedBand, setInspectedBand] = useState<ToleranceBand | null>(null);
  const [overrideUpper, setOverrideUpper] = useState(props.override === null || props.override === undefined ? '' : String(props.override.upperDeviation));
  const [overrideLower, setOverrideLower] = useState(props.override === null || props.override === undefined ? '' : String(props.override.lowerDeviation));
  const [manualUpper, setManualUpper] = useState('');
  const [manualLower, setManualLower] = useState('');
  const [manualReady, setManualReady] = useState(false);
  const [manualPanelOpen, setManualPanelOpen] = useState(false);
  const [editingOverrideField, setEditingOverrideField] = useState<'upper' | 'lower' | null>(null);
  const [fitInternal, setFitInternal] = useState(initialFit?.internal ?? '');
  const [fitExternal, setFitExternal] = useState(initialFit?.external ?? '');
  const [fitInputsDirty, setFitInputsDirty] = useState(false);
  const [overrideInputsDirty, setOverrideInputsDirty] = useState(false);
  const fitInputGeneration = useRef(0);
  const overrideInputGeneration = useRef(0);
  const [applying, setApplying] = useState(false);
  const applyingRef = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const targetIdentity = `${props.target.drawingRef.drawingId}:${props.target.drawingRef.revision}:${props.target.dimensionIntentId}`;
  const hydratedOverrideUpper = props.override?.upperDeviation;
  const hydratedOverrideLower = props.override?.lowerDeviation;
  const localTargetIdentity = useRef(targetIdentity);
  const fitHydrationIdentity = initialFit?.identity ?? '';
  const localHydratedFit = useRef(fitHydrationIdentity);
  const localHydratedOverride = useRef({ targetIdentity, upper: hydratedOverrideUpper, lower: hydratedOverrideLower });
  useEffect(() => {
    if (localTargetIdentity.current === targetIdentity) return;
    localTargetIdentity.current = targetIdentity;
    setManualUpper('');
    setManualLower('');
    setManualReady(false);
    setManualPanelOpen(false);
    setEditingOverrideField(null);
    setFitInternal('');
    setFitExternal('');
    localHydratedFit.current = '';
    setFitInputsDirty(false);
    setOverrideInputsDirty(false);
    fitInputGeneration.current += 1;
    overrideInputGeneration.current += 1;
    setInspectedBand(null);
    setActionError(null);
  }, [targetIdentity]);
  useEffect(() => {
    if (fitInputsDirty || initialFit === null || localHydratedFit.current === fitHydrationIdentity) return;
    localHydratedFit.current = fitHydrationIdentity;
    setFitInternal(initialFit.internal);
    setFitExternal(initialFit.external);
    setFitInputsDirty(false);
  }, [targetIdentity, fitHydrationIdentity, fitInputsDirty, initialFit]);
  useEffect(() => {
    const previous = localHydratedOverride.current;
    if (previous.targetIdentity === targetIdentity
      && Object.is(previous.upper, hydratedOverrideUpper)
      && Object.is(previous.lower, hydratedOverrideLower)) return;
    localHydratedOverride.current = { targetIdentity, upper: hydratedOverrideUpper, lower: hydratedOverrideLower };
    setOverrideUpper(hydratedOverrideUpper === undefined ? '' : String(hydratedOverrideUpper));
    setOverrideLower(hydratedOverrideLower === undefined ? '' : String(hydratedOverrideLower));
    setOverrideInputsDirty(false);
  }, [targetIdentity, hydratedOverrideUpper, hydratedOverrideLower]);
  const stop = (event: SyntheticEvent) => event.stopPropagation();
  const begin = (kind: PointerOperation['kind'], event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation?.();
    event.currentTarget.setPointerCapture(event.pointerId);
    capture.current = { owner: event.currentTarget, pointerId: event.pointerId };
    operation.current = { kind, pointer: { x: event.clientX, y: event.clientY }, geometry: props.geometry } as PointerOperation;
  };
  const move = (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation?.();
    const active = operation.current;
    if (active === null) return;
    const dx = event.clientX - active.pointer.x;
    const dy = event.clientY - active.pointer.y;
    const requested = active.kind === 'drag'
      ? { ...active.geometry, x: active.geometry.x + dx, y: active.geometry.y + dy }
      : active.kind === 'resize-e'
        ? { ...active.geometry, width: active.geometry.width + dx }
        : active.kind === 'resize-s'
          ? { ...active.geometry, height: active.geometry.height + dy }
          : { ...active.geometry, width: active.geometry.width + dx, height: active.geometry.height + dy };
    props.onGeometryChange(clampTolerancePopupGeometry(requested, props.viewport), { userDragged: true });
  };
  const finish = (event?: ReactPointerEvent<HTMLElement>) => {
    event?.stopPropagation();
    const activeCapture = capture.current;
    if (activeCapture !== null) {
      const owner = activeCapture.owner as HTMLElement & {
        hasPointerCapture?: (pointerId: number) => boolean;
        releasePointerCapture?: (pointerId: number) => void;
      };
      if (owner.releasePointerCapture !== undefined
        && (owner.hasPointerCapture === undefined || owner.hasPointerCapture(activeCapture.pointerId))) {
        owner.releasePointerCapture(activeCapture.pointerId);
      }
    }
    capture.current = null;
    operation.current = null;
  };
  const keyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation?.();
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void invokeApplication(props.onApply);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      props.onRequestClose();
    }
  };
  const classification = props.target.classification;
  const manualFallback = classification.status !== 'resolved' && props.target.acceptsManualTolerance;
  const catalogTab: TolerancePopupTab = classification.status === 'resolved' ? classification.featureClass : 'external';
  const fitTab: TolerancePopupTab = classification.status === 'resolved' && classification.featureClass === 'internal' ? 'hole-fit' : 'shaft-fit';
  const fitMode = props.tab === 'hole-fit' || props.tab === 'shaft-fit';
  const compactTab = fitMode ? 'fit' : 'recommendation';
  const fitDesignation = `${fitInternal}/${fitExternal}`;
  const fitPreviewReady = !fitInputsDirty
    && fitInternal !== ''
    && fitExternal !== ''
    && (props.preview?.type === 'fit' || props.preview?.type === 'mating-fit')
    && props.preview.result.designation === fitDesignation;
  const resolvedPreviewReady = !overrideInputsDirty && !fitInputsDirty
    && (fitMode ? fitPreviewReady : props.preview !== null);
  const applicationBlocked = props.busy || applying
    || !props.dirty
    || (classification.status !== 'resolved' && (!props.target.acceptsManualTolerance || !manualReady))
    || (classification.status === 'resolved' && !resolvedPreviewReady);
  const displayedPreview = fitInputsDirty ? null : props.preview;
  const cancelInlineOverride = () => {
    overrideInputGeneration.current += 1;
    setOverrideUpper(hydratedOverrideUpper === undefined ? '' : String(hydratedOverrideUpper));
    setOverrideLower(hydratedOverrideLower === undefined ? '' : String(hydratedOverrideLower));
    setOverrideInputsDirty(false);
    setEditingOverrideField(null);
  };
  const beginInlineOverride = (field: 'upper' | 'lower') => {
    const standard = currentDeviationPair(props.preview, classification.status === 'resolved' ? classification.featureClass : null);
    setOverrideUpper(String(props.override?.upperDeviation ?? standard?.upperDeviation ?? ''));
    setOverrideLower(String(props.override?.lowerDeviation ?? standard?.lowerDeviation ?? ''));
    setOverrideInputsDirty(false);
    setEditingOverrideField(field);
  };
  const confirmInlineOverride = async () => {
    const value = requiredDeviationPair(overrideUpper, overrideLower);
    if (value === null) return;
    const generation = overrideInputGeneration.current;
    try {
      await props.onOverridePreview(value);
      if (generation === overrideInputGeneration.current) {
        setOverrideInputsDirty(false);
        setEditingOverrideField(null);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  };
  const restoreInlineOverride = async (field: 'upper' | 'lower') => {
    const standard = currentDeviationPair(props.preview, classification.status === 'resolved' ? classification.featureClass : null);
    if (standard === null || props.override == null) return;
    const next = field === 'upper'
      ? { upperDeviation: standard.upperDeviation, lowerDeviation: props.override.lowerDeviation }
      : { upperDeviation: props.override.upperDeviation, lowerDeviation: standard.lowerDeviation };
    const generation = ++overrideInputGeneration.current;
    setActionError(null);
    setEditingOverrideField(null);
    if (Object.is(next.upperDeviation, standard.upperDeviation)
      && Object.is(next.lowerDeviation, standard.lowerDeviation)) {
      setOverrideUpper(String(standard.upperDeviation));
      setOverrideLower(String(standard.lowerDeviation));
      setOverrideInputsDirty(false);
      props.onRestoreStandard();
      return;
    }
    try {
      await props.onOverridePreview(next);
      if (generation === overrideInputGeneration.current) {
        setOverrideUpper(String(next.upperDeviation));
        setOverrideLower(String(next.lowerDeviation));
        setOverrideInputsDirty(false);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  };
  const invokeApplication = async (action: () => void | Promise<void>) => {
    if (applicationBlocked || applyingRef.current) return;
    applyingRef.current = true;
    setApplying(true);
    setActionError(null);
    try { await action(); }
    catch (error) { setActionError(error instanceof Error ? error.message : String(error)); }
    finally { applyingRef.current = false; setApplying(false); }
  };

  return <aside
    className="vai-tolerance-popup"
    data-tolerance-popup={true}
    role="dialog"
    aria-label="公差与配合"
    aria-modal="false"
    tabIndex={-1}
    style={{ position: 'absolute', left: props.geometry.x, top: props.geometry.y, width: props.geometry.width, height: props.geometry.height }}
    onKeyDown={keyDown}
    onPointerDown={stop}
    onPointerMove={move}
    onPointerUp={finish}
    onPointerCancel={finish}
    onMouseDown={stop}
    onMouseUp={(event) => { stop(event); finish(); }}
    onClick={stop}
    onDoubleClick={stop}
    onContextMenu={stop}
    onWheel={stop}
    onKeyUp={stop}
  >
    <header
      className="vai-tolerance-popup__title"
      data-tolerance-title={true}
      onPointerDown={(event) => begin('drag', event)}
    >
      <div>
        <strong>{props.target.label ?? props.target.dimensionIntentId}</strong>
        <span>{classification.status === 'resolved'
          ? featureClassLabel(classification.featureClass)
          : classification.status === 'ambiguous'
            ? '需要确认尺寸类型'
            : '仅支持手动偏差'}</span>
      </div>
      <span>GB/T 1800 · {props.standardEdition}</span>
      <button type="button" aria-label="关闭公差选择器" onPointerDown={stop} onClick={props.onRequestClose}>×</button>
    </header>

    {classification.status === 'resolved' && <nav className="vai-tolerance-popup__tabs" aria-label="公差类型">
      <button type="button" data-tolerance-tab="recommendation" aria-pressed={compactTab === 'recommendation'}
        onClick={() => props.onTabChange('recommendation')}>推荐</button>
      <button type="button" data-tolerance-tab={fitTab} aria-pressed={compactTab === 'fit'}
        onClick={() => props.onTabChange(fitTab)}>配合</button>
    </nav>}

    <div className="vai-tolerance-popup__notices" data-tolerance-notices={true}>
      {props.datasetCompleteness === 'partial' && <p className="vai-tolerance-popup__dataset" data-tolerance-dataset="partial">
        部分数据：不可用项目保持禁用，不会推算或回退到其他标准。
      </p>}
      {props.error !== null && <p className="vai-tolerance-popup__error" role="alert">{userFacingToleranceError(props.error)}</p>}
      {actionError !== null && <p className="vai-tolerance-popup__error" role="alert">{actionError}</p>}
    </div>
    {classification.status === 'ambiguous' && <section
      className="vai-tolerance-popup__classification"
      data-tolerance-classification-step={true}
      data-tolerance-content={true}
    >
      <div className="vai-tolerance-popup__classification-intro">
        <span>第一步</span>
        <h2 data-tolerance-classification-title={true}>选择尺寸类型</h2>
        <p>用于筛选适用的 GB/T 1800 公差带，不会修改图纸几何。</p>
      </div>
      <div className="vai-tolerance-popup__classification-cards">
        <button type="button" data-feature-class-choice="internal" onClick={() => props.onFeatureClassChoice('internal')}>
          <span aria-hidden="true">○</span><strong>孔 / 内部尺寸</strong><small>孔径、槽宽等包容尺寸</small>
        </button>
        <button type="button" data-feature-class-choice="external" onClick={() => props.onFeatureClassChoice('external')}>
          <span aria-hidden="true">⌀</span><strong>轴 / 外部尺寸</strong><small>轴径、凸台宽等被包容尺寸</small>
        </button>
      </div>
    </section>}

    {classification.status === 'unsupported' && <section className="vai-tolerance-popup__unsupported" data-tolerance-unsupported={true} data-tolerance-content={true}>
      <h2>该尺寸不能自动匹配标准公差带</h2>
      <p>{manualFallback ? '如已有工艺依据，可以手动输入上下偏差。' : '当前尺寸类型不支持设置线性尺寸公差。'}</p>
      {manualFallback && <>
        <button type="button" className="vai-tolerance-manual-trigger" data-open-manual-tolerance={true}
          aria-expanded={manualPanelOpen} onClick={() => setManualPanelOpen((open) => !open)}>
          {manualPanelOpen ? '收起手动设置' : '手动设置偏差'}
        </button>
        {manualPanelOpen && <ManualEditor
          upper={manualUpper}
          lower={manualLower}
          onUpper={(value) => { setManualUpper(value); setManualReady(false); }}
          onLower={(value) => { setManualLower(value); setManualReady(false); }}
          onPreview={() => {
            const value = optionalDeviationPair(manualUpper, manualLower);
            if (value === null) return;
            setManualReady(true);
            props.onManualPreview(value);
          }}
        />}
      </>}
    </section>}

    {classification.status === 'resolved' && <div className="vai-tolerance-popup__body" data-tolerance-content={true}>
      {fitMode ? <FitBandSelection
        catalogs={props.fitCatalogs ?? null}
        currentFeatureClass={classification.featureClass}
        internal={fitInternal}
        external={fitExternal}
        onInternal={(value) => { setFitInternal(value); setFitInputsDirty(true); fitInputGeneration.current += 1; }}
        onExternal={(value) => { setFitExternal(value); setFitInputsDirty(true); fitInputGeneration.current += 1; }}
        onPreview={async (directDesignation) => {
          const generation = fitInputGeneration.current;
          try {
            await props.onPreview(directDesignation ?? fitDesignation);
            if (generation === fitInputGeneration.current) setFitInputsDirty(false);
          } catch (error) {
            setActionError(error instanceof Error ? error.message : String(error));
          }
        }}
      /> : props.tab === 'recommendation'
        ? <ToleranceRecommendationList
          recommendations={props.recommendations ?? []}
          bands={props.bands}
          selectedDesignation={displayedPreview?.result.designation}
          zoom={props.zoom}
          onPreview={props.onPreview}
          onInspect={setInspectedBand}
          onOpenCatalog={() => props.onTabChange(catalogTab)}
        />
        : <ToleranceCatalogSelection
          bands={props.bands}
          selectedDesignation={displayedPreview?.result.designation}
          zoom={props.zoom}
          onBack={() => props.onTabChange('recommendation')}
          onPreview={async (designation) => {
            const generation = fitInputGeneration.current;
            try {
              await props.onPreview(designation);
              if (generation === fitInputGeneration.current) setFitInputsDirty(false);
            } catch (error) {
              setActionError(error instanceof Error ? error.message : String(error));
            }
          }}
          onInspect={setInspectedBand}
        />}
      <section className="vai-tolerance-inspector">
        {inspectedBand !== null && <p className="vai-tolerance-inspector__hover" data-hovered-tolerance-band={inspectedBand.designation}>
          {inspectedBand.designation}{inspectedBand.available ? '' : ` · ${inspectedBand.unavailableCode}`}
        </p>}
        {displayedPreview === null
          ? fitMode
            ? <div className="vai-tolerance-fit-empty"><strong>等待计算配合结果</strong><span>选择孔与轴的公差代号后，可查看配合类型和间隙或过盈范围。</span></div>
            : <p>选择公差代号以预览结果</p>
          : <ToleranceResult
            preview={displayedPreview}
            currentFeatureClass={classification.status === 'resolved' ? classification.featureClass : null}
            override={props.override ?? null}
            editingField={editingOverrideField}
            editUpper={overrideUpper}
            editLower={overrideLower}
            onEdit={beginInlineOverride}
            onEditValue={(field, value) => {
              if (field === 'upper') setOverrideUpper(value); else setOverrideLower(value);
              setOverrideInputsDirty(true);
              overrideInputGeneration.current += 1;
            }}
            onConfirmEdit={() => void confirmInlineOverride()}
            onCancelEdit={cancelInlineOverride}
            onRestore={(field) => void restoreInlineOverride(field)}
          />}
      </section>
    </div>}

    {classification.status !== 'ambiguous' && <footer className="vai-tolerance-popup__footer" data-tolerance-footer={true}>
      <button type="button" onClick={props.onRequestClose}>取消</button>
      <button type="button" data-apply-tolerance={true} disabled={applicationBlocked} onClick={() => void invokeApplication(props.onApply)}>应用</button>
    </footer>}

    {props.closeDecision === 'dirty' && <div className="vai-tolerance-popup__decision" role="alertdialog" aria-label="未应用的公差预览">
      <span>当前预览尚未应用</span>
      <button type="button" data-dirty-close="discard" onClick={props.onDiscardClose}>放弃并关闭</button>
      <button type="button" data-dirty-close="apply" disabled={applicationBlocked} onClick={() => void invokeApplication(props.onApplyClose)}>应用并关闭</button>
    </div>}
    {props.pendingTarget != null && <div className="vai-tolerance-popup__decision" role="alertdialog" aria-label="切换公差目标">
      <span>当前预览尚未应用，是否切换到 {props.pendingTarget.label ?? props.pendingTarget.dimensionIntentId}</span>
      <button type="button" data-dirty-switch="discard" onClick={props.onDiscardAndSwitch}>放弃并切换</button>
      <button type="button" data-dirty-switch="apply" disabled={applicationBlocked} onClick={() => void invokeApplication(props.onApplyAndSwitch)}>应用并切换</button>
    </div>}
    <button
      type="button"
      className="vai-tolerance-popup__resize vai-tolerance-popup__resize--e"
      data-tolerance-resize="e"
      aria-label="水平调整公差选择器大小"
      onPointerDown={(event) => begin('resize-e', event)}
    />
    <button
      type="button"
      className="vai-tolerance-popup__resize vai-tolerance-popup__resize--s"
      data-tolerance-resize="s"
      aria-label="垂直调整公差选择器大小"
      onPointerDown={(event) => begin('resize-s', event)}
    />
    <button
      type="button"
      className="vai-tolerance-popup__resize vai-tolerance-popup__resize--se"
      data-tolerance-resize="se"
      aria-label="调整公差选择器大小"
      onPointerDown={(event) => begin('resize-se', event)}
    />
  </aside>;
}

function ToleranceRecommendationList({
  recommendations, bands, selectedDesignation, zoom, onPreview, onInspect, onOpenCatalog,
}: {
  recommendations: NonNullable<ToleranceCatalogResult['recommendations']>;
  bands: readonly ToleranceBand[];
  selectedDesignation?: string;
  zoom: number;
  onPreview(designation: string): void | Promise<void>;
  onInspect(band: ToleranceBand | null): void;
  onOpenCatalog(): void;
}) {
  return <section className="vai-tolerance-recommendations" aria-label="推荐公差">
    <header>
      <strong>适用于当前标注</strong>
      <span>按已保存的部位类型与基本尺寸筛选</span>
    </header>
    {recommendations.length > 0 ? <div>
      {recommendations.map(({ designation, category, source, result }) => <button
        key={designation}
        type="button"
        data-tolerance-recommendation={designation}
        data-selected={selectedDesignation === designation}
        onClick={() => onPreview(designation)}
      >
        <strong>{designation}</strong>
        <span>{source === 'ai-recommended' ? 'AI 推荐' : category === 'preferred' ? '优先公差带' : '常用公差带'}</span>
        <small>{formatSigned(result.upperDeviation)} / {formatSigned(result.lowerDeviation)} mm</small>
      </button>)}
    </div> : <ToleranceBandMatrix
      bands={bands}
      selectedDesignation={selectedDesignation}
      zoom={zoom}
      onPreview={onPreview}
      onInspect={onInspect}
    />}
    <button type="button" className="vai-tolerance-recommendations__catalog" data-open-tolerance-catalog={true} onClick={onOpenCatalog}>
      <strong>查看全部公差</strong>
      <span>浏览适用于当前尺寸的完整标准公差带</span>
    </button>
  </section>;
}

function ToleranceCatalogSelection({
  bands, selectedDesignation, zoom, onBack, onPreview, onInspect,
}: {
  bands: readonly ToleranceBand[];
  selectedDesignation?: string;
  zoom: number;
  onBack(): void;
  onPreview(designation: string): void | Promise<void>;
  onInspect(band: ToleranceBand | null): void;
}) {
  return <section className="vai-tolerance-catalog-selection">
    <header>
      <button type="button" data-close-tolerance-catalog={true} onClick={onBack}>← 返回推荐</button>
      <span>全部公差</span>
    </header>
    <ToleranceBandMatrix
      bands={bands}
      selectedDesignation={selectedDesignation}
      zoom={zoom}
      onPreview={onPreview}
      onInspect={onInspect}
    />
  </section>;
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : value === 0 ? '0' : String(value);
}

function fitSelectionFromPreview(preview: TolerancePreviewResult | null): {
  identity: string;
  internal: string;
  external: string;
} | null {
  if (preview?.type !== 'fit' && preview?.type !== 'mating-fit') return null;
  return {
    identity: preview.type === 'fit'
      ? `${preview.holeDimensionIntentId}:${preview.shaftDimensionIntentId}:${preview.result.basis}:${preview.result.designation}`
      : `${preview.dimensionIntentId}:${preview.currentFeatureClass}:${preview.result.designation}`,
    internal: preview.result.hole.designation,
    external: preview.result.shaft.designation,
  };
}

function FitBandSelection({
  catalogs, currentFeatureClass, internal, external, onInternal, onExternal, onPreview,
}: {
  catalogs: { internal: readonly ToleranceBand[]; external: readonly ToleranceBand[] } | null;
  currentFeatureClass: 'internal' | 'external';
  internal: string;
  external: string;
  onInternal(value: string): void;
  onExternal(value: string): void;
  onPreview(designation?: string): void;
}) {
  const internalBands = catalogs?.internal ?? [];
  const externalBands = catalogs?.external ?? [];
  const matingIsInternal = currentFeatureClass === 'external';
  return <section className="vai-tolerance-matrix-shell" data-fit-catalogs={catalogs === null ? 'unavailable' : 'available'}>
    <header className="vai-tolerance-matrix-shell__fit-header">
      <div>
        <strong>选择孔轴配合</strong>
        <span data-fit-explanation={true}>配合用于描述孔与轴装配后的松紧关系。选择两侧公差代号，可计算间隙、过渡或过盈结果。</span>
      </div>
    </header>
    <div className="vai-tolerance-fit-cards">
    <label className="vai-tolerance-fit-card" data-fit-role={matingIsInternal ? 'mating' : 'current'}>
      <span><strong>{matingIsInternal ? '被配合部位' : '当前部位'}</strong><small>孔 / 内部尺寸</small></span>
      <select data-fit-band="internal" value={internal} onChange={(event) => {
        const value = event.currentTarget.value;
        onInternal(value);
        if (value !== '' && external !== '') void onPreview(`${value}/${external}`);
      }}>
        <option value="">请选择</option>
        {internalBands.map(({ designation, available, unavailableCode }) => <option
          key={designation} value={designation} data-fit-option={designation} disabled={!available} title={unavailableCode}
        >{designation}{available ? ` · ${fitUsageHint(designation, 'internal')}` : ` · ${unavailableCode}`}</option>)}
      </select>
    </label>
    <label className="vai-tolerance-fit-card" data-fit-role={matingIsInternal ? 'current' : 'mating'}>
      <span><strong>{matingIsInternal ? '当前部位' : '被配合部位'}</strong><small>轴 / 外部尺寸</small></span>
      <select data-fit-band="external" value={external} onChange={(event) => {
        const value = event.currentTarget.value;
        onExternal(value);
        if (internal !== '' && value !== '') void onPreview(`${internal}/${value}`);
      }}>
        <option value="">请选择</option>
        {externalBands.map(({ designation, available, unavailableCode }) => <option
          key={designation} value={designation} data-fit-option={designation} disabled={!available} title={unavailableCode}
        >{designation}{available ? ` · ${fitUsageHint(designation, 'external')}` : ` · ${unavailableCode}`}</option>)}
      </select>
    </label>
    </div>
  </section>;
}

function ToleranceResult({
  preview, currentFeatureClass, override, editingField, editUpper, editLower,
  onEdit, onEditValue, onConfirmEdit, onCancelEdit, onRestore,
}: {
  preview: TolerancePreviewResult;
  currentFeatureClass: 'internal' | 'external' | null;
  override: { upperDeviation: number; lowerDeviation: number } | null;
  editingField: 'upper' | 'lower' | null;
  editUpper: string;
  editLower: string;
  onEdit(field: 'upper' | 'lower'): void;
  onEditValue(field: 'upper' | 'lower', value: string): void;
  onConfirmEdit(): void;
  onCancelEdit(): void;
  onRestore(field: 'upper' | 'lower'): void;
}) {
  const standard = currentDeviationPair(preview, currentFeatureClass);
  const rowProps = (field: 'upper' | 'lower') => ({
    field,
    editing: editingField === field,
    editValue: field === 'upper' ? editUpper : editLower,
    manuallyOverridden: override !== null && standard !== null && !Object.is(
      field === 'upper' ? override.upperDeviation : override.lowerDeviation,
      field === 'upper' ? standard.upperDeviation : standard.lowerDeviation,
    ),
    onEdit, onEditValue, onConfirmEdit, onCancelEdit, onRestore,
  });
  if (preview.type === 'single') {
    const result = preview.result;
    const shown = displayedToleranceMember(result, true, override);
    return <div className="vai-tolerance-result-shell"><dl className="vai-tolerance-result" data-tolerance-result={true}>
      <dt>代号</dt><dd>{String(result.designation)}</dd>
      <dt>基本尺寸</dt><dd>{String(result.basicSize)}</dd>
      <DeviationRow label="上偏差" value={shown.upperDeviation} {...rowProps('upper')} />
      <DeviationRow label="下偏差" value={shown.lowerDeviation} {...rowProps('lower')} />
      <dt>公差值</dt><dd>{formatDecimal(shown.toleranceMagnitude)}</dd>
      <dt>上极限尺寸</dt><dd>{formatDecimal(shown.upperLimitSize)}</dd>
      <dt>下极限尺寸</dt><dd>{formatDecimal(shown.lowerLimitSize)}</dd>
      <dt>标准</dt><dd data-tolerance-standard={true}>{result.standardRef.id} · {result.standardRef.edition}</dd>
    </dl></div>;
  }
  const result = preview.result;
  const holeEditable = currentFeatureClass === 'internal';
  const shaftEditable = currentFeatureClass === 'external';
  const hole = displayedToleranceMember(result.hole, holeEditable, override);
  const shaft = displayedToleranceMember(result.shaft, shaftEditable, override);
  return <div className="vai-tolerance-result-shell"><dl className="vai-tolerance-result" data-tolerance-fit-result={true}>
    <dt>配合</dt><dd>{String(result.designation)}</dd>
    <dt>配合类型</dt><dd data-fit-business-label={true}>{fitBusinessLabel(result)}</dd>
    <dt>最小间隙/过盈</dt><dd>{formatDecimal(result.minimumClearance)} mm</dd>
    <dt>最大间隙/过盈</dt><dd>{formatDecimal(result.maximumClearance)} mm</dd>
    <dt>基本尺寸</dt><dd>{formatDecimal(result.hole.basicSize)} mm</dd>
    <DeviationRow label="孔上偏差" value={hole.upperDeviation} editable={holeEditable} testId="data-fit-hole-upper" {...rowProps('upper')} />
    <DeviationRow label="孔下偏差" value={hole.lowerDeviation} editable={holeEditable} testId="data-fit-hole-lower" {...rowProps('lower')} />
    <dt>孔公差值</dt><dd>{formatDecimal(hole.toleranceMagnitude)} mm</dd>
    <dt>孔上极限尺寸</dt><dd>{formatDecimal(hole.upperLimitSize)} mm</dd>
    <dt>孔下极限尺寸</dt><dd>{formatDecimal(hole.lowerLimitSize)} mm</dd>
    <DeviationRow label="轴上偏差" value={shaft.upperDeviation} editable={shaftEditable} testId="data-fit-shaft-upper" {...rowProps('upper')} />
    <DeviationRow label="轴下偏差" value={shaft.lowerDeviation} editable={shaftEditable} testId="data-fit-shaft-lower" {...rowProps('lower')} />
    <dt>轴公差值</dt><dd>{formatDecimal(shaft.toleranceMagnitude)} mm</dd>
    <dt>轴上极限尺寸</dt><dd>{formatDecimal(shaft.upperLimitSize)} mm</dd>
    <dt>轴下极限尺寸</dt><dd>{formatDecimal(shaft.lowerLimitSize)} mm</dd>
    <dt>标准</dt><dd data-tolerance-standard={true}>{result.hole.standardRef.id} · {result.hole.standardRef.edition}</dd>
  </dl></div>;
}

function DeviationRow({
  label, value, editable = true, field, editing, editValue, manuallyOverridden, testId,
  onEdit, onEditValue, onConfirmEdit, onCancelEdit, onRestore,
}: {
  label: string;
  value: number;
  editable?: boolean;
  field: 'upper' | 'lower';
  editing: boolean;
  editValue: string;
  manuallyOverridden: boolean;
  testId?: string;
  onEdit(field: 'upper' | 'lower'): void;
  onEditValue(field: 'upper' | 'lower', value: string): void;
  onConfirmEdit(): void;
  onCancelEdit(): void;
  onRestore(field: 'upper' | 'lower'): void;
}) {
  const testProps = testId === undefined ? {} : { [testId]: true };
  return <>
    <dt className="vai-tolerance-deviation-label">{label}{editable && !editing && <button type="button" data-edit-deviation={field} aria-label={`编辑${label}`} onClick={() => onEdit(field)}>✎</button>}</dt>
    <dd {...testProps} className="vai-tolerance-deviation-value">
      {editing ? <span className="vai-tolerance-inline-editor">
        <input
          data-tolerance-override={field}
          inputMode="decimal"
          value={editValue}
          onChange={(event) => onEditValue(field, event.currentTarget.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter') { event.preventDefault(); onConfirmEdit(); }
            if (event.key === 'Escape') { event.preventDefault(); onCancelEdit(); }
          }}
        />
        <span>mm</span>
        <button type="button" data-confirm-inline-override={field} aria-label={`确认${label}`} onClick={onConfirmEdit}>✓</button>
        <button type="button" data-cancel-manual-override={field} aria-label={`取消${label}`} onClick={onCancelEdit}>×</button>
      </span> : <>{formatSignedDecimal(value)} mm{editable && manuallyOverridden && <>
        <small data-manual-override-status={field}>手动</small>
        <button type="button" data-restore-standard={field} aria-label={`恢复${label}标准值`} onClick={() => onRestore(field)}>↺</button>
      </>}</>}
    </dd>
  </>;
}

function displayedToleranceMember<T extends {
  basicSize: number; upperDeviation: number; lowerDeviation: number;
  toleranceMagnitude: number; upperLimitSize: number; lowerLimitSize: number;
}>(member: T, editable: boolean, override: { upperDeviation: number; lowerDeviation: number } | null): T {
  if (!editable || override === null) return member;
  return {
    ...member,
    upperDeviation: override.upperDeviation,
    lowerDeviation: override.lowerDeviation,
    toleranceMagnitude: Math.abs(override.upperDeviation - override.lowerDeviation),
    upperLimitSize: member.basicSize + override.upperDeviation,
    lowerLimitSize: member.basicSize + override.lowerDeviation,
  };
}

function currentDeviationPair(
  preview: TolerancePreviewResult | null,
  currentFeatureClass: 'internal' | 'external' | null,
): { upperDeviation: number; lowerDeviation: number } | null {
  if (preview === null) return null;
  if (preview.type === 'single') return preview.result;
  const featureClass = preview.type === 'mating-fit' ? preview.currentFeatureClass : currentFeatureClass;
  return featureClass === 'internal' ? preview.result.hole : featureClass === 'external' ? preview.result.shaft : null;
}

function formatDecimal(value: number): string {
  return Number(value.toFixed(6)).toString();
}

function formatSignedDecimal(value: number): string {
  const formatted = formatDecimal(value);
  return value > 0 ? `+${formatted}` : formatted;
}

function fitBusinessLabel(result: Extract<TolerancePreviewResult, { type: 'fit' | 'mating-fit' }>['result']): string {
  if (result.fitType === 'transition') return '过渡配合';
  const holePosition = result.hole.designation.replace(/\d+$/, '');
  const shaftPosition = result.shaft.designation.replace(/\d+$/, '');
  if (result.fitType === 'clearance') {
    return holePosition === 'H' && (shaftPosition === 'g' || shaftPosition === 'h')
      ? '小间隙配合' : '间隙配合';
  }
  return shaftPosition === 'p' ? '轻压入配合' : '过盈配合';
}

function fitUsageHint(designation: string, featureClass: 'internal' | 'external'): string {
  const position = designation.replace(/\d+$/, '').toLowerCase();
  if (featureClass === 'internal' && position === 'h') return '常用基准孔';
  if (position === 'g' || position === 'h') return '常用于小间隙';
  if (['a', 'b', 'c', 'cd', 'd', 'e', 'ef', 'f', 'fg'].includes(position)) return '常用于间隙';
  if (['js', 'j', 'k', 'm', 'n'].includes(position)) return '常用于过渡';
  if (['p', 'r', 's', 't', 'u', 'v', 'x', 'y', 'z', 'za', 'zb', 'zc'].includes(position)) return '常用于过盈';
  return '标准公差带';
}

function ManualEditor({
  upper, lower, onUpper, onLower, onPreview,
}: {
  upper: string; lower: string;
  onUpper(value: string): void; onLower(value: string): void; onPreview(): void;
}) {
  return <fieldset className="vai-tolerance-manual">
    <legend>手动偏差</legend>
    <label>上偏差<input data-manual-deviation="upper" value={upper} onChange={(event) => onUpper(event.currentTarget.value)} /></label>
    <label>下偏差<input data-manual-deviation="lower" value={lower} onChange={(event) => onLower(event.currentTarget.value)} /></label>
    <button type="button" data-preview-manual={true} onClick={onPreview}>预览手动值</button>
  </fieldset>;
}

function requiredDeviationPair(upper: string, lower: string): { upperDeviation: number; lowerDeviation: number } | null {
  const upperDeviation = Number(upper);
  const lowerDeviation = Number(lower);
  return upper.trim() !== '' && lower.trim() !== '' && Number.isFinite(upperDeviation) && Number.isFinite(lowerDeviation)
    ? { upperDeviation, lowerDeviation }
    : null;
}

function optionalDeviationPair(upper: string, lower: string): { upperDeviation?: number; lowerDeviation?: number } | null {
  const upperDeviation = upper.trim() === '' ? undefined : Number(upper);
  const lowerDeviation = lower.trim() === '' ? undefined : Number(lower);
  if ((upperDeviation === undefined && lowerDeviation === undefined)
    || (upperDeviation !== undefined && !Number.isFinite(upperDeviation))
    || (lowerDeviation !== undefined && !Number.isFinite(lowerDeviation))) return null;
  return {
    ...(upperDeviation === undefined ? {} : { upperDeviation }),
    ...(lowerDeviation === undefined ? {} : { lowerDeviation }),
  };
}

function featureClassLabel(value: 'internal' | 'external'): string {
  return value === 'internal' ? '孔/内部尺寸' : '轴/外部尺寸';
}

function userFacingToleranceError(error: string): string {
  switch (error) {
    case 'TOLERANCE_FEATURE_CLASS_AMBIGUOUS':
      return '尚未确认尺寸类型，请关闭后重新选择尺寸类型。';
    case 'TOLERANCE_FEATURE_CLASS_MISMATCH':
      return '当前选择与已保存的尺寸类型不一致。';
    case 'TOLERANCE_STANDARD_UNAVAILABLE':
      return '当前基本尺寸没有可用的标准公差数据。';
    case 'TOLERANCE_BASIC_SIZE_INVALID':
      return '该尺寸不能用于标准公差计算。';
    default:
      return error;
  }
}
