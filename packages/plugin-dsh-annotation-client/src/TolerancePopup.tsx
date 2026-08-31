// SPDX-License-Identifier: Apache-2.0

import type { TolerancePreviewResult } from '@vectorai/plugin-space-contracts';
import { useRef, useState, type PointerEvent as ReactPointerEvent, type SyntheticEvent } from 'react';
import { clampTolerancePopupGeometry, type PopupRect, type PopupSize, type ToleranceDisplayPreference, type TolerancePopupTab, type ToleranceTarget } from './tolerance-controller';
import { ToleranceBandMatrix, type ToleranceBand } from './ToleranceBandMatrix';

export interface TolerancePopupProps {
  geometry: PopupRect;
  viewport: PopupSize;
  target: ToleranceTarget;
  bands: readonly ToleranceBand[];
  tab: TolerancePopupTab;
  zoom: number;
  standardEdition: string;
  datasetCompleteness?: 'complete' | 'partial';
  preview: TolerancePreviewResult | null;
  displayPreference: ToleranceDisplayPreference;
  dirty: boolean;
  closeDecision: 'dirty' | null;
  busy: boolean;
  error: string | null;
  fitStatus?: string | null;
  override?: { upperDeviation: number; lowerDeviation: number } | null;
  onPreview(designation: string): void;
  onApply(): void;
  onRequestClose(): void;
  onDiscardClose(): void;
  onApplyClose(): void;
  onGeometryChange(geometry: PopupRect, options: { userDragged: true }): void;
  onTabChange(tab: TolerancePopupTab): void;
  onZoomChange(zoom: number): void;
  onDisplayPreferenceChange(preference: ToleranceDisplayPreference): void;
  onOverridePreview(value: { upperDeviation: number; lowerDeviation: number }): void;
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
  const [inspectedBand, setInspectedBand] = useState<ToleranceBand | null>(null);
  const [overrideUpper, setOverrideUpper] = useState(props.override === null || props.override === undefined ? '' : String(props.override.upperDeviation));
  const [overrideLower, setOverrideLower] = useState(props.override === null || props.override === undefined ? '' : String(props.override.lowerDeviation));
  const [manualUpper, setManualUpper] = useState('');
  const [manualLower, setManualLower] = useState('');
  const [manualReady, setManualReady] = useState(false);
  const stop = (event: SyntheticEvent) => event.stopPropagation();
  const begin = (kind: PointerOperation['kind'], event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    operation.current = { kind, pointer: { x: event.clientX, y: event.clientY }, geometry: props.geometry } as PointerOperation;
  };
  const move = (event: ReactPointerEvent<HTMLElement>) => {
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
  const keyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation?.();
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      props.onApply();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      props.onRequestClose();
    }
  };
  const classification = props.target.classification;
  const manualFallback = classification.status === 'unsupported' && props.target.acceptsManualTolerance;
  const applicationBlocked = props.busy
    || classification.status === 'ambiguous'
    || (classification.status === 'unsupported' && (!props.target.acceptsManualTolerance || !manualReady))
    || (classification.status === 'resolved' && props.preview === null);

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
    onPointerUp={() => { operation.current = null; }}
    onMouseDown={stop}
    onClick={stop}
    onContextMenu={stop}
    onWheel={stop}
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
    {classification.status !== 'resolved' && <section className="vai-tolerance-popup__diagnostic">
      <p data-tolerance-diagnostic={true}>{classification.code}</p>
      {classification.status === 'ambiguous' && <div className="vai-tolerance-popup__class-choice">
        <button type="button" data-feature-class-choice="internal" onClick={() => props.onFeatureClassChoice('internal')}>孔/内部尺寸</button>
        <button type="button" data-feature-class-choice="external" onClick={() => props.onFeatureClassChoice('external')}>轴/外部尺寸</button>
      </div>}
      {manualFallback && <ManualEditor
        upper={manualUpper}
        lower={manualLower}
        onUpper={setManualUpper}
        onLower={setManualLower}
        onPreview={() => {
          const value = optionalDeviationPair(manualUpper, manualLower);
          if (value === null) return;
          setManualReady(true);
          props.onManualPreview(value);
        }}
      />}
    </section>}

    {classification.status === 'resolved' && <div className="vai-tolerance-popup__body">
      <ToleranceBandMatrix
        bands={props.bands}
        selectedDesignation={props.preview?.result.designation}
        zoom={props.zoom}
        onPreview={props.onPreview}
        onInspect={setInspectedBand}
      />
      <section className="vai-tolerance-inspector">
        {inspectedBand !== null && <p className="vai-tolerance-inspector__hover" data-hovered-tolerance-band={inspectedBand.designation}>
          {inspectedBand.designation}{inspectedBand.available ? '' : ` · ${inspectedBand.unavailableCode}`}
        </p>}
        {props.preview === null ? <p>选择公差代号以预览结果</p> : <ToleranceResult preview={props.preview} />}
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
          <label>上偏差<input data-tolerance-override="upper" inputMode="decimal" value={overrideUpper} onChange={(event) => setOverrideUpper(event.currentTarget.value)} /></label>
          <label>下偏差<input data-tolerance-override="lower" inputMode="decimal" value={overrideLower} onChange={(event) => setOverrideLower(event.currentTarget.value)} /></label>
          <button type="button" data-preview-override={true} onClick={() => {
            const value = requiredDeviationPair(overrideUpper, overrideLower);
            if (value !== null) props.onOverridePreview(value);
          }}>预览覆盖</button>
          <button type="button" data-restore-standard={true} onClick={props.onRestoreStandard}>恢复标准值</button>
        </fieldset>
        {(props.tab === 'hole-fit' || props.tab === 'shaft-fit') && <p data-fit-selection-status={true}>
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
      <button type="button" data-restore-recommendation={true} onClick={props.onRestoreRecommendation}>恢复自动推荐</button>
      <button type="button" onClick={props.onRequestClose}>取消</button>
      <button type="button" data-apply-tolerance={true} disabled={applicationBlocked} onClick={props.onApply}>应用</button>
    </footer>

    {props.closeDecision === 'dirty' && <div className="vai-tolerance-popup__decision" role="alertdialog" aria-label="未应用的公差预览">
      <span>当前预览尚未应用</span>
      <button type="button" data-dirty-close="discard" onClick={props.onDiscardClose}>放弃并关闭</button>
      <button type="button" data-dirty-close="apply" onClick={props.onApplyClose}>应用并关闭</button>
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

function ToleranceResult({ preview }: { preview: TolerancePreviewResult }) {
  if (preview.type === 'single') {
    const result = preview.result;
    return <dl className="vai-tolerance-result" data-tolerance-result={true}>
      <dt>代号</dt><dd>{String(result.designation)}</dd>
      <dt>基本尺寸</dt><dd>{String(result.basicSize)}</dd>
      <dt>上偏差</dt><dd>{String(result.upperDeviation)}</dd>
      <dt>下偏差</dt><dd>{String(result.lowerDeviation)}</dd>
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
    <dt>孔偏差</dt><dd>{String(result.hole.upperDeviation)} / {String(result.hole.lowerDeviation)}</dd>
    <dt>轴偏差</dt><dd>{String(result.shaft.upperDeviation)} / {String(result.shaft.lowerDeviation)}</dd>
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
