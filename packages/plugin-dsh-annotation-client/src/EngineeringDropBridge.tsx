// SPDX-License-Identifier: Apache-2.0
/* eslint-disable react-refresh/only-export-components -- controller and formatter are shared with non-React admission paths */

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { PartitionController } from './partition-controller';
import { classifyEngineeringDrop } from './engineering-drop';

interface DropEventLike {
  dataTransfer: {
    files: ArrayLike<File>;
    items?: ArrayLike<{
      kind: string;
      getAsFile(): File | null;
    }>;
    dropEffect?: string;
  } | null;
  preventDefault(): void;
  stopImmediatePropagation(): void;
}

export interface EngineeringDropEventTarget {
  addEventListener(type: string, listener: (event: DropEventLike) => void, capture?: boolean): void;
  removeEventListener(type: string, listener: (event: DropEventLike) => void, capture?: boolean): void;
}

export interface EngineeringDropBridgeState {
  phase: 'idle' | 'pending' | 'importing' | 'error';
  pendingDocuments: File[];
  code?: string;
  filenames: string[];
}

export interface EngineeringDropBridgeController {
  state: {
    getSnapshot(): EngineeringDropBridgeState;
    subscribe(listener: () => void): () => void;
  };
  actions: {
    handleDrop(event: DropEventLike): Promise<void>;
    attach(target: EngineeringDropEventTarget): () => void;
    clear(): void;
  };
}

export function createEngineeringDropBridgeController(input: {
  importFiles(dxf: File, documents: readonly File[]): Promise<void>;
  refreshClaim(): Promise<void>;
  releaseNativeDragState?(): void;
}): EngineeringDropBridgeController {
  let current: EngineeringDropBridgeState = { phase: 'idle', pendingDocuments: [], filenames: [] };
  const listeners = new Set<() => void>();
  const update = (next: EngineeringDropBridgeState) => {
    current = next;
    for (const listener of listeners) listener();
  };
  const own = (event: DropEventLike) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  };
  const inspect = (event: DropEventLike) => classifyEngineeringDrop(filesFromTransfer(event.dataTransfer));
  const handleDrop = async (event: DropEventLike) => {
    const decision = inspect(event);
    if (decision.kind === 'pass') return;
    own(event);
    input.releaseNativeDragState?.();
    if (decision.kind === 'reject') {
      update({ phase: 'error', pendingDocuments: [], code: decision.code, filenames: decision.filenames });
      return;
    }
    if (decision.kind === 'pending') {
      const combined = classifyEngineeringDrop([...current.pendingDocuments, ...decision.documents]);
      if (combined.kind === 'reject') {
        update({ phase: 'error', pendingDocuments: [], code: combined.code, filenames: combined.filenames });
        return;
      }
      const documents = combined.kind === 'pending' ? combined.documents : decision.documents;
      update({ phase: 'pending', pendingDocuments: [...documents], filenames: documents.map(({ name }) => name) });
      return;
    }
    const combined = classifyEngineeringDrop([decision.dxf, ...current.pendingDocuments, ...decision.documents]);
    if (combined.kind !== 'import') {
      const rejected = combined.kind === 'reject' ? combined : {
        code: 'ENGINEERING_DOCUMENT_FORMAT_UNSUPPORTED', filenames: [],
      };
      update({ phase: 'error', pendingDocuments: [], code: rejected.code, filenames: rejected.filenames });
      return;
    }
    update({ phase: 'importing', pendingDocuments: [], filenames: [combined.dxf.name, ...combined.documents.map(({ name }) => name)] });
    try {
      await input.importFiles(combined.dxf, combined.documents);
      await input.refreshClaim();
      update({ phase: 'idle', pendingDocuments: [], filenames: [] });
    } catch (error) {
      update({
        phase: 'error',
        pendingDocuments: [],
        code: error instanceof Error ? error.message : String(error),
        filenames: [],
      });
    }
  };
  const preview = (event: DropEventLike) => {
    if (inspect(event).kind !== 'pass') own(event);
  };
  return {
    state: {
      getSnapshot: () => current,
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    },
    actions: {
      handleDrop,
      attach(target) {
        const drop = (event: DropEventLike) => { void handleDrop(event); };
        target.addEventListener('dragenter', preview, true);
        target.addEventListener('dragover', preview, true);
        target.addEventListener('drop', drop, true);
        return () => {
          target.removeEventListener('dragenter', preview, true);
          target.removeEventListener('dragover', preview, true);
          target.removeEventListener('drop', drop, true);
          update({ phase: 'idle', pendingDocuments: [], filenames: [] });
        };
      },
      clear: () => update({ phase: 'idle', pendingDocuments: [], filenames: [] }),
    },
  };
}

function filesFromTransfer(dataTransfer: DropEventLike['dataTransfer']): File[] {
  if (dataTransfer === null) return [];
  const droppedFiles = Array.from(dataTransfer.files);
  if (droppedFiles.length > 0 || dataTransfer.items === undefined) return droppedFiles;
  const previewFiles: File[] = [];
  for (const item of Array.from(dataTransfer.items)) {
    if (item.kind !== 'file') continue;
    try {
      const file = item.getAsFile();
      if (file !== null) previewFiles.push(file);
    } catch {
      // Some browser engines protect file contents until drop; leave the event to DSH when metadata is unavailable.
    }
  }
  return previewFiles;
}

export function EngineeringDropBridge({ partition, refreshClaim }: {
  partition: PartitionController;
  refreshClaim(): Promise<void>;
}) {
  const bridge = useMemo(() => createEngineeringDropBridgeController({
    importFiles: partition.actions.importFiles,
    refreshClaim,
    releaseNativeDragState: releaseDshNativeDragState,
  }), [partition, refreshClaim]);
  const state = useSyncExternalStore(bridge.state.subscribe, bridge.state.getSnapshot, bridge.state.getSnapshot);
  useEffect(() => bridge.actions.attach(document as unknown as EngineeringDropEventTarget), [bridge]);
  if (state.phase === 'idle') return null;
  return <div className={`vai-engineering-drop vai-engineering-drop--${state.phase}`} role={state.phase === 'error' ? 'alert' : 'status'}>
    <span>{dropStatusText(state)}</span>
    {(state.phase === 'pending' || state.phase === 'error') && <button type="button" onClick={bridge.actions.clear}>清除</button>}
  </div>;
}

function releaseDshNativeDragState(): void {
  window.dispatchEvent(new Event('dragend'));
}

function dropStatusText(state: EngineeringDropBridgeState): string {
  if (state.phase === 'pending') return `已暂存 ${state.pendingDocuments.length} 份工程资料，拖入 DXF 后开始智能分区`;
  if (state.phase === 'importing') return `正在本地读取并分析：${state.filenames.join('、')}`;
  return engineeringImportErrorText(state.code, state.filenames);
}

export function engineeringImportErrorText(code: string | undefined, filenames: readonly string[] = []): string {
  const names = filenames.length === 0 ? '' : `（${filenames.join('、')}）`;
  if (code?.startsWith('DOCUMENT_PARSE_TIMEOUT')) return `文档本地解析超时${names}`;
  if (code?.startsWith('DOCUMENT_PARSE_FAILED')) return `文档解析失败${names}`;
  if (code?.startsWith('DOCUMENT_TEXT_EMPTY')) return `文档中没有可提取的文字；扫描件暂不支持 OCR${names}`;
  if (code?.startsWith('DOCUMENT_LEGACY_FORMAT_UNSUPPORTED')) return `旧版 DOC/XLS/PPT 暂不支持，请另存为新版 Office、PDF 或文本格式${names}`;
  if (code === 'ENGINEERING_DROP_MULTIPLE_DXF') return `一次只能导入一张 DXF 图纸${names}`;
  if (code?.startsWith('ENGINEERING_DOCUMENT_FORMAT_UNSUPPORTED')) return `包含暂不支持的工程资料格式${names}`;
  if (code === 'ENGINEERING_DOCUMENT_DUPLICATE_NAME') return `工程资料存在重名文件${names}`;
  if (code?.includes('SIZE_LIMIT') || code?.includes('COUNT_LIMIT')) return `工程文件超过本地导入限制${names}`;
  return `工程文件导入失败：${code ?? 'UNKNOWN'}`;
}
