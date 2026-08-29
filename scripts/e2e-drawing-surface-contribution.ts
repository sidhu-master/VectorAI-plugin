// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createEmptyDrawing } from '@vectorai/drawing-core';

class MemoryAnnotationStorage {
  readonly values = new Map<string, unknown>();
  load(sessionId: string) { return this.values.get(sessionId) ?? null; }
  save(sessionId: string, state: unknown) { this.values.set(sessionId, structuredClone(state)); }
  delete(sessionId: string) { this.values.delete(sessionId); }
}

type MemoryDrawingState = { version: number; entry: unknown; commits: unknown[]; operations: unknown[] };

class MemoryDrawingStorage {
  state: MemoryDrawingState | null = null;
  load() { return this.state?.entry ?? null; }
  save(_sessionId: string, entry: unknown) {
    this.state = { version: 2, entry: structuredClone(entry), commits: [], operations: [] };
  }
  loadDurable() { return this.state === null ? null : structuredClone(this.state); }
  saveDurable(_sessionId: string, state: unknown) { this.state = structuredClone(state) as MemoryDrawingState; }
}

const root = resolve(import.meta.dirname, '..');
const spaceHost = await import(pathToFileURL(resolve(
  root, 'packages/plugin-dsh-space-host/lib/index.js',
)).href);
const spaceClient = await import(pathToFileURL(resolve(
  root, 'packages/plugin-dsh-space-client/lib/index.js',
)).href);
const annotationHost = await import(pathToFileURL(resolve(
  root, 'packages/plugin-dsh-annotation-host/lib/index.js',
)).href);
const annotationClient = await import(pathToFileURL(resolve(
  root, 'packages/plugin-dsh-annotation-client/lib/index.js',
)).href);

const sessionId = 'surface-e2e-session';
const sessionStorage = new MemoryAnnotationStorage();
let epoch = 10;
const sessions = new annotationHost.AnnotationSessionStateStore(sessionStorage, {
  now: () => ++epoch,
});
const registry = spaceClient.createDrawingSurfaceRegistry();

assertElection(registry, null, 'default UI before contribution activation');
const firstInstall = installAnnotationContribution(registry, sessions);
await firstInstall.source.refresh(sessionId);
assertElection(registry, null, 'registration alone must not claim');

sessions.start(sessionId, 'workflow-1');
await firstInstall.source.refresh(sessionId);
assertElection(registry, 'engineering-annotation', 'successful route claims professional UI');

sessions.finish(sessionId, 'completed');
await firstInstall.source.refresh(sessionId);
assertElection(registry, 'engineering-annotation', 'completion keeps professional UI');

sessions.start(sessionId, 'workflow-2');
sessions.finish(sessionId, 'canceled');
await firstInstall.source.refresh(sessionId);
assertElection(registry, 'engineering-annotation', 'cancellation keeps professional UI');

firstInstall.dispose();
assertElection(registry, null, 'unloaded contribution falls back to first layer');

const reloaded = new annotationHost.AnnotationSessionStateStore(sessionStorage, {
  now: () => ++epoch,
});
const secondInstall = installAnnotationContribution(registry, reloaded);
await secondInstall.source.refresh(sessionId);
assertElection(registry, 'engineering-annotation', 'reload restores persisted claim');
secondInstall.dispose();
assertElection(registry, null, 'explicit unload returns to fallback');

const reinstalled = installAnnotationContribution(registry, reloaded);
await reinstalled.source.refresh(sessionId);
assertElection(registry, 'engineering-annotation', 'reinstall restores persisted claim');

const transaction = await runFirstLayerAnnotationTransaction();
if (transaction.commitCount !== 1 || transaction.undoCount !== 1) {
  throw new Error(`SURFACE_E2E_HISTORY_INVALID:${JSON.stringify(transaction)}`);
}
reinstalled.dispose();

console.log(JSON.stringify({
  status: 'ok',
  lifecycle: [
    'fallback', 'claimed', 'completed-sticky', 'canceled-sticky',
    'unloaded-fallback', 'reload-restored', 'reinstalled-restored',
  ],
  ...transaction,
}, null, 2));

interface SurfaceRegistryLike {
  registerWorkspace(input: { id: string; apiVersion: number; priority: number; claimSource: unknown; Component: () => null }): { dispose(): void };
  getWorkspaceSnapshot(sessionId: string): { electedId: string | null };
}
interface AnnotationSessionsLike { get(sessionId: string): unknown }

function installAnnotationContribution(registry: SurfaceRegistryLike, sessions: AnnotationSessionsLike) {
  const source = annotationClient.createAnnotationRemoteStateSource({
    async getSessionState(requestedSessionId: string) {
      return { ok: true, value: sessions.get(requestedSessionId) };
    },
  }, { pollIntervalMs: 60_000 });
  const registration = registry.registerWorkspace({
    id: 'engineering-annotation',
    apiVersion: 1,
    priority: 100,
    claimSource: source.claimSource,
    Component: () => null,
  });
  return {
    source,
    dispose() {
      registration.dispose();
      source.dispose();
    },
  };
}

function assertElection(registry: SurfaceRegistryLike, expected: string | null, label: string) {
  const actual = registry.getWorkspaceSnapshot(sessionId).electedId;
  if (actual !== expected) throw new Error(`SURFACE_E2E_ELECTION:${label}:${actual}`);
}

async function runFirstLayerAnnotationTransaction() {
  const drawingSessionId = 'surface-transaction-session';
  const storage = new MemoryDrawingStorage();
  let sequence = 0;
  const digest = (value: string) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
  const drawings = new spaceHost.InMemoryDrawingRepository({
    storage,
    drawingId: () => 'drawing-surface-e2e',
    previewHandle: () => `workspace-preview-${++sequence}`,
    now: () => 100 + sequence,
    vectorizer: {
      async vectorize({ drawingId }: { drawingId: string }) {
        const document = createEmptyDrawing({ idFactory: { next: () => drawingId }, now: () => 1 });
        const rise = 4 * Math.sqrt(3);
        const journal = 12.9 - rise;
        const quality = (id: string) => ({
          status: 'confirmed' as const,
          evidenceRefs: [`evidence:${id}` as never],
        });
        document.geometry = [
          { id: 'profile-top' as never, type: 'line', start: [14, journal], end: [90, journal], visible: true, quality: quality('profile-top') },
          { id: 'profile-bottom' as never, type: 'line', start: [14, -journal], end: [90, -journal], visible: true, quality: quality('profile-bottom') },
          { id: 'left-upper' as never, type: 'line', start: [10, 12.9], end: [14, journal], visible: true, quality: quality('left-upper') },
          { id: 'left-lower' as never, type: 'line', start: [10, -12.9], end: [14, -journal], visible: true, quality: quality('left-lower') },
        ];
        return {
          document,
          bounds: { minX: -10, minY: -10, maxX: 10, maxY: 10 },
          provisional: false,
        };
      },
    },
  });
  drawings.bindPending(drawingSessionId, {
    attachmentId: 'source-1', mediaType: 'image/png', bytes: 1, width: 20, height: 20,
  });
  await drawings.importPending(drawingSessionId, {
    data: new Uint8Array([1]), signal: new AbortController().signal,
  });
  const semantic = new spaceHost.SemanticEditService(drawings, {
    id: (kind: string) => `${kind}-${++sequence}`,
    now: () => 200 + sequence,
    digest,
  });
  const extensions = new spaceHost.ExtensionPreviewService(drawings, semantic, {
    id: (kind: string) => `${kind}-${++sequence}`,
    now: () => 300 + sequence,
    digest,
  });
  const snapshot = drawings.getSnapshot(drawingSessionId);
  if (snapshot === null) throw new Error('SURFACE_E2E_DRAWING_REQUIRED');
  const plan = annotationHost.planEngineeringAnnotations({
    document: snapshot.document,
    ref: snapshot.ref,
    objective: '工程图纸自动标注',
  });
  if (plan.program === null) throw new Error('SURFACE_E2E_ANNOTATION_PLAN_REQUIRED');
  const preview = await extensions.create(drawingSessionId, {
    extensionId: 'engineering-annotation',
    workflowId: 'workflow-transaction',
    ref: snapshot.ref,
    targetNodeIds: plan.targetNodeIds,
    program: plan.program,
  });
  if (preview.status !== 'previewed') {
    throw new Error(`SURFACE_E2E_PREVIEW_FAILED:${JSON.stringify(preview)}`);
  }
  const control = {
    extensionId: 'engineering-annotation',
    workflowId: 'workflow-transaction',
    ref: preview.ref,
    previewToken: preview.previewToken,
    candidateDigest: preview.candidateDigest,
  };
  const assessed = await extensions.assess(drawingSessionId, control);
  if (assessed.status !== 'assessed' || assessed.assessment.disposition !== 'auto_safe') {
    throw new Error(`SURFACE_E2E_ASSESS_FAILED:${JSON.stringify(assessed)}`);
  }
  const finalized = await extensions.finalize(drawingSessionId, control);
  if (finalized.status !== 'finalized' || finalized.result.status !== 'committed') {
    throw new Error(`SURFACE_E2E_FINALIZE_FAILED:${JSON.stringify(finalized)}`);
  }
  const after = drawings.getSnapshot(drawingSessionId);
  if (after?.ref.revision !== 2 || after.document.annotations.length !== 1) {
    throw new Error('SURFACE_E2E_FORMAL_REVISION_INVALID');
  }
  const undone = semantic.undoAuthorized(drawingSessionId, {
    targetCommitId: finalized.result.commitId,
    expectedCurrentRef: finalized.result.ref,
  });
  if (undone.status !== 'committed' || undone.resultingRef.revision !== 3) {
    throw new Error(`SURFACE_E2E_UNDO_FAILED:${JSON.stringify(undone)}`);
  }
  if (drawings.getSnapshot(drawingSessionId)?.document.annotations.length !== 0) {
    throw new Error('SURFACE_E2E_UNDO_CONTENT_INVALID');
  }
  return {
    commitCount: storage.state?.commits.filter(({ mode }: { mode: string }) => mode !== 'undo').length ?? 0,
    undoCount: storage.state?.commits.filter(({ mode }: { mode: string }) => mode === 'undo').length ?? 0,
    finalRevision: drawings.getSnapshot(drawingSessionId)?.ref.revision,
  };
}
