// SPDX-License-Identifier: Apache-2.0

import type {
  AnnotationNode,
  DrawingRelation,
  GeometryNode,
  SemanticFeature,
} from '@vectorai/drawing-core';

import { useDrawingWorkspace } from '../hooks';

type DrawingNode = GeometryNode | AnnotationNode | DrawingRelation | SemanticFeature;

export function ObjectList() {
  const snapshot = useDrawingWorkspace((state) => state.displaySnapshot);
  const formalSnapshot = useDrawingWorkspace((state) => state.snapshot);
  const preview = useDrawingWorkspace((state) => state.preview);
  const groundingOverlay = useDrawingWorkspace((state) => state.groundingOverlay);
  const selectedIds = useDrawingWorkspace((state) => state.selectedIds);
  const busy = useDrawingWorkspace((state) => state.busy);
  const setSelection = useDrawingWorkspace((state) => state.setSelection);
  const updateNode = useDrawingWorkspace((state) => state.updateNode);
  const deleteNodes = useDrawingWorkspace((state) => state.deleteNodes);
  if (snapshot === null) return null;

  const groups: Array<{ label: string; nodes: DrawingNode[] }> = [
    { label: '几何图元', nodes: snapshot.document.geometry },
    { label: '标注', nodes: snapshot.document.annotations },
    { label: '关系', nodes: snapshot.document.relations },
    { label: '语义特征', nodes: snapshot.document.features },
  ];
  const groundedNodeIds = new Set(
    groundingOverlay?.groups.flatMap((group) => group.nodeIds) ?? [],
  );

  return (
    <aside className="vai-panel vai-object-list" aria-label="图纸对象">
      <div className="vai-panel__title">对象</div>
      <div className="vai-object-list__scroll">
        {groups.map((group) => (
          <section key={group.label} className="vai-object-group">
            <h3>{group.label}<span>{group.nodes.length}</span></h3>
            {group.nodes.length === 0 ? <div className="vai-object-group__empty">无</div> : group.nodes.map((node) => {
              return (
              <div
                key={node.id}
                className={`vai-object-row${selectedIds.includes(node.id) || groundedNodeIds.has(node.id) ? ' vai-object-row--selected' : ''}`}
                data-object-id={node.id}
              >
                <button
                  type="button"
                  className="vai-object-row__main"
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey) {
                      setSelection(selectedIds.includes(node.id)
                        ? selectedIds.filter((id) => id !== node.id)
                        : [...selectedIds, node.id]);
                    } else setSelection([node.id]);
                  }}
                >
                  <ObjectGlyph type={node.type} />
                  <span className="vai-object-row__identity"><strong>{node.id}</strong><small>{node.type}</small></span>
                </button>
                <button
                  type="button"
                  className="vai-icon-button"
                  aria-label={`${node.visible ? '隐藏' : '显示'} ${node.id}`}
                  disabled={busy || preview !== null || !formalSnapshot?.capabilities.edit}
                  onClick={() => { void updateNode(node.id, { visible: !node.visible }); }}
                >
                  {node.visible ? '◉' : '○'}
                </button>
                <button
                  type="button"
                  className="vai-icon-button vai-icon-button--danger"
                  aria-label={`删除 ${node.id}`}
                  disabled={busy || preview !== null || !formalSnapshot?.capabilities.delete}
                  onClick={() => { void deleteNodes([node.id]); }}
                >
                  ×
                </button>
              </div>
              );
            })}
          </section>
        ))}
      </div>
    </aside>
  );
}

function ObjectGlyph({ type }: { type: string }) {
  const glyph = type === 'circle' ? '○'
    : type === 'point' ? '·'
      : type === 'text' ? 'T'
        : type === 'dimension' ? '↔'
          : type === 'feature' ? '◇'
            : type === 'topology' || type === 'constraint' || type === 'association' || type === 'semantic' ? '⌁'
              : '∕';
  return <span className="vai-object-row__glyph" aria-hidden="true">{glyph}</span>;
}
