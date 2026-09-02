// SPDX-License-Identifier: Apache-2.0

import {
  listGbt1031SurfaceTextureValues,
  listGbt1184PositionToleranceSeries,
  lookupGbt1184GeneralTolerance,
  lookupGbt1184SpecifiedTolerance,
} from '@vectorai/engineering-annotation';
import type { DrawingDocument } from '@vectorai/drawing-core';
import { nodeBounds } from '@vectorai/drawing-viewer-react';
import type { EngineeringAnnotationDraft } from '@vectorai/plugin-space-contracts';
import { useState } from 'react';
import type { GdtController } from './gdt-controller';

const CHARACTERISTICS = [
  'straightness', 'flatness', 'circularity', 'cylindricity', 'profile-line', 'profile-surface',
  'parallelism', 'perpendicularity', 'angularity', 'position', 'coaxiality', 'symmetry',
  'circular-runout', 'total-runout',
] as const;

export type GdtEditorSelection =
  | { type: 'intent'; id: string }
  | { type: 'datum'; id: string }
  | { type: 'surface-texture'; id: string };

export function estimateGdtEvaluationLength(
  document: DrawingDocument,
  geometryIds: readonly string[],
): number | undefined {
  const selected = new Set(geometryIds);
  const bounds = document.geometry
    .filter(({ id }) => selected.has(String(id)))
    .map(nodeBounds)
    .filter((value): value is NonNullable<ReturnType<typeof nodeBounds>> => value !== null);
  if (bounds.length === 0) return undefined;
  const combined = bounds.reduce((result, current) => ({
    minX: Math.min(result.minX, current.minX), minY: Math.min(result.minY, current.minY),
    maxX: Math.max(result.maxX, current.maxX), maxY: Math.max(result.maxY, current.maxY),
  }));
  const length = Math.max(combined.maxX - combined.minX, combined.maxY - combined.minY);
  return Number.isFinite(length) && length > 0 ? Number(length.toPrecision(12)) : undefined;
}

export function GdtInspector({ draft, selection, selectedGeometryIds, evaluationLength, controller, onClose }: {
  draft: EngineeringAnnotationDraft;
  selection: GdtEditorSelection;
  selectedGeometryIds: readonly string[];
  evaluationLength?: number;
  controller: GdtController;
  onClose(): void;
}) {
  const intent = selection.type === 'intent'
    ? draft.geometricTolerances.find(({ id }) => id === selection.id)
    : undefined;
  const datum = selection.type === 'datum'
    ? draft.datums.find(({ id }) => id === selection.id)
    : undefined;
  const surfaceTexture = selection.type === 'surface-texture'
    ? draft.surfaceTextures.find(({ id }) => id === selection.id)
    : undefined;
  const [characteristic, setCharacteristic] = useState(intent?.characteristic ?? 'straightness');
  const [zoneShape, setZoneShape] = useState(intent?.toleranceZone.shape ?? 'linear');
  const [valueText, setValueText] = useState(String(intent?.override?.value ?? intent?.computed.value ?? ''));
  const [evaluationLengthText, setEvaluationLengthText] = useState(evaluationLength === undefined ? '' : formatNumber(evaluationLength));
  const [datumReferences, setDatumReferences] = useState<string[]>(intent?.datumReferenceFrame.map(({ datumId }) => datumId) ?? []);
  const [controlledGeometryIds, setControlledGeometryIds] = useState<string[]>(intent?.controlledTargets.map(({ geometryId }) => String(geometryId)) ?? []);
  const [datumName, setDatumName] = useState(datum?.name ?? '');
  const [datumRole, setDatumRole] = useState(datum?.role ?? 'primary');
  const [datumGeometryId, setDatumGeometryId] = useState(String(datum?.geometryId ?? ''));
  const [textureParameter, setTextureParameter] = useState(surfaceTexture?.parameter ?? 'Ra');
  const [textureValueText, setTextureValueText] = useState(String(surfaceTexture?.value ?? ''));
  const [materialRemoval, setMaterialRemoval] = useState(surfaceTexture?.materialRemoval ?? 'required');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (intent === undefined && datum === undefined && surfaceTexture === undefined) return null;
  const value = Number(valueText);
  const parsedEvaluationLength = Number(evaluationLengthText);
  const standardEntries = intent === undefined ? [] : lookupGbt1184GeneralTolerance(
    characteristic,
    Number.isFinite(parsedEvaluationLength) && parsedEvaluationLength > 0 ? parsedEvaluationLength : undefined,
  );
  const specifiedEntries = intent === undefined ? [] : lookupGbt1184SpecifiedTolerance(
    characteristic,
    Number.isFinite(parsedEvaluationLength) && parsedEvaluationLength > 0 ? parsedEvaluationLength : undefined,
  );
  const specifiedUsesLength = [
    'straightness', 'flatness', 'circularity', 'cylindricity', 'parallelism', 'perpendicularity', 'angularity',
    'coaxiality', 'symmetry', 'circular-runout', 'total-runout',
  ].includes(characteristic);
  const positionValues = characteristic === 'position'
    ? listGbt1184PositionToleranceSeries({ min: 0.001, max: 10 })
    : [];
  const invalidValue = intent !== undefined && (!Number.isFinite(value) || value <= 0);
  const textureValue = Number(textureValueText);
  const textureStandardValues = surfaceTexture === undefined
    ? []
    : listGbt1031SurfaceTextureValues(textureParameter);
  const invalidTextureValue = surfaceTexture !== undefined && (!Number.isFinite(textureValue) || textureValue <= 0);
  const title = surfaceTexture !== undefined ? '表面粗糙度'
    : intent === undefined ? `基准 ${datum?.name ?? ''}` : '形位公差';

  const apply = async () => {
    if (busy || invalidValue || invalidTextureValue) return;
    setBusy(true);
    setError(null);
    try {
      if (surfaceTexture !== undefined) {
        await controller.actions.edit({
          type: 'surface-texture.set', intentId: surfaceTexture.id,
          parameter: textureParameter, value: textureValue, materialRemoval,
        });
      } else if (datum !== undefined) {
        await controller.actions.edit({
          type: 'datum.set', datumId: datum.id, name: datumName.trim(), role: datumRole,
          geometryId: datumGeometryId,
          anchor: datumGeometryId === String(datum.geometryId)
            ? datum.anchor
            : { kind: 'nearest', point: datum.anchor.kind === 'nearest' ? datum.anchor.point : [0, 0] },
        });
      } else if (intent !== undefined) {
        if (characteristic !== intent.characteristic) {
          await controller.actions.edit({ type: 'characteristic.set', intentId: intent.id, characteristic });
        }
        if (zoneShape !== intent.toleranceZone.shape) {
          await controller.actions.edit({ type: 'zone.set', intentId: intent.id, zone: { ...intent.toleranceZone, shape: zoneShape } });
        }
        const references = datumReferences.filter(Boolean).map((datumId) => (
          intent.datumReferenceFrame.find((reference) => reference.datumId === datumId) ?? { datumId }
        ));
        if (JSON.stringify(references) !== JSON.stringify(intent.datumReferenceFrame)) {
          await controller.actions.edit({ type: 'datum-frame.set', intentId: intent.id, references });
        }
        if (controlledGeometryIds.length > 0
          && JSON.stringify(controlledGeometryIds) !== JSON.stringify(intent.controlledTargets.map(({ geometryId }) => String(geometryId)))) {
          await controller.actions.edit({
            type: 'controlled-targets.set', intentId: intent.id,
            targets: controlledGeometryIds.map((geometryId, index) => ({
              geometryId,
              anchor: intent.controlledTargets[index]?.anchor ?? intent.controlledTargets[0]?.anchor ?? { kind: 'nearest', point: [0, 0] },
            })),
          });
        }
        if (intent.override?.value !== value) await controller.actions.setOverride(intent.id, value);
      }
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return <section
    className="vai-gdt-popup"
    role="dialog"
    aria-modal="true"
    aria-label={`${title}编辑`}
    onMouseDown={(event) => event.stopPropagation()}
    onPointerDown={(event) => event.stopPropagation()}
    onWheel={(event) => event.stopPropagation()}
  >
    <header className="vai-gdt-popup__header">
      <div><strong>{title}</strong><span>{intent?.id ?? datum?.id}</span></div>
      <button type="button" aria-label="关闭基准与形位公差弹窗" onClick={onClose}>×</button>
    </header>
    <div className="vai-gdt-popup__body">
      {surfaceTexture !== undefined ? <>
        <label>粗糙度参数
          <select value={textureParameter} onChange={(event) => setTextureParameter(event.target.value as typeof textureParameter)}>
            <option value="Ra">Ra（轮廓算术平均偏差）</option>
            <option value="Rz">Rz（轮廓最大高度）</option>
            <option value="Rq">Rq（均方根偏差）</option>
            <option value="Rt">Rt（轮廓总高度）</option>
          </select>
        </label>
        <label>加工要求
          <select value={materialRemoval} onChange={(event) => setMaterialRemoval(event.target.value as typeof materialRemoval)}>
            <option value="required">要求去除材料</option>
            <option value="prohibited">不允许去除材料</option>
            <option value="unspecified">加工方式不指定</option>
          </select>
        </label>
        <section className="vai-gdt-popup__wide vai-surface-texture-picker" aria-label="表面粗糙度值选择">
          <div className="vai-surface-texture-recommendation">
            <div><strong>推荐值</strong><span>依据当前部位的功能与加工规则</span></div>
            {surfaceTexture.source === 'process-rule' ? <button
              type="button"
              data-surface-texture-recommended-value={surfaceTexture.value}
              data-selected={textureValue === surfaceTexture.value}
              onClick={() => setTextureValueText(String(surfaceTexture.value))}
            >
              <span>{surfaceTexture.parameter}</span>
              <strong>{surfaceTexture.value}</strong>
              <small>μm</small>
            </button> : <p>当前标注没有可靠的工艺推荐，请从标准值中选择。</p>}
          </div>
          <div className="vai-surface-texture-standard">
            <header><strong>全部标准值</strong><span>GB/T 1031—2009 · μm</span></header>
            {textureStandardValues.length > 0 ? <div className="vai-surface-texture-values">
              {textureStandardValues.map(({ value: item }) => <button
                key={item} type="button"
                data-surface-texture-standard-value={item}
                data-selected={textureValue === item}
                onClick={() => setTextureValueText(String(item))}
              >{item}</button>)}
            </div> : <p className="vai-surface-texture-help">当前参数暂未接入标准数值表，请使用手动输入。</p>}
          </div>
          <label className="vai-surface-texture-manual">手动输入（μm）
            <input type="number" min="0" step="any" value={textureValueText}
              aria-label="自定义粗糙度值" onChange={(event) => setTextureValueText(event.target.value)} />
          </label>
          <p className="vai-surface-texture-help">
            标准表提供可选数值；最终数值仍取决于零件功能、材料和加工工艺。
          </p>
        </section>
      </> : intent !== undefined ? <>
        <label>公差类型
          <select value={characteristic} onChange={(event) => setCharacteristic(event.target.value as typeof characteristic)}>
            {CHARACTERISTICS.map((item) => <option key={item} value={item}>{characteristicLabel(item)}</option>)}
          </select>
        </label>
        <label>公差带
          <select value={zoneShape} onChange={(event) => setZoneShape(event.target.value as typeof zoneShape)}>
            <option value="linear">线性</option><option value="diametrical">直径</option><option value="spherical">球形</option>
          </select>
        </label>
        <label className="vai-gdt-popup__wide">公差值（mm）
          <input data-gdt-value-input={true} type="number" min="0" step="0.001" value={valueText}
            placeholder="请输入公差值" onChange={(event) => setValueText(event.target.value)} />
        </label>
        <section className="vai-gdt-standard vai-gdt-popup__wide" aria-label="GB/T 1184 形位公差选择">
          <header>
            <div><strong>标准注出值</strong><span>GB/T 1184—1996 · 附录 B</span></div>
            {specifiedUsesLength && <label>主参数（mm）
              <input data-gdt-evaluation-length={true} type="number" min="0" step="0.1" value={evaluationLengthText}
                placeholder="请输入尺寸" onChange={(event) => setEvaluationLengthText(event.target.value)} />
            </label>}
          </header>
          {specifiedEntries.length > 0 ? <div className="vai-gdt-specified__cards">
            {specifiedEntries.map((entry) => <button
              key={entry.grade}
              type="button"
              data-gdt-specified-grade={entry.grade}
              data-gdt-specified-value={entry.value}
              data-selected={Number(valueText) === entry.value}
              onClick={() => setValueText(formatNumber(entry.value))}
            >
              <span>{entry.grade} 级</span>
              <strong>{formatNumber(entry.value)}</strong>
              <small>mm</small>
            </button>)}
          </div> : positionValues.length > 0 ? <div className="vai-gdt-specified__cards">
            {positionValues.map((positionValue) => <button
              key={positionValue}
              type="button"
              data-gdt-position-value={positionValue}
              data-selected={Number(valueText) === positionValue}
              onClick={() => setValueText(formatNumber(positionValue))}
            >
              <span>位置度数系</span>
              <strong>{formatNumber(positionValue)}</strong>
              <small>mm</small>
            </button>)}
          </div> : <p className="vai-gdt-standard__empty">{specifiedUsesLength && evaluationLengthText === ''
            ? '输入主参数后显示标准公差等级和数值'
            : '该类型没有可直接套用的附录 B 等级表，请使用规则推荐或手动输入。'}</p>}
          <small className="vai-gdt-standard__note">数值表用于图上明确注出的形位公差；等级越小，精度要求越高。</small>
          {standardEntries.length > 0 && <details className="vai-gdt-general">
            <summary>通用未注公差 H / K / L</summary>
            <div className="vai-gdt-standard__cards">
            {standardEntries.map((entry) => <button
              key={entry.toleranceClass}
              type="button"
              data-gdt-standard-class={entry.toleranceClass}
              data-gdt-standard-value={entry.value}
              data-selected={Number(valueText) === entry.value}
              onClick={() => setValueText(formatNumber(entry.value))}
            >
              <span>{entry.toleranceClass} 级</span>
              <strong>{formatNumber(entry.value)} mm</strong>
              <small>{classLabel(entry.toleranceClass)}</small>
            </button>)}
            </div>
          </details>}
        </section>
        <fieldset className="vai-gdt-popup__wide">
          <legend>基准引用顺序</legend>
          {[0, 1, 2].map((index) => <label key={index}>{String.fromCharCode(65 + index)}
            <select value={datumReferences[index] ?? ''} onChange={(event) => setDatumReferences((current) => {
              const next = [...current]; next[index] = event.target.value; return next;
            })}>
              <option value="">不使用</option>
              {draft.datums.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>)}
        </fieldset>
        <div className="vai-gdt-popup__geometry vai-gdt-popup__wide">
          <span>受控几何</span><code>{controlledGeometryIds.join('、') || '未关联'}</code>
          {selectedGeometryIds.length > 0 && <button type="button" onClick={() => setControlledGeometryIds([...selectedGeometryIds])}>使用画布当前选中图元</button>}
        </div>
      </> : datum !== undefined ? <>
        <label>基准代号
          <input data-datum-name-input={true} value={datumName} maxLength={120} onChange={(event) => setDatumName(event.target.value)} />
        </label>
        <label>基准级别
          <select value={datumRole} onChange={(event) => setDatumRole(event.target.value as typeof datumRole)}>
            <option value="primary">主要基准</option><option value="secondary">次要基准</option>
            <option value="tertiary">第三基准</option><option value="origin">原点基准</option>
          </select>
        </label>
        <div className="vai-gdt-popup__geometry vai-gdt-popup__wide">
          <span>关联几何</span><code>{datumGeometryId || '未关联'}</code>
          {selectedGeometryIds.length > 0 && <button data-use-selected-datum-geometry={true} type="button"
            onClick={() => setDatumGeometryId(selectedGeometryIds[0]!)}>使用画布当前选中图元</button>}
        </div>
      </> : null}
      {invalidValue && <p className="vai-gdt-popup__error vai-gdt-popup__wide" role="alert">请输入大于 0 的公差值</p>}
      {invalidTextureValue && <p className="vai-gdt-popup__error vai-gdt-popup__wide" role="alert">请输入大于 0 的粗糙度值</p>}
      {error && <p className="vai-gdt-popup__error vai-gdt-popup__wide" role="alert">{error}</p>}
    </div>
    <footer className="vai-gdt-popup__footer">
      <button type="button" onClick={onClose}>取消</button>
      <button data-apply-gdt={true} type="button" disabled={busy || invalidValue || invalidTextureValue || (datum !== undefined && (!datumName.trim() || !datumGeometryId))}
        onClick={() => void apply()}>{busy ? '保存中…' : '应用'}</button>
    </footer>
  </section>;
}

function classLabel(value: 'H' | 'K' | 'L'): string {
  return { H: '精密', K: '中等', L: '宽松' }[value];
}

function formatNumber(value: number): string {
  return Number(value.toPrecision(12)).toString();
}

function characteristicLabel(value: typeof CHARACTERISTICS[number]): string {
  return {
    straightness: '直线度', flatness: '平面度', circularity: '圆度', cylindricity: '圆柱度',
    'profile-line': '线轮廓度', 'profile-surface': '面轮廓度', parallelism: '平行度', perpendicularity: '垂直度',
    angularity: '倾斜度', position: '位置度', coaxiality: '同轴度', symmetry: '对称度',
    'circular-runout': '圆跳动', 'total-runout': '全跳动',
  }[value];
}
