// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ImageAttachmentRef, StoredImageAttachment } from '@deepseek-ai/dsh-attachment';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import { createEmptyDrawing, type GeometryId } from '../packages/drawing-core/src/index';
import { createHash } from 'node:crypto';

import type {
  DrawingDurableState,
  DurableDrawingRepositoryStorage,
} from '../packages/plugin-dsh-space-host/src/durable-envelope';
import {
  InMemoryDrawingRepository,
  type DrawingRepositoryStorage,
} from '../packages/plugin-dsh-space-host/src/repository';
import { SemanticEditService } from '../packages/plugin-dsh-space-host/src/semantic-edit-service';
import { createDrawingAgentToolCatalog } from '../packages/plugin-dsh-space-host/src/tools';

const forbiddenModelKeys = new Set([
  'taskId', 'observationId', 'contextId', 'groundingId', 'previewHandle',
  'candidateDigest', 'operationId', 'operationBindingDigest', 'translation',
  'pivot', 'rotationRadians', 'rotationDegrees', 'point', 'points',
]);

class MemoryStorage implements DrawingRepositoryStorage, DurableDrawingRepositoryStorage {
  state: DrawingDurableState | null = null;
  load() { return this.state?.entry ?? null; }
  save(_sessionId: string, entry: DrawingDurableState['entry']) {
    this.state = { version: 2, entry: structuredClone(entry), commits: [], operations: [] };
  }
  loadDurable() { return this.state === null ? null : structuredClone(this.state); }
  saveDurable(_sessionId: string, state: DrawingDurableState) { this.state = structuredClone(state); }
}

async function runScenario(label: string) {
  const sessionId = `session-${label}`;
  const storage = new MemoryStorage();
  let sequence = 0;
  const source: ImageAttachmentRef = {
    attachmentId: `source-${label}` as ImageAttachmentRef['attachmentId'],
    mediaType: 'image/png', bytes: 1, width: 100, height: 80,
  };
  const drawings = new InMemoryDrawingRepository({
    storage,
    drawingId: () => 'drawing-semantic-e2e',
    previewHandle: () => `workspace-preview-${++sequence}`,
    now: () => 1_000 + sequence,
    vectorizer: {
      async vectorize({ drawingId }) {
        const document = createEmptyDrawing({ idFactory: { next: () => drawingId }, now: () => 1 });
        const quality = { status: 'confirmed' as const, evidenceRefs: [] };
        document.geometry = [{
          id: 'component-west' as GeometryId, type: 'circle', center: [-18, 8], radius: 3,
          visible: true, quality,
        }, {
          id: 'component-east' as GeometryId, type: 'circle', center: [18, 8], radius: 3,
          visible: true, quality,
        }, {
          id: 'protected-center' as GeometryId, type: 'circle', center: [0, 0], radius: 8,
          visible: true, quality,
        }];
        return {
          document, bounds: { minX: -30, minY: -20, maxX: 30, maxY: 30 }, provisional: false,
        };
      },
    },
  });
  drawings.bindPending(sessionId, source);
  const digest = (value: string) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
  const semantic = new SemanticEditService(drawings, {
    id: (kind) => `${kind}-${++sequence}`,
    now: () => 2_000 + sequence,
    digest,
  });
  semantic.bindUserInstruction(sessionId, {
    rootUserMessageId: 'root-message-1',
    rootUserMessageDigest: digest('move both components down'),
    objective: 'Move both selected components below their current position while preserving their shapes.',
    numericConstraints: [],
  });
  const questions = {
    async ask(input: { questions: Array<{ id: string }> }) {
      const id = input.questions[0]!.id;
      return { answers: [{ id, selected: [id.startsWith('drawing-undo-') ? '撤销此提交' : '应用修改'] }] };
    },
  };
  const tools = createDrawingAgentToolCatalog(drawings, {
    async readImage(ref): Promise<StoredImageAttachment> {
      return { ref, data: new Uint8Array([1]) };
    },
  }, semantic, questions as never);
  const captured: Array<{ name: string; args: unknown }> = [];
  const context = toolContext(sessionId);
  const call = async (name: string, args: unknown) => {
    assertNoForbiddenKeys(args, name);
    captured.push({ name, args: structuredClone(args) });
    const tool = tools.find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`E2E_TOOL_MISSING:${name}`);
    return await tool.execute(args, context);
  };

  await call('drawing_import', {});
  await call('drawing_observe', {});
  await call('drawing_select_parts', {
    parts: [{
      partKey: 'west', label: 'western component',
      references: [{ kind: 'semantic_query', text: 'component west' }],
    }, {
      partKey: 'east', label: 'eastern component',
      references: [{ kind: 'semantic_query', text: 'component east' }],
    }],
  });
  await call('drawing_preview_spatial_intent', {
    summary: 'move both components downward as one atomic edit',
    goals: [
      { kind: 'direction', subject: 'west', direction: 'down', magnitude: 'moderate' },
      { kind: 'direction', subject: 'east', direction: 'down', magnitude: 'moderate' },
      { kind: 'alignment', subject: 'west', reference: { kind: 'part', partKey: 'east' }, axis: 'y' },
    ],
    preserve: [
      { kind: 'part_shape', partKey: 'west' },
      { kind: 'part_shape', partKey: 'east' },
      { kind: 'protected_scope' },
      { kind: 'minimum_deformation' },
    ],
  });
  await call('drawing_evaluate_preview', {});
  const finalized = await call('drawing_finalize_preview', {}) as { status?: string; revision?: number };
  if (finalized.status !== 'committed' || finalized.revision !== 2) {
    throw new Error(`E2E_FINALIZE_FAILED:${JSON.stringify(finalized)}`);
  }
  const commit = storage.state?.commits[0];
  if (!commit?.candidateDigest || !commit.solverProvenance) throw new Error('E2E_DURABLE_PROVENANCE_MISSING');
  if (commit.solverProvenance.receipt.inputsContainModelCoordinates !== false) {
    throw new Error('E2E_MODEL_COORDINATE_BOUNDARY_FAILED');
  }
  const snapshot = drawings.getSnapshot(sessionId);
  if (!snapshot?.lastCommit) throw new Error('E2E_LAST_COMMIT_MISSING');
  const undone = await call('drawing_undo_commit', {
    targetCommitId: snapshot.lastCommit.commitId,
    expectedCurrentRef: snapshot.ref,
  }) as { status?: string; revision?: number };
  if (undone.status !== 'committed' || undone.revision !== 3) {
    throw new Error(`E2E_UNDO_FAILED:${JSON.stringify(undone)}`);
  }
  const restored = drawings.getSnapshot(sessionId)?.document.geometry;
  if (restored?.find(({ id }) => id === 'component-west')?.type !== 'circle'
    || restored.find(({ id }) => id === 'component-west')?.center[1] !== 8
    || restored.find(({ id }) => id === 'component-east')?.type !== 'circle'
    || restored.find(({ id }) => id === 'component-east')?.center[1] !== 8) {
    throw new Error('E2E_UNDO_SEMANTIC_MISMATCH');
  }
  return {
    candidateDigest: commit.candidateDigest,
    semanticDigest: commit.semanticDigest,
    captured,
    commitCount: storage.state?.commits.filter(({ mode }) => mode !== 'undo').length ?? 0,
    undoCount: storage.state?.commits.filter(({ mode }) => mode === 'undo').length ?? 0,
  };
}

function toolContext(sessionId: string): ToolRunContext {
  return {
    callId: 'e2e-call', rootCallId: 'e2e-call', name: 'drawing', arguments: {},
    signal: new AbortController().signal, token: Symbol('tool'),
    agent: { id: sessionId } as unknown as Agent,
    deferContext() {}, concludeTurn() {},
  } as unknown as ToolRunContext;
}

function assertNoForbiddenKeys(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenModelKeys.has(key)) throw new Error(`E2E_FORBIDDEN_MODEL_KEY:${path}.${key}`);
    assertNoForbiddenKeys(child, `${path}.${key}`);
  }
}

const first = await runScenario('a');
const second = await runScenario('b');
if (first.candidateDigest !== second.candidateDigest || first.semanticDigest !== second.semanticDigest) {
  throw new Error('E2E_NON_DETERMINISTIC_REPLAY');
}
if (first.commitCount !== 1 || first.undoCount !== 1) throw new Error('E2E_TRANSACTION_COUNT_INVALID');

console.log(JSON.stringify({
  status: 'ok', commitCount: first.commitCount, undoCount: first.undoCount,
  forbiddenKeyCount: 0, deterministicReplay: true,
  modelToolCalls: first.captured.map(({ name }) => name),
}, null, 2));
