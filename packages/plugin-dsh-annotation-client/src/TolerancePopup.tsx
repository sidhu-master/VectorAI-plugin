// SPDX-License-Identifier: Apache-2.0

import type { TolerancePreviewResult } from '@vectorai/plugin-space-contracts';
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
  busy: boolean;
  error: string | null;
  fitStatus?: string | null;
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
  onManualPreview(value: { upperDeviation?: number; lowerDeviation?: number }): void;
}

type PointerOperation =
  | { kind: 'drag'; pointer: { x: number; y: number }; geometry: PopupRect }
  | { kind: 'resize-e'; pointer: { x: number; y: number }; geometry: PopupRect }
  | { kind: 'resize-s'; pointer: { x: number; y: number }; geometry: PopupRect }
  | { kind: 'resize-se'; pointer: { x: number; y: number }; geometry: PopupRect };

const tabs: Array<{ id: TolerancePopupTab; label: string }> = [
  { id: 'recommendation', label: '推荐' },
  { id: 'external', label: '轴/外部尺寸' },
  { id: 'internal', label: '孔/内部尺寸' },
  { id: 'hole-fit', label: '基孔配合' },
  { id: 'shaft-fit', label: '基轴配合' },
];
const preferences: Array<{ id: ToleranceDisplayPreference; label: string }> = [
  { id: 'deviations', label: '仅偏差' },
  { id: 'designation', label: '仅代号' },
  { id: 'both', label: '代号与偏差' },
];

export function TolerancePopup(props: TolerancePopupProps) {
  const operation = useRef<PointerOperation | null>(null);
  const capture = useRef<{ owner: HTMLElement; pointerId: number } | null>(null);
  const [inspectedBand, setInspectedBand] = useState<ToleranceBand | null>(null);
  const [overrideUpper, setOverrideUpper] = useState(props.override === null || props.override === undefined ? '' : String(props.override.upperDeviation));
  const [overrideLower, setOverrideLower] = useState(props.override === null || props.override === undefined ? '' : String(props.override.lowerDeviation));
  const [manualUpper, setManualUpper] = useState('');
  const [manualLower, setManualLower] = useState('');
  const [manualReady, setManualReady] = useState(false);
  const [fitInternal, setFitInternal] = useState('');
  const [fitExternal, setFitExternal] = useState('');
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
  const localHydratedOverride = useRef({ targetIdentity, upper: hydratedOverrideUpper, lower: hydratedOverrideLower });
  useEffect(() => {
    if (localTargetIdentity.current === targetIdentity) return;
    localTargetIdentity.current = targetIdentity;
    setManualUpper('');
    setManualLower('');
    setManualReady(false);
    setFitInternal('');
    setFitExternal('');
    setFitInputsDirty(false);
    setOverrideInputsDirty(false);
    fitInputGeneration.current += 1;
    overrideInputGeneration.current += 1;
    setInspectedBand(null);
    setActionError(null);
  }, [targetIdentity]);
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
  const fitMode = props.tab === 'hole-fit' || props.tab === 'shaft-fit';
  const fitDesignation = `${fitInternal}/${fitExternal}`;
  const fitPreviewReady = !fitInputsDirty
    && fitInternal !== ''
    && fitExternal !== ''
    && props.preview?.type === 'fit'
    && props.preview.result.designation === fitDesignation;
  const resolvedPreviewReady = !overrideInputsDirty && !fitInputsDirty
    && (fitMode ? fitPreviewReady : props.preview !== null);
  const applicationBlocked = props.busy || applying
    || !props.dirty
    || (classification.status !== 'resolved' && (!props.target.acceptsManualTolerance || !manualReady))
    || (classification.status === 'resolved' && !resolvedPreviewReady);
  const displayedPreview = overrideInputsDirty || fitInputsDirty ? null : props.preview;
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
        <span>{classification.status === 'resolved' ? featureClassLabel(classification.featureClass) : classification.code}</span>
      </div>
      <span>GB/T 1800 · {props.standardEdition}</span>
      <button type="button" aria-label="关闭公差选择器" onPointerDown={stop} onClick={props.onRequestClose}>×</button>
    </header>

    <nav className="vai-tolerance-popup__tabs" aria-label="公差类型">
      {tabs.map(({ id, label }) => <button
        key={id}
        type="button"
        data-tolerance-tab={id}
        aria-pressed={props.tab === id}
        onClick={() => props.onTabChange(id)}
      >{label}</button>)}
    </nav>

    {props.datasetCompleteness === 'partial' && <p className="vai-tolerance-popup__dataset" data-tolerance-dataset="partial">
      部分数据：不可用项目保持禁用，不会推算或回退到其他标准。
    </p>}
    {props.error !== null && <p className="vai-tolerance-popup__error" role="alert">{props.error}</p>}
    {actionError !== null && <p className="vai-tolerance-popup__error" role="alert">{actionError}</p>}
    {classification.status !== 'resolved' && <section className="vai-tolerance-popup__diagnostic">
      <p data-tolerance-diagnostic={true}>{classification.code}</p>
      {classification.status === 'ambiguous' && <div className="vai-tolerance-popup__class-choice">
        <button type="button" data-feature-class-choice="internal" onClick={() => props.onFeatureClassChoice('internal')}>孔/内部尺寸</button>
        <button type="button" data-feature-class-choice="external" onClick={() => props.onFeatureClassChoice('external')}>轴/外部尺寸</button>
      </div>}
      {manualFallback && <ManualEditor
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
    </section>}

    {classification.status === 'resolved' && <div className="vai-tolerance-popup__body">
      {fitMode ? <FitBandSelection
        catalogs={props.fitCatalogs ?? null}
        internal={fitInternal}
        external={fitExternal}
        onInternal={(value) => { setFitInternal(value); setFitInputsDirty(true); fitInputGeneration.current += 1; }}
        onExternal={(value) => { setFitExternal(value); setFitInputsDirty(true); fitInputGeneration.current += 1; }}
        onPreview={async () => {
          const generation = fitInputGeneration.current;
          try {
            await props.onPreview(fitDesignation);
            if (generation === fitInputGeneration.current) setFitInputsDirty(false);
          } catch (error) {
            setActionError(error instanceof Error ? error.message : String(error));
          }
        }}
      /> : <ToleranceBandMatrix
        bands={props.bands}
        selectedDesignation={displayedPreview?.result.designation}
        zoom={props.zoom}
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
        {displayedPreview === null ? <p>选择公差代号以预览结果</p> : <ToleranceResult preview={displayedPreview} />}
        <div className="vai-tolerance-display-preference" aria-label="公差显示方式">
          {preferences.map(({ id, label }) => <button
            key={id}
            type="button"
            data-display-preference={id}
            aria-pressed={props.displayPreference === id}
            onClick={() => props.onDisplayPreferenceChange(id)}
          >{label}</button>)}
        </div>
        <fieldset className="vai-tolerance-override">
          <legend>手动偏差覆盖</legend>
          <label>上偏差<input data-tolerance-override="upper" inputMode="decimal" value={overrideUpper} onChange={(event) => { setOverrideUpper(event.currentTarget.value); setOverrideInputsDirty(true); overrideInputGeneration.current += 1; }} /></label>
          <label>下偏差<input data-tolerance-override="lower" inputMode="decimal" value={overrideLower} onChange={(event) => { setOverrideLower(event.currentTarget.value); setOverrideInputsDirty(true); overrideInputGeneration.current += 1; }} /></label>
          <button type="button" data-preview-override={true} onClick={() => void (async () => {
            const value = requiredDeviationPair(overrideUpper, overrideLower);
            if (value === null) return;
            const generation = overrideInputGeneration.current;
            try {
              await props.onOverridePreview(value);
              if (generation === overrideInputGeneration.current) setOverrideInputsDirty(false);
            } catch (error) {
              setActionError(error instanceof Error ? error.message : String(error));
            }
          })()}>预览覆盖</button>
          <button type="button" data-restore-standard={true} onClick={() => {
            overrideInputGeneration.current += 1;
            setOverrideUpper('');
            setOverrideLower('');
            setOverrideInputsDirty(false);
            props.onRestoreStandard();
          }}>恢复标准值</button>
        </fieldset>
        {fitMode && <p data-fit-selection-status={true}>
          {props.fitStatus ?? '选择配合对象'}
        </p>}
      </section>
    </div>}

    <footer className="vai-tolerance-popup__footer">
      <div className="vai-tolerance-popup__zoom">
        <button type="button" aria-label="缩小公差表" onClick={() => props.onZoomChange(props.zoom - .1)}>−</button>
        <span>{Math.round(props.zoom * 100)}%</span>
        <button type="button" aria-label="放大公差表" onClick={() => props.onZoomChange(props.zoom + .1)}>+</button>
      </div>
      <button type="button" data-restore-recommendation={true} disabled={props.recommendation == null} onClick={props.onRestoreRecommendation}>恢复自动推荐</button>
      {props.recommendation == null && <span data-recommendation-unavailable={true}>TOLERANCE_RECOMMENDATION_UNAVAILABLE</span>}
      <button type="button" onClick={props.onRequestClose}>取消</button>
      <button type="button" data-apply-tolerance={true} disabled={applicationBlocked} onClick={() => void invokeApplication(props.onApply)}>应用</button>
    </footer>

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

function FitBandSelection({
  catalogs, internal, external, onInternal, onExternal, onPreview,
}: {
  catalogs: { internal: readonly ToleranceBand[]; external: readonly ToleranceBand[] } | null;
  internal: string;
  external: string;
  onInternal(value: string): void;
  onExternal(value: string): void;
  onPreview(): void;
}) {
  const internalBands = catalogs?.internal ?? [];
  const externalBands = catalogs?.external ?? [];
  return <section className="vai-tolerance-matrix-shell" data-fit-catalogs={catalogs === null ? 'unavailable' : 'available'}>
    <label>孔/内部代号
      <select data-fit-band="internal" value={internal} onChange={(event) => onInternal(event.currentTarget.value)}>
        <option value="">请选择</option>
        {internalBands.map(({ designation, available, unavailableCode }) => <option
          key={designation} value={designation} data-fit-option={designation} disabled={!available} title={unavailableCode}
        >{designation}{available ? '' : ` · ${unavailableCode}`}</option>)}
      </select>
    </label>
    <label>轴/外部代号
      <select data-fit-band="external" value={external} onChange={(event) => onExternal(event.currentTarget.value)}>
        <option value="">请选择</option>
        {externalBands.map(({ designation, available, unavailableCode }) => <option
          key={designation} value={designation} data-fit-option={designation} disabled={!available} title={unavailableCode}
        >{designation}{available ? '' : ` · ${unavailableCode}`}</option>)}
      </select>
    </label>
    <button type="button" data-preview-fit={true} disabled={internal === '' || external === ''} onClick={onPreview}>
      预览 {internal === '' || external === '' ? '配合' : `${internal}/${external}`}
    </button>
  </section>;
}

function ToleranceResult({ preview }: { preview: TolerancePreviewResult }) {
  if (preview.type === 'single') {
    const result = preview.result;
    return <dl className="vai-tolerance-result" data-tolerance-result={true}>
      <dt>代号</dt><dd>{String(result.designation)}</dd>
      <dt>基本尺寸</dt><dd>{String(result.basicSize)}</dd>
      <dt>上偏差</dt><dd>{String(result.upperDeviation)}</dd>
      <dt>下偏差</dt><dd>{String(result.lowerDeviation)}</dd>
      <dt>公差值</dt><dd>{String(result.toleranceMagnitude)}</dd>
      <dt>上极限尺寸</dt><dd>{String(result.upperLimitSize)}</dd>
      <dt>下极限尺寸</dt><dd>{String(result.lowerLimitSize)}</dd>
      <dt>标准</dt><dd>{result.standardRef.id} · {result.standardRef.edition}</dd>
    </dl>;
  }
  const result = preview.result;
  return <dl className="vai-tolerance-result" data-tolerance-fit-result={true}>
    <dt>配合</dt><dd>{String(result.designation)}</dd>
    <dt>类型</dt><dd>{String(result.fitType)}</dd>
    <dt>最小间隙/过盈</dt><dd>{String(result.minimumClearance)}</dd>
    <dt>最大间隙/过盈</dt><dd>{String(result.maximumClearance)}</dd>
    <dt>基本尺寸</dt><dd>{String(result.hole.basicSize)}</dd>
    <dt>孔偏差</dt><dd>{String(result.hole.upperDeviation)} / {String(result.hole.lowerDeviation)}</dd>
    <dt>孔公差值</dt><dd>{String(result.hole.toleranceMagnitude)}</dd>
    <dt>孔极限尺寸</dt><dd>{String(result.hole.upperLimitSize)} / {String(result.hole.lowerLimitSize)}</dd>
    <dt>轴偏差</dt><dd>{String(result.shaft.upperDeviation)} / {String(result.shaft.lowerDeviation)}</dd>
    <dt>轴公差值</dt><dd>{String(result.shaft.toleranceMagnitude)}</dd>
    <dt>轴极限尺寸</dt><dd>{String(result.shaft.upperLimitSize)} / {String(result.shaft.lowerLimitSize)}</dd>
    <dt>标准</dt><dd>{result.hole.standardRef.id} · {result.hole.standardRef.edition}</dd>
  </dl>;
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
