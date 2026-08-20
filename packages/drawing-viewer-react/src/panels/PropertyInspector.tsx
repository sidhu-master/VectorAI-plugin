// SPDX-License-Identifier: Apache-2.0

import type {
  AnnotationNode,
  DrawingRelation,
  GeometryNode,
  SemanticFeature,
  Vec2,
} from '@vectorai/drawing-core';

import { useDrawingWorkspace } from '../hooks';

type DrawingNode = GeometryNode | AnnotationNode | DrawingRelation | SemanticFeature;

interface EditableProperty {
  key: string;
  label: string;
  value: string | number | boolean;
  kind: 'text' | 'number' | 'boolean';
  change(value: string | number | boolean): Record<string, unknown>;
}

export function PropertyInspector() {
  const snapshot = useDrawingWorkspace((state) => state.displaySnapshot);
  const formalSnapshot = useDrawingWorkspace((state) => state.snapshot);
  const preview = useDrawingWorkspace((state) => state.preview);
  const selectedIds = useDrawingWorkspace((state) => state.selectedIds);
  const busy = useDrawingWorkspace((state) => state.busy);
  const updateNode = useDrawingWorkspace((state) => state.updateNode);
  if (snapshot === null) return null;
  const node = locateNode(snapshot.document, selectedIds[0]);

  return (
    <aside className="vai-panel vai-inspector" aria-label="图元属性">
      <div className="vai-panel__title">图元属性</div>
      {node === null ? (
        <div className="vai-panel__empty">选择图元查看和编辑属性</div>
      ) : (
        <div className="vai-inspector__scroll">
          <dl className="vai-inspector__identity">
            <dt>ID</dt><dd>{node.id}</dd>
            <dt>类型</dt><dd>{node.type}</dd>
            <dt>状态</dt><dd>{node.quality.status}</dd>
            <dt>置信度</dt><dd>{node.quality.confidence === undefined ? '—' : `${Math.round(node.quality.confidence * 100)}%`}</dd>
          </dl>
          <div className="vai-inspector__fields">
            {editableProperties(node).map((property) => (
              <PropertyField
                key={property.key}
                property={property}
                disabled={busy || preview !== null || !formalSnapshot?.capabilities.edit}
                commit={(value) => { void updateNode(node.id, property.change(value)); }}
              />
            ))}
          </div>
          <details className="vai-inspector__raw">
            <summary>完整属性</summary>
            <pre>{JSON.stringify(node, null, 2)}</pre>
          </details>
        </div>
      )}
    </aside>
  );
}

function PropertyField({
  property,
  disabled,
  commit,
}: {
  property: EditableProperty;
  disabled: boolean;
  commit(value: string | number | boolean): void;
}) {
  if (property.kind === 'boolean') {
    return (
      <label className="vai-field vai-field--check">
        <span>{property.label}</span>
        <input
          type="checkbox"
          defaultChecked={Boolean(property.value)}
          disabled={disabled}
          onChange={(event) => commit(event.currentTarget.checked)}
        />
      </label>
    );
  }
  return (
    <label className="vai-field">
      <span>{property.label}</span>
      <input
        type={property.kind}
        defaultValue={String(property.value)}
        disabled={disabled}
        step={property.kind === 'number' ? 'any' : undefined}
        onBlur={(event) => {
          const value = property.kind === 'number'
            ? Number(event.currentTarget.value)
            : event.currentTarget.value;
          if (property.kind === 'number' && !Number.isFinite(value)) return;
          if (value !== property.value) commit(value);
        }}
      />
    </label>
  );
}

function editableProperties(node: DrawingNode): EditableProperty[] {
  const fields: EditableProperty[] = [booleanField('visible', '可见', node.visible, 'visible')];
  switch (node.type) {
    case 'point': return [...fields, numberField('x', 'X', node.x, 'x'), numberField('y', 'Y', node.y, 'y')];
    case 'line': return [...fields, ...vec2Fields('start', '起点', node.start), ...vec2Fields('end', '终点', node.end)];
    case 'ray':
    case 'xline': return [...fields, ...vec2Fields('origin', '原点', node.origin), ...vec2Fields('direction', '方向', node.direction)];
    case 'circle': return [...fields, ...vec2Fields('center', '圆心', node.center), numberField('radius', '半径', node.radius, 'radius')];
    case 'arc': return [
      ...fields,
      ...vec2Fields('center', '圆心', node.center),
      numberField('radius', '半径', node.radius, 'radius'),
      numberField('startAngle', '起始角', node.startAngle, 'startAngle'),
      numberField('endAngle', '结束角', node.endAngle, 'endAngle'),
      booleanField('counterClockwise', '逆时针', node.counterClockwise, 'counterClockwise'),
    ];
    case 'ellipse': return [
      ...fields,
      ...vec2Fields('center', '中心', node.center),
      ...vec2Fields('majorAxis', '主轴', node.majorAxis),
      numberField('ratio', '轴比', node.ratio, 'ratio'),
    ];
    case 'polyline': return [...fields, booleanField('closed', '闭合', node.closed, 'closed')];
    case 'spline': return [
      ...fields,
      numberField('degree', '阶数', node.degree, 'degree'),
      booleanField('closed', '闭合', node.closed, 'closed'),
      booleanField('periodic', '周期', node.periodic, 'periodic'),
    ];
    case 'text': return [
      ...fields,
      textField('content', '文字', node.content, 'content'),
      ...vec2Fields('position', '位置', node.position),
      numberField('height', '字高', node.height, 'height'),
      numberField('rotation', '旋转', node.rotation, 'rotation'),
    ];
    case 'dimension': return [
      ...fields,
      textField('displayText', '显示文字', node.displayText ?? '', 'displayText'),
      ...vec2Fields('textPosition', '文字位置', node.textPosition),
      textField('prefix', '前缀', node.prefix ?? '', 'prefix'),
      textField('suffix', '后缀', node.suffix ?? '', 'suffix'),
    ];
    case 'leader': return [
      ...fields,
      textField('content', '文字', node.content, 'content'),
      numberField('textHeight', '字高', node.textHeight, 'textHeight'),
    ];
    case 'centerline': return [...fields, numberField('extension', '延伸', node.extension, 'extension')];
    case 'section-hatch': return [
      ...fields,
      textField('pattern', '图案', node.pattern, 'pattern'),
      numberField('angle', '角度', node.angle, 'angle'),
      numberField('spacing', '间距', node.spacing, 'spacing'),
    ];
    case 'topology':
    case 'constraint':
    case 'association':
    case 'semantic':
    case 'feature': return fields;
  }
}

function vec2Fields(key: string, label: string, value: Vec2): EditableProperty[] {
  return [0, 1].map((index): EditableProperty => ({
    key: `${key}.${index}`,
    label: `${label} ${index === 0 ? 'X' : 'Y'}`,
    value: value[index],
    kind: 'number',
    change: (next) => ({ [key]: value.map((item, itemIndex) => itemIndex === index ? Number(next) : item) }),
  }));
}

function numberField(key: string, label: string, value: number, property: string): EditableProperty {
  return { key, label, value, kind: 'number', change: (next) => ({ [property]: Number(next) }) };
}

function textField(key: string, label: string, value: string, property: string): EditableProperty {
  return { key, label, value, kind: 'text', change: (next) => ({ [property]: String(next) }) };
}

function booleanField(key: string, label: string, value: boolean, property: string): EditableProperty {
  return { key, label, value, kind: 'boolean', change: (next) => ({ [property]: Boolean(next) }) };
}

function locateNode(document: DrawingWorkspaceSnapshot['document'], id: string | undefined): DrawingNode | null {
  if (id === undefined) return null;
  return document.geometry.find((node) => node.id === id)
    ?? document.annotations.find((node) => node.id === id)
    ?? document.relations.find((node) => node.id === id)
    ?? document.features.find((node) => node.id === id)
    ?? null;
}

type DrawingWorkspaceSnapshot = import('@vectorai/drawing-workspace').DrawingWorkspaceSnapshot;
