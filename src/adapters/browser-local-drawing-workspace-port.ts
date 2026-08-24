// SPDX-License-Identifier: Apache-2.0

import {
  createEmptyDrawing,
  type AnnotationNode,
  type DrawingDocument,
} from '@vectorai/drawing-core';
import type {
  DrawingWorkspaceCommand,
  DrawingWorkspaceCommitResult,
  DrawingWorkspacePort,
  DrawingWorkspaceSnapshot,
} from '@vectorai/drawing-workspace';

export const BROWSER_LOCAL_DRAWING_KEY = 'vectorai.preview-workspace.v1';

export interface BrowserLocalDrawingWorkspaceOptions {
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  now?: () => number;
  id?: () => string;
  initialDocument?: DrawingDocument;
}

interface BrowserDrawingEnvelope {
  version: 1;
  revision: number;
  document: DrawingDocument;
  past: DrawingDocument[];
  future: DrawingDocument[];
  lastCommit?: NonNullable<DrawingWorkspaceSnapshot['lastCommit']>;
}

class CommandRejection extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

export function createBrowserLocalDrawingWorkspacePort(
  options: BrowserLocalDrawingWorkspaceOptions = {},
): DrawingWorkspacePort {
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const now = options.now ?? Date.now;
  const id = options.id ?? (() => globalThis.crypto.randomUUID());
  let envelope = readEnvelope(storage) ?? createEnvelope(options.initialDocument, now, id);
  const listeners = new Set<() => void>();

  const persist = (): void => {
    try {
      storage?.setItem(BROWSER_LOCAL_DRAWING_KEY, JSON.stringify(envelope));
    } catch {
      // Browser persistence is best-effort; the in-memory authority stays usable.
    }
  };

  const publish = (next: BrowserDrawingEnvelope): DrawingWorkspaceSnapshot => {
    envelope = next;
    persist();
    for (const listener of listeners) listener();
    return snapshotOf(envelope);
  };

  return {
    async load(signal) {
      signal?.throwIfAborted();
      persist();
      return snapshotOf(envelope);
    },

    async commit(request, signal): Promise<DrawingWorkspaceCommitResult> {
      signal?.throwIfAborted();
      if (request.expectedRevision !== envelope.revision) {
        return {
          status: 'conflict',
          message: '本地图纸版本已变化',
          snapshot: snapshotOf(envelope),
        };
      }
      if (request.commands.length === 0) {
        return { status: 'rejected', code: 'EMPTY_COMMAND_BATCH', message: '没有可提交的图纸命令' };
      }
      try {
        const document = applyCommands(envelope.document, request.commands, now());
        const revision = envelope.revision + 1;
        const commitId = `browser-commit-${revision}`;
        return {
          status: 'committed',
          snapshot: publish({
            version: 1,
            revision,
            document,
            past: [...envelope.past, structuredClone(envelope.document)],
            future: [],
            lastCommit: {
              commitId,
              mode: 'interactive',
              undoable: true,
              redoable: false,
            },
          }),
        };
      } catch (error) {
        if (error instanceof CommandRejection) {
          return { status: 'rejected', code: error.code, message: error.message };
        }
        throw error;
      }
    },

    async undoLast(snapshot, signal) {
      signal?.throwIfAborted();
      const conflict = revisionConflict(snapshot, envelope);
      if (conflict) return conflict;
      const document = envelope.past.at(-1);
      if (!document) return { status: 'rejected', code: 'UNDO_UNAVAILABLE', message: '没有可撤销的修改' };
      const revision = envelope.revision + 1;
      const past = envelope.past.slice(0, -1);
      return {
        status: 'committed',
        snapshot: publish({
          version: 1,
          revision,
          document: structuredClone(document),
          past,
          future: [...envelope.future, structuredClone(envelope.document)],
          lastCommit: {
            commitId: `browser-undo-${revision}`,
            mode: 'undo',
            undoable: past.length > 0,
            redoable: true,
          },
        }),
      };
    },

    async redoLast(snapshot, signal) {
      signal?.throwIfAborted();
      const conflict = revisionConflict(snapshot, envelope);
      if (conflict) return conflict;
      const document = envelope.future.at(-1);
      if (!document) return { status: 'rejected', code: 'REDO_UNAVAILABLE', message: '没有可重做的修改' };
      const revision = envelope.revision + 1;
      const future = envelope.future.slice(0, -1);
      return {
        status: 'committed',
        snapshot: publish({
          version: 1,
          revision,
          document: structuredClone(document),
          past: [...envelope.past, structuredClone(envelope.document)],
          future,
          lastCommit: {
            commitId: `browser-redo-${revision}`,
            mode: 'redo',
            undoable: true,
            redoable: future.length > 0,
          },
        }),
      };
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function applyCommands(
  source: DrawingDocument,
  commands: readonly DrawingWorkspaceCommand[],
  timestamp: number,
): DrawingDocument {
  const document = structuredClone(source);
  for (const command of commands) applyCommand(document, command);
  document.metadata.updatedAt = timestamp;
  return document;
}

function applyCommand(document: DrawingDocument, command: DrawingWorkspaceCommand): void {
  if (command.type === 'node.create') {
    if (findNode(document, command.node.id) !== null) {
      throw new CommandRejection('DUPLICATE_NODE_ID', `节点 ${command.node.id} 已存在`);
    }
    if (command.plane === 'geometry') document.geometry.push(structuredClone(command.node));
    if (command.plane === 'annotation') document.annotations.push(structuredClone(command.node));
    if (command.plane === 'relation') document.relations.push(structuredClone(command.node));
    if (command.plane === 'feature') document.features.push(structuredClone(command.node));
    return;
  }

  const found = findNode(document, command.id);
  if (found === null) throw new CommandRejection('NODE_NOT_FOUND', `节点 ${command.id} 不存在`);

  if (command.type === 'node.delete') {
    found.collection.splice(found.index, 1);
    return;
  }

  if (command.type === 'annotation.move-text') {
    const annotation = found.node as AnnotationNode;
    const current = annotationTextPosition(annotation);
    if (current === null) {
      throw new CommandRejection('ANNOTATION_TEXT_UNAVAILABLE', `标注 ${command.id} 没有可移动文字位置`);
    }
    assertExpected('position', current, command.expectedPosition);
    if (annotation.type === 'text') annotation.position = structuredClone(command.position);
    else if (annotation.type === 'dimension') annotation.textPosition = structuredClone(command.position);
    return;
  }

  const changes = Object.entries(command.changes);
  if (changes.length === 0) throw new CommandRejection('EMPTY_NODE_UPDATE', `节点 ${command.id} 没有更新字段`);
  for (const field of ['id', 'type', 'plane']) {
    if (field in command.changes) {
      throw new CommandRejection('IMMUTABLE_NODE_FIELD', `字段 ${field} 不可修改`);
    }
  }
  const record = found.node as unknown as Record<string, unknown>;
  for (const [field, expected] of Object.entries(command.expected)) {
    assertExpected(field, record[field], expected);
  }
  for (const [field, value] of changes) record[field] = structuredClone(value);
}

function findNode(document: DrawingDocument, id: string): {
  node: object;
  collection: object[];
  index: number;
} | null {
  const collections: object[][] = [
    document.geometry,
    document.annotations,
    document.relations,
    document.features,
  ];
  for (const collection of collections) {
    const index = collection.findIndex((node) => (node as { id?: unknown }).id === id);
    if (index >= 0) return { node: collection[index], collection, index };
  }
  return null;
}

function assertExpected(field: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new CommandRejection('EXPECTED_VALUE_MISMATCH', `字段 ${field} 已被其他修改更新`);
  }
}

function annotationTextPosition(annotation: AnnotationNode): readonly [number, number] | null {
  if (annotation.type === 'text') return annotation.position;
  if (annotation.type === 'dimension') return annotation.textPosition;
  return null;
}

function snapshotOf(envelope: BrowserDrawingEnvelope): DrawingWorkspaceSnapshot {
  return {
    version: 1,
    ref: { drawingId: envelope.document.id, revision: envelope.revision },
    document: structuredClone(envelope.document),
    capabilities: {
      edit: true,
      delete: true,
      annotations: true,
      sourceUnderlay: false,
    },
    ...(envelope.lastCommit ? { lastCommit: structuredClone(envelope.lastCommit) } : {}),
  };
}

function revisionConflict(
  snapshot: DrawingWorkspaceSnapshot,
  envelope: BrowserDrawingEnvelope,
): DrawingWorkspaceCommitResult | null {
  if (
    snapshot.ref.drawingId === envelope.document.id
    && snapshot.ref.revision === envelope.revision
  ) return null;
  return {
    status: 'conflict',
    message: '本地图纸版本已变化',
    snapshot: snapshotOf(envelope),
  };
}

function createEnvelope(
  initialDocument: DrawingDocument | undefined,
  now: () => number,
  id: () => string,
): BrowserDrawingEnvelope {
  const document = initialDocument === undefined
    ? createEmptyDrawing({
      idFactory: { next: () => id() },
      now,
    })
    : structuredClone(initialDocument);
  return { version: 1, revision: 1, document, past: [], future: [] };
}

function readEnvelope(
  storage: Pick<Storage, 'getItem'> | null,
): BrowserDrawingEnvelope | null {
  try {
    const raw = storage?.getItem(BROWSER_LOCAL_DRAWING_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<BrowserDrawingEnvelope>;
    if (
      value.version !== 1
      || !Number.isInteger(value.revision)
      || (value.revision ?? 0) < 1
      || !isDrawingDocument(value.document)
      || !Array.isArray(value.past)
      || !value.past.every(isDrawingDocument)
      || !Array.isArray(value.future)
      || !value.future.every(isDrawingDocument)
    ) return null;
    return structuredClone(value) as BrowserDrawingEnvelope;
  } catch {
    return null;
  }
}

function isDrawingDocument(value: unknown): value is DrawingDocument {
  if (typeof value !== 'object' || value === null) return false;
  const document = value as Partial<DrawingDocument>;
  return document.protocol === 'VectorAI-Drawing'
    && document.schemaVersion === '1.0'
    && typeof document.id === 'string'
    && Array.isArray(document.geometry)
    && Array.isArray(document.annotations)
    && Array.isArray(document.relations)
    && Array.isArray(document.features)
    && Array.isArray(document.coordinateFrames);
}

function browserStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
