// SPDX-License-Identifier: Apache-2.0

import {
  createEmptyDrawing,
  type AnnotationId,
  type DrawingDocument,
  type GeometryId,
} from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import {
  createDrawingWorkspaceStore,
  type DrawingWorkspaceCommitRequest,
  type DrawingWorkspaceCommitResult,
  type DrawingWorkspacePort,
  type DrawingWorkspacePreview,
  type DrawingWorkspaceSnapshot,
  type DrawingGroundingOverlay,
  type DrawingMotionRigProjection,
  type DrawingMotionRigResult,
} from './index';

function drawing(id: string, geometryIds: string[] = []): DrawingDocument {
  const document = createEmptyDrawing({
    idFactory: { next: () => id },
    now: () => 1,
  });
  document.geometry = geometryIds.map((geometryId, index) => ({
    id: geometryId as GeometryId,
    type: 'line' as const,
    start: [index, index] as const,
    end: [index + 1, index + 1] as const,
    visible: true,
    quality: { status: 'confirmed' as const, evidenceRefs: [] },
  }));
  return document;
}

function snapshot(
  revision: number,
  geometryIds: string[] = ['line-1'],
): DrawingWorkspaceSnapshot {
  return {
    version: 1,
    ref: { drawingId: 'drawing-1', revision },
    document: drawing('drawing-1', geometryIds),
    capabilities: {
      edit: true,
      delete: true,
      annotations: true,
      sourceUnderlay: true,
    },
  };
}

class TestPort implements DrawingWorkspacePort {
  current: DrawingWorkspaceSnapshot | null;
  preview: DrawingWorkspacePreview | null = null;
  groundingOverlay: DrawingGroundingOverlay | null = null;
  motionRig: DrawingMotionRigProjection | null = null;
  commits: DrawingWorkspaceCommitRequest[] = [];
  rebuilds: Array<{ ref: DrawingWorkspaceSnapshot['ref']; nodeIds: string[] }> = [];
  discards: DrawingWorkspaceSnapshot['ref'][] = [];
  listeners = new Set<() => void>();
  loadSource?: DrawingWorkspacePort['loadSource'];
  undoLast?: DrawingWorkspacePort['undoLast'];
  projectSelection?: DrawingWorkspacePort['projectSelection'];
  redoLast?: DrawingWorkspacePort['redoLast'];

  constructor(current: DrawingWorkspaceSnapshot | null) {
    this.current = current;
  }

  async load(): Promise<DrawingWorkspaceSnapshot | null> {
    return this.current === null ? null : structuredClone(this.current);
  }

  async loadPreview(): Promise<DrawingWorkspacePreview | null> {
    return this.preview === null ? null : structuredClone(this.preview);
  }

  async loadGroundingOverlay(): Promise<DrawingGroundingOverlay | null> {
    return this.groundingOverlay === null ? null : structuredClone(this.groundingOverlay);
  }

  async loadMotionRig(): Promise<DrawingMotionRigProjection | null> {
    return this.motionRig === null ? null : structuredClone(this.motionRig);
  }

  async rebuildMotionRig(ref: DrawingWorkspaceSnapshot['ref'], nodeIds: string[]): Promise<DrawingMotionRigResult> {
    this.rebuilds.push({ ref: structuredClone(ref), nodeIds: [...nodeIds] });
    return this.motionRig === null
      ? { status: 'rejected', code: 'MOTION_RIG_INVALID', message: 'No valid rig.' }
      : { status: 'ready', projection: structuredClone(this.motionRig) };
  }

  async discardMotionRig(ref: DrawingWorkspaceSnapshot['ref']) {
    this.discards.push(structuredClone(ref));
    this.motionRig = null;
    return { status: 'discarded' as const };
  }

  async commit(request: DrawingWorkspaceCommitRequest): Promise<DrawingWorkspaceCommitResult> {
    this.commits.push(structuredClone(request));
    if (this.current === null || request.expectedRevision !== this.current.ref.revision) {
      return {
        status: 'conflict',
        message: 'drawing revision changed',
        snapshot: this.current === null ? undefined : structuredClone(this.current),
      };
    }
    this.current = {
      ...this.current,
      ref: { ...this.current.ref, revision: this.current.ref.revision + 1 },
    };
    return { status: 'committed', snapshot: structuredClone(this.current) };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(): void {
    for (const listener of this.listeners) listener();
  }
}

function motionSnapshot(revision = 1): DrawingWorkspaceSnapshot {
  const value = snapshot(revision, []);
  value.document.geometry = [
    {
      id: 'hand' as GeometryId, type: 'circle', center: [20, 20], radius: 3,
      visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
    },
    {
      id: 'arm' as GeometryId, type: 'line', start: [0, 20], end: [17, 20],
      visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
    },
  ];
  return value;
}

function motionRig(revision = 1): DrawingMotionRigProjection {
  return {
    version: 1,
    drawingRef: { drawingId: 'drawing-1', revision },
    state: 'ready',
    controlBodyNodeIds: ['hand'],
    connectors: [{ nodeId: 'arm', movingEndpoint: 'end', fixedPoint: [0, 20] }],
    anchor: [0, 20],
    handle: [20, 20],
    keepAnchorFixed: true,
    keepControlBodyRigid: true,
    preserveConnectivity: true,
    allowControlRotation: false,
  };
}

function snapshotWithText(revision = 1): DrawingWorkspaceSnapshot {
  const value = snapshot(revision);
  value.document.annotations = [{
    id: 'text-1' as AnnotationId,
    type: 'text',
    content: 'A',
    position: [2, 3],
    height: 4,
    rotation: 0,
    alignment: 'left',
    verticalAlignment: 'baseline',
    visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
  }];
  return value;
}

describe('createDrawingWorkspaceStore', () => {
  it('solves handle movement locally, previews it, and commits one interactive command batch', async () => {
    const port = new TestPort(motionSnapshot());
    port.motionRig = motionRig();
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();

    store.getState().beginMotionRigDrag([20, 20]);
    store.getState().updateMotionRigDrag([30, 25]);

    expect(port.commits).toEqual([]);
    expect(store.getState().motionRig?.phase).toBe('dragging');
    expect(store.getState().displaySnapshot?.document.geometry).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'hand', center: [30, 25] }),
      expect.objectContaining({ id: 'arm', start: [0, 20], end: [27, 25] }),
    ]));

    store.getState().finishMotionRigDrag();
    expect(store.getState().motionRig?.phase).toBe('preview');
    expect(await store.getState().confirmMotionRig()).toBe(true);
    expect(port.commits).toHaveLength(1);
    expect(port.commits[0]?.commands).toHaveLength(2);
    expect(port.discards).toEqual([{ drawingId: 'drawing-1', revision: 2 }]);
    expect(store.getState().motionRig).toBeNull();
  });

  it('rebuilds the complete Host rig from the current direct selection', async () => {
    const port = new TestPort(motionSnapshot());
    port.motionRig = motionRig();
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();
    store.getState().setSelection(['hand']);

    expect(await store.getState().rebuildMotionRigFromSelection()).toBe(true);
    expect(port.rebuilds).toEqual([{
      ref: { drawingId: 'drawing-1', revision: 1 }, nodeIds: ['hand'],
    }]);
    expect(store.getState().motionRig?.projection.controlBodyNodeIds).toEqual(['hand']);
  });

  it('cancels a local rig candidate without committing geometry', async () => {
    const port = new TestPort(motionSnapshot());
    port.motionRig = motionRig();
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();
    store.getState().beginMotionRigDrag([20, 20]);
    store.getState().updateMotionRigDrag([25, 22]);
    store.getState().finishMotionRigDrag();

    await store.getState().cancelMotionRig();

    expect(port.commits).toEqual([]);
    expect(port.discards).toEqual([{ drawingId: 'drawing-1', revision: 1 }]);
    expect(store.getState().displaySnapshot).toEqual(store.getState().snapshot);
    expect(store.getState().motionRig).toBeNull();
  });

  it('drops a stale motion rig on authoritative revision refresh', async () => {
    const port = new TestPort(motionSnapshot());
    port.motionRig = motionRig();
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();
    port.current = motionSnapshot(2);
    port.motionRig = motionRig(1);

    await store.getState().refresh();

    expect(store.getState().motionRig).toBeNull();
    expect(store.getState().snapshot?.ref.revision).toBe(2);
  });

  it('loads a matching Grounding Overlay without changing local Selection', async () => {
    const port = new TestPort(snapshot(1, ['carrier-a', 'carrier-b']));
    port.groundingOverlay = {
      version: 1,
      drawingRef: { drawingId: 'drawing-1', revision: 1 },
      taskId: 'task-1',
      stateEpoch: 1,
      disposition: 'active',
      groups: [{
        groundingId: 'ground-a', partKey: 'part-a', label: 'Part A', colorIndex: 0,
        nodeIds: ['carrier-a'], interfaces: [],
      }],
    };
    const store = createDrawingWorkspaceStore({ port });

    await store.getState().load();

    expect(store.getState().groundingOverlay).toEqual(port.groundingOverlay);
    expect(store.getState().selectedIds).toEqual([]);
    expect(store.getState().selectionProjection).toBeNull();
  });

  it('drops a stale Grounding Overlay when the formal Drawing revision changes', async () => {
    const port = new TestPort(snapshot(1, ['carrier-a']));
    port.groundingOverlay = {
      version: 1,
      drawingRef: { drawingId: 'drawing-1', revision: 1 },
      taskId: 'task-1',
      stateEpoch: 1,
      disposition: 'active',
      groups: [{
        groundingId: 'ground-a', partKey: 'part-a', label: 'Part A', colorIndex: 0,
        nodeIds: ['carrier-a'], interfaces: [],
      }],
    };
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();
    port.current = snapshot(2, ['carrier-a']);

    await store.getState().refresh();

    expect(store.getState().snapshot?.ref.revision).toBe(2);
    expect(store.getState().groundingOverlay).toBeNull();
  });

  it('ignores an older AI-selection epoch for the same semantic task', async () => {
    const port = new TestPort(snapshot(1, ['carrier-a', 'carrier-b']));
    port.groundingOverlay = {
      version: 1, drawingRef: { drawingId: 'drawing-1', revision: 1 },
      taskId: 'task-1', stateEpoch: 4, disposition: 'active',
      groups: [{
        groundingId: 'ground-new', partKey: 'part', label: 'Part', colorIndex: 0,
        nodeIds: ['carrier-b'], interfaces: [],
      }],
    };
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();
    port.groundingOverlay = {
      ...port.groundingOverlay,
      stateEpoch: 3,
      groups: [{
        groundingId: 'ground-old', partKey: 'part', label: 'Part', colorIndex: 0,
        nodeIds: ['carrier-a'], interfaces: [],
      }],
    };

    await store.getState().refresh();

    expect(store.getState().groundingOverlay?.stateEpoch).toBe(4);
    expect(store.getState().groundingOverlay?.groups[0]?.nodeIds).toEqual(['carrier-b']);
  });

  it.each(['committed', 'discarded', 'failed'] as const)(
    'clears AI selection and Preview when the episode becomes %s',
    async (disposition) => {
      const port = new TestPort(snapshot(1, ['line-formal']));
      port.preview = {
        version: 1, handle: 'preview-1', baseRef: { drawingId: 'drawing-1', revision: 1 },
        commands: [{ type: 'node.delete', id: 'line-formal' }],
        candidate: snapshot(1, ['line-candidate']),
        diff: { createdNodeIds: ['line-candidate'], updatedNodeIds: [], deletedNodeIds: ['line-formal'] },
        createdAt: 42,
      };
      port.groundingOverlay = {
        version: 1, drawingRef: { drawingId: 'drawing-1', revision: 1 },
        taskId: 'task-1', stateEpoch: 2, disposition: 'active',
        groups: [{
          groundingId: 'ground-a', partKey: 'part', label: 'Part', colorIndex: 0,
          nodeIds: ['line-candidate'], interfaces: [],
        }],
      };
      const store = createDrawingWorkspaceStore({ port });
      await store.getState().load();
      expect(store.getState().preview).not.toBeNull();
      expect(store.getState().groundingOverlay).not.toBeNull();
      port.groundingOverlay = {
        ...port.groundingOverlay, stateEpoch: 3, disposition, groups: [],
      };

      await store.getState().refresh();

      expect(store.getState().groundingOverlay).toBeNull();
      expect(store.getState().preview).toBeNull();
      expect(store.getState().displaySnapshot?.document.geometry[0]?.id).toBe('line-formal');
    },
  );

  it('publishes a Host-verified projection whenever the canvas selection changes', async () => {
    const port = new TestPort(snapshot(1, ['right-hand']));
    const selections: string[][] = [];
    port.projectSelection = async (ref, nodeIds) => {
      selections.push(nodeIds);
      return nodeIds.length === 0 ? { status: 'cleared' } : {
        status: 'projected',
        projection: {
          selectionProjectionId: 'selection-1', drawingRef: ref, nodeIds,
          projectionDigest: 'sha256:selection', expiresAt: 1234,
        },
      };
    };
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();

    store.getState().setSelection(['right-hand']);
    await Promise.resolve();

    expect(store.getState().selectionProjection).toMatchObject({
      selectionProjectionId: 'selection-1', nodeIds: ['right-hand'],
    });

    store.getState().setSelection([]);
    await Promise.resolve();

    expect(selections).toEqual([['right-hand'], []]);
    expect(store.getState().selectionProjection).toBeNull();
  });

  it('defaults to the extracted vector view without the source raster underlay', () => {
    const store = createDrawingWorkspaceStore({ port: new TestPort(snapshot(1)) });

    expect(store.getState().display.sourceUnderlay).toBe(false);
  });

  it('starts idle and loads an authoritative snapshot', async () => {
    const store = createDrawingWorkspaceStore({ port: new TestPort(snapshot(4)) });

    expect(store.getState().status).toBe('idle');
    expect(store.getState().snapshot).toBeNull();

    await store.getState().load();

    expect(store.getState().status).toBe('ready');
    expect(store.getState().snapshot?.ref).toEqual({ drawingId: 'drawing-1', revision: 4 });
  });

  it('keeps the formal snapshot separate while displaying the current Preview candidate', async () => {
    const port = new TestPort(snapshot(1, ['line-formal']));
    port.preview = {
      version: 1,
      handle: 'preview-1',
      baseRef: { drawingId: 'drawing-1', revision: 1 },
      commands: [{ type: 'node.delete', id: 'line-formal' }],
      candidate: snapshot(1, ['line-candidate']),
      diff: {
        createdNodeIds: ['line-candidate'],
        updatedNodeIds: [],
        deletedNodeIds: ['line-formal'],
      },
      createdAt: 42,
    };
    const store = createDrawingWorkspaceStore({ port });

    await store.getState().load();
    store.getState().setSelection(['line-candidate', 'line-formal']);

    expect(store.getState().snapshot?.document.geometry[0]?.id).toBe('line-formal');
    expect(store.getState().preview?.handle).toBe('preview-1');
    expect(store.getState().displaySnapshot?.document.geometry[0]?.id).toBe('line-candidate');
    expect(store.getState().selectedIds).toEqual(['line-candidate']);
  });

  it('keeps viewport, pointer, toggles, and selection local to one store', async () => {
    const first = createDrawingWorkspaceStore({ port: new TestPort(snapshot(1)) });
    const second = createDrawingWorkspaceStore({ port: new TestPort(snapshot(1)) });
    await Promise.all([first.getState().load(), second.getState().load()]);

    first.getState().setViewport({ x: 18, y: -7, scale: 2, width: 900, height: 600 });
    first.getState().setMouseWorld([12, 34]);
    first.getState().setSelection(['line-1']);
    first.getState().setDisplay({ grid: false, annotations: false });

    expect(first.getState().viewport).toEqual({ x: 18, y: -7, scale: 2, width: 900, height: 600 });
    expect(first.getState().mouseWorld).toEqual([12, 34]);
    expect(first.getState().selectedIds).toEqual(['line-1']);
    expect(first.getState().display.grid).toBe(false);
    expect(first.getState().display.annotations).toBe(false);
    expect(second.getState().viewport).toEqual({ x: 0, y: 0, scale: 1, width: 0, height: 0 });
    expect(second.getState().selectedIds).toEqual([]);
    expect(second.getState().display.grid).toBe(true);
  });

  it('drops selected ids that disappear after an authoritative refresh', async () => {
    const port = new TestPort(snapshot(1, ['line-1', 'line-2']));
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();
    store.getState().setSelection(['line-1', 'line-2']);
    port.current = snapshot(2, ['line-2']);

    await store.getState().refresh();

    expect(store.getState().selectedIds).toEqual(['line-2']);
    expect(store.getState().snapshot?.ref.revision).toBe(2);
  });

  it('refreshes after a subscribed host change and unsubscribes on destroy', async () => {
    const port = new TestPort(snapshot(1));
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();
    port.current = snapshot(2);

    port.emit();
    await Promise.resolve();
    await Promise.resolve();

    expect(store.getState().snapshot?.ref.revision).toBe(2);
    expect(port.listeners.size).toBe(1);

    store.getState().destroy();

    expect(port.listeners.size).toBe(0);
  });

  it('commits a node update with the current value as its precondition', async () => {
    const port = new TestPort(snapshot(7));
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();

    const committed = await store.getState().updateNode('line-1', { visible: false });

    expect(committed).toBe(true);
    expect(port.commits).toEqual([{
      expectedRevision: 7,
      commands: [{
        type: 'node.update',
        id: 'line-1',
        changes: { visible: false },
        expected: { visible: true },
      }],
    }]);
  });

  it('commits deletion for each existing requested node', async () => {
    const port = new TestPort(snapshot(2, ['line-1', 'line-2']));
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();

    await store.getState().deleteNodes(['line-2', 'missing', 'line-1']);

    expect(port.commits[0]).toEqual({
      expectedRevision: 2,
      commands: [
        { type: 'node.delete', id: 'line-2' },
        { type: 'node.delete', id: 'line-1' },
      ],
    });
  });

  it('commits annotation text movement with the previous position', async () => {
    const port = new TestPort(snapshotWithText(3));
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();

    await store.getState().moveAnnotationText('text-1', [20, 30]);

    expect(port.commits[0]).toEqual({
      expectedRevision: 3,
      commands: [{
        type: 'annotation.move-text',
        id: 'text-1',
        position: [20, 30],
        expectedPosition: [2, 3],
      }],
    });
  });

  it('adopts the authoritative snapshot and reports a revision conflict', async () => {
    const port = new TestPort(snapshot(1));
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();
    port.current = snapshot(5);

    const committed = await store.getState().updateNode('line-1', { visible: false });

    expect(committed).toBe(false);
    expect(store.getState().snapshot?.ref.revision).toBe(5);
    expect(store.getState().error).toEqual({
      code: 'revision_conflict',
      message: 'drawing revision changed',
    });
  });

  it('disposes replaced and unmounted source resources', async () => {
    const disposed: string[] = [];
    const first = snapshot(1);
    first.source = { id: 'source-1', mediaType: 'image/png', width: 10, height: 20 };
    const port = new TestPort(first);
    port.loadSource = async (source) => ({
      url: `blob:${source.id}`,
      dispose: () => disposed.push(source.id),
    });
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();
    const second = snapshot(2);
    second.source = { id: 'source-2', mediaType: 'image/png', width: 30, height: 40 };
    port.current = second;

    await store.getState().refresh();
    store.getState().destroy();

    expect(disposed).toEqual(['source-1', 'source-2']);
  });

  it('can load again after cleanup when React StrictMode remounts the same store', async () => {
    const port = new TestPort(snapshot(1));
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();
    store.getState().destroy();
    port.current = snapshot(2);

    await store.getState().load();

    expect(store.getState().snapshot?.ref.revision).toBe(2);
    expect(port.listeners.size).toBe(1);
  });

  it('undoes the exact latest commit and adopts the compensating revision', async () => {
    const current = snapshot(2);
    current.lastCommit = { commitId: 'commit-1', mode: 'interactive', undoable: true };
    const port = new TestPort(current);
    port.undoLast = async (received) => ({
      status: 'committed',
      snapshot: {
        ...structuredClone(received),
        ref: { ...received.ref, revision: 3 },
        lastCommit: { commitId: 'undo-1', mode: 'undo', undoable: false },
      },
    });
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();

    await expect(store.getState().undoLast()).resolves.toBe(true);
    expect(store.getState().snapshot?.ref.revision).toBe(3);
    expect(store.getState().snapshot?.lastCommit).toEqual({
      commitId: 'undo-1', mode: 'undo', undoable: false,
    });
  });

  it('redoes the exact latest undo and adopts the restored revision', async () => {
    const current = snapshot(3);
    current.lastCommit = { commitId: 'undo-1', mode: 'undo', undoable: false, redoable: true };
    const port = new TestPort(current);
    port.redoLast = async (received) => ({
      status: 'committed',
      snapshot: {
        ...structuredClone(received),
        ref: { ...received.ref, revision: 4 },
        lastCommit: { commitId: 'redo-1', mode: 'redo', undoable: true, redoable: false },
      },
    });
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();

    await expect(store.getState().redoLast()).resolves.toBe(true);
    expect(store.getState().snapshot?.ref.revision).toBe(4);
    expect(store.getState().snapshot?.lastCommit).toEqual({
      commitId: 'redo-1', mode: 'redo', undoable: true, redoable: false,
    });
  });
});
