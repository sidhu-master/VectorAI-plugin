// SPDX-License-Identifier: Apache-2.0

import { Layers3, SlidersHorizontal, X, type LucideIcon } from 'lucide-react';
import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

import { ObjectList } from './ObjectList';
import { PropertyInspector } from './PropertyInspector';

export type WorkspacePanelId = 'objects' | 'properties';

export interface WorkspacePanelDefinition<PanelId extends string = string> {
  readonly id: PanelId;
  readonly label: string;
  readonly icon: LucideIcon;
  render(): ReactNode;
}

export interface WorkspaceActivityBarProps<PanelId extends string = WorkspacePanelId> {
  activePanel: PanelId | null;
  panelWidth: number;
  onActivePanelChange(panel: PanelId | null): void;
  onPanelWidthChange(width: number): void;
  panels?: readonly WorkspacePanelDefinition<PanelId>[];
  overlay?: boolean;
}

const MIN_PANEL_WIDTH = 220;
const MAX_PANEL_WIDTH = 420;
const PANEL_RESIZE_STEP = 16;

const defaultPanelDefinitions: readonly WorkspacePanelDefinition<WorkspacePanelId>[] = [
  { id: 'objects', label: '对象', icon: Layers3, render: () => <ObjectList /> },
  { id: 'properties', label: '属性', icon: SlidersHorizontal, render: () => <PropertyInspector /> },
];

export function WorkspaceActivityBar<PanelId extends string = WorkspacePanelId>({
  activePanel,
  panelWidth,
  onActivePanelChange,
  onPanelWidthChange,
  panels,
  overlay = false,
}: WorkspaceActivityBarProps<PanelId>) {
  const resizeStart = useRef<{ pointerId: number; clientX: number; width: number } | null>(null);
  const latestWidth = useRef(panelWidth);
  latestWidth.current = panelWidth;

  const definitions = (panels ?? defaultPanelDefinitions) as readonly WorkspacePanelDefinition<PanelId>[];
  const activeDefinition = definitions.find(({ id }) => id === activePanel);

  function commitWidth(width: number) {
    const nextWidth = clampPanelWidth(width);
    latestWidth.current = nextWidth;
    onPanelWidthChange(nextWidth);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeStart.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      width: latestWidth.current,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = resizeStart.current;
    if (start === null || start.pointerId !== event.pointerId) return;
    commitWidth(start.width + event.clientX - start.clientX);
  }

  function finishPointerResize(event: PointerEvent<HTMLDivElement>) {
    if (resizeStart.current?.pointerId === event.pointerId) resizeStart.current = null;
  }

  function handleResizeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const delta = event.key === 'ArrowLeft'
      ? -PANEL_RESIZE_STEP
      : event.key === 'ArrowRight'
        ? PANEL_RESIZE_STEP
        : 0;
    if (delta !== 0) {
      event.preventDefault();
      commitWidth(latestWidth.current + delta);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      commitWidth(event.key === 'Home' ? MIN_PANEL_WIDTH : MAX_PANEL_WIDTH);
    }
  }

  return (
    <>
      <nav className={`vai-activity-bar${overlay ? ' vai-activity-bar--overlay' : ''}`} aria-label="信息面板工具栏">
        {definitions.map(({ id, label, icon: Icon }) => {
          const active = activePanel === id;
          return (
            <button
              key={id}
              type="button"
              className="vai-activity-bar__button"
              aria-label={`${label}面板`}
              aria-pressed={active}
              title={label}
              onClick={() => onActivePanelChange(active ? null : id)}
            >
              <Icon size={19} strokeWidth={1.75} aria-hidden="true" />
            </button>
          );
        })}
      </nav>
      {activeDefinition === undefined ? null : (
        <aside
          className={`vai-inspector-stack vai-inspector-stack--activity${overlay ? ' vai-inspector-stack--overlay' : ''}`}
          data-panel={activeDefinition.id}
          aria-label={`${activeDefinition.label}信息面板`}
          style={{ width: panelWidth, backgroundColor: 'var(--vai-panel, #12161b)' }}
        >
          <button
            type="button"
            className="vai-panel-close"
            aria-label="关闭信息面板"
            title="关闭"
            onClick={() => onActivePanelChange(null)}
          >
            <X size={16} aria-hidden="true" />
          </button>
          {activeDefinition.render()}
          <div
            className="vai-panel-resizer"
            role="separator"
            aria-label="调整信息面板宽度"
            aria-orientation="vertical"
            aria-valuemin={MIN_PANEL_WIDTH}
            aria-valuemax={MAX_PANEL_WIDTH}
            aria-valuenow={panelWidth}
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishPointerResize}
            onPointerCancel={finishPointerResize}
            onKeyDown={handleResizeKeyDown}
          />
        </aside>
      )}
    </>
  );
}

function clampPanelWidth(width: number): number {
  return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, width));
}
