// SPDX-License-Identifier: Apache-2.0

import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import { DRAWING_SURFACE_REFRESH_EVENT, type DrawingSurfaceObservable, type DrawingSurfaceRefreshDetail } from '@vectorai/drawing-surface-api';
import type { DrawingRef, EngineeringDocumentInput, PartitionDocumentSupplementRequest, PartitionEditCommand, PartitionImportRequest, PartitionSessionSnapshot } from '@vectorai/plugin-space-contracts';
import { ENGINEERING_IMPORT_LIMITS, validateEngineeringDocumentFiles } from './engineering-file-policy';

export interface PartitionRemote {
  importDrawing(sessionId: string, request: PartitionImportRequest['dxf']): Promise<RemoteResult<PartitionSessionSnapshot>>;
  importAndAnalyze(sessionId: string, request: PartitionImportRequest): Promise<RemoteResult<PartitionSessionSnapshot>>;
  supplementDocuments(sessionId: string, request: PartitionDocumentSupplementRequest): Promise<RemoteResult<PartitionSessionSnapshot>>;
  getPartitionState(sessionId: string): Promise<RemoteResult<PartitionSessionSnapshot>>;
  editPartition(sessionId: string, command: PartitionEditCommand): Promise<RemoteResult<PartitionSessionSnapshot>>;
  confirmPartition(sessionId: string, expected: DrawingRef): Promise<RemoteResult<PartitionSessionSnapshot>>;
  cancelPartition(sessionId: string, expected: DrawingRef): Promise<RemoteResult<PartitionSessionSnapshot>>;
  reopenPartition(sessionId: string, expected: DrawingRef): Promise<RemoteResult<PartitionSessionSnapshot>>;
  undoPartition(sessionId: string, expected: DrawingRef): Promise<RemoteResult<PartitionSessionSnapshot>>;
  redoPartition(sessionId: string, expected: DrawingRef): Promise<RemoteResult<PartitionSessionSnapshot>>;
}

export interface PartitionControllerState { partition: PartitionSessionSnapshot; busy: boolean; previewHeld: boolean; error: string | null }
type PartitionEditWithoutRef = PartitionEditCommand extends infer Command
  ? Command extends PartitionEditCommand ? Omit<Command, 'expectedDrawingRef'> : never
  : never;
export interface PartitionController {
  state: DrawingSurfaceObservable<PartitionControllerState>;
  actions: {
    refresh(): Promise<void>;
    importDrawing(dxf: File): Promise<void>;
    importFiles(dxf: File, engineeringDocuments?: readonly File[]): Promise<void>;
    supplementDocuments(engineeringDocuments: readonly File[]): Promise<void>;
    moveBoundary(boundaryIndex: number, requestedZ: number, snapTolerance: number): Promise<void>;
    moveSemanticRange(groupId: string, edge: 'start' | 'end', requestedZ: number, snapTolerance: number): Promise<void>;
    splitSegment(segmentId: string, z: number, snapTolerance: number): Promise<void>;
    mergeBoundary(boundaryIndex: number): Promise<void>;
    updateSegment(segmentId: string, value: { name?: string; semanticType?: string }): Promise<void>;
    confirm(): Promise<void>; cancel(): Promise<void>; reopen(): Promise<void>; undo(): Promise<void>; redo(): Promise<void>;
    setPreviewHeld(value: boolean): void;
  };
  dispose(): void;
}

export function createPartitionController(sessionId: string, remote: PartitionRemote): PartitionController {
  let current: PartitionControllerState = { partition: { version: 1, phase: 'idle', canUndo: false, canRedo: false, updatedAt: 0 }, busy: false, previewHeld: false, error: null };
  const listeners = new Set<() => void>();
  let queue = Promise.resolve();
  let disposed = false;
  const update = (changes: Partial<PartitionControllerState>) => {
    if (disposed) return;
    current = { ...current, ...changes };
    for (const listener of listeners) listener();
  };
  const run = (
    operation: () => Promise<RemoteResult<PartitionSessionSnapshot>>,
    pendingPartition?: PartitionSessionSnapshot,
  ) => {
    const task = queue.then(async () => {
      update({
        busy: true,
        error: null,
        ...(pendingPartition === undefined ? {} : { partition: pendingPartition }),
      });
      try { update({ partition: unwrap(await operation()) }); }
      catch (error) { update({ error: error instanceof Error ? error.message : String(error) }); throw error; }
      finally { update({ busy: false }); }
    });
    queue = task.catch(() => undefined);
    return task;
  };
  const ref = () => {
    if (!current.partition.drawingRef) throw new Error('PARTITION_DRAWING_REQUIRED');
    return current.partition.drawingRef;
  };
  const edit = (command: PartitionEditWithoutRef) => run(() => remote.editPartition(sessionId, { ...command, expectedDrawingRef: ref() } as PartitionEditCommand));
  return {
    state: {
      getSnapshot: () => current,
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    },
    actions: {
      refresh: () => run(() => remote.getPartitionState(sessionId)),
      async importDrawing(dxf) {
        const request = await serializeDxf(dxf);
        await run(() => remote.importDrawing(sessionId, request));
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<DrawingSurfaceRefreshDetail>(
          DRAWING_SURFACE_REFRESH_EVENT, { detail: { sessionId } },
        ));
      },
      async importFiles(dxf, engineeringDocuments = []) {
        const dxfRequest = await serializeDxf(dxf);
        const documents = await serializeEngineeringDocuments(engineeringDocuments);
        const request: PartitionImportRequest = {
          dxf: dxfRequest,
          engineeringDocuments: documents,
        };
        await run(() => remote.importAndAnalyze(sessionId, request), {
          version: 1,
          phase: 'analyzing',
          canUndo: false,
          canRedo: false,
          updatedAt: Date.now(),
        });
      },
      async supplementDocuments(engineeringDocuments) {
        if (engineeringDocuments.length === 0) throw new Error('ENGINEERING_DOCUMENT_REQUIRED');
        const request: PartitionDocumentSupplementRequest = {
          expectedDrawingRef: ref(),
          engineeringDocuments: await serializeEngineeringDocuments(engineeringDocuments),
        };
        await run(() => remote.supplementDocuments(sessionId, request));
      },
      moveBoundary: (boundaryIndex, requestedZ, snapTolerance) => edit({ type: 'boundary.move', boundaryIndex, requestedZ, snapTolerance }),
      moveSemanticRange: (groupId, edge, requestedZ, snapTolerance) => edit({ type: 'semantic-range.move', groupId, edge, requestedZ, snapTolerance }),
      splitSegment: (segmentId, z, snapTolerance) => edit({ type: 'segment.split', segmentId, z, snapTolerance }),
      mergeBoundary: (boundaryIndex) => edit({ type: 'boundary.merge', boundaryIndex }),
      updateSegment: (segmentId, value) => edit({ type: 'segment.metadata', segmentId, ...value }),
      confirm: () => run(() => remote.confirmPartition(sessionId, ref())),
      cancel: () => run(() => remote.cancelPartition(sessionId, ref())),
      reopen: () => run(() => remote.reopenPartition(sessionId, ref())),
      undo: () => run(() => remote.undoPartition(sessionId, ref())),
      redo: () => run(() => remote.redoPartition(sessionId, ref())),
      setPreviewHeld: (previewHeld) => update({ previewHeld }),
    },
    dispose() { disposed = true; listeners.clear(); },
  };
}

function unwrap(result: RemoteResult<PartitionSessionSnapshot>): PartitionSessionSnapshot {
  if (result.ok !== true) throw new Error(result.error.message);
  return structuredClone(result.value);
}
function hex(value: ArrayBuffer): string { return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, '0')).join(''); }
function base64(bytes: Uint8Array): string {
  let binary = '';
  const size = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += size) binary += String.fromCharCode(...bytes.subarray(offset, offset + size));
  return btoa(binary);
}

async function serializeDxf(dxf: File): Promise<PartitionImportRequest['dxf']> {
  if (dxf.size > ENGINEERING_IMPORT_LIMITS.maxDxfBytes) throw new Error('DXF_SIZE_LIMIT');
  const bytes = new Uint8Array(await dxf.arrayBuffer());
  return { name: dxf.name, digest: `sha256:${hex(await crypto.subtle.digest('SHA-256', bytes))}`, base64: base64(bytes) };
}

async function serializeEngineeringDocuments(files: readonly File[]): Promise<EngineeringDocumentInput[]> {
  validateEngineeringDocumentFiles(files);
  return Promise.all(files.map(async (file) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return {
      name: file.name,
      digest: `sha256:${hex(await crypto.subtle.digest('SHA-256', bytes))}`,
      ...(file.type === '' ? {} : { mediaType: file.type }),
      base64: base64(bytes),
    };
  }));
}
