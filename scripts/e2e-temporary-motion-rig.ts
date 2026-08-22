// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type GeometryId } from '../packages/drawing-core/src/index';
import { solveTranslationMotionRig } from '../packages/drawing-edit-core/src/index';

import { InteractiveEditService } from '../packages/plugin-dsh-space-host/src/interactive-edit';
import { MotionRigService } from '../packages/plugin-dsh-space-host/src/motion-rig-service';
import type {
  DrawingDurableState,
  DurableDrawingRepositoryStorage,
} from '../packages/plugin-dsh-space-host/src/durable-envelope';
import {
  InMemoryDrawingRepository,
  type DrawingRepositoryStorage,
} from '../packages/plugin-dsh-space-host/src/repository';

const sessionId = 'e2e-motion-rig';
let idSequence = 0;
let now = 10;
const ports = {
  id: (kind: string) => `${kind}-${++idSequence}`,
  now: () => now++,
  digest: (value: string) => `sha256:test:${value.length}:${checksum(value)}`,
};

class MemoryStorage implements DrawingRepositoryStorage, DurableDrawingRepositoryStorage {
  state: DrawingDurableState | null = null;
  load() { return this.state?.entry ?? null; }
  save(_sessionId: string, entry: DrawingDurableState['entry']) {
    this.state = { version: 2, entry: structuredClone(entry), commits: [], operations: [] };
  }
  loadDurable() { return this.state === null ? null : structuredClone(this.state); }
  saveDurable(_sessionId: string, state: DrawingDurableState) { this.state = structuredClone(state); }
}

const drawings = new InMemoryDrawingRepository({
  storage: new MemoryStorage(),
  drawingId: () => 'drawing-motion-rig',
  now: ports.now,
  vectorizer: {
    async vectorize({ drawingId }) {
      const document = createEmptyDrawing({ idFactory: { next: () => drawingId }, now: () => 1 });
      document.geometry = [
        {
          id: 'hand' as GeometryId, type: 'circle', center: [20, 20], radius: 3,
          visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
        },
        {
          id: 'hand-detail' as GeometryId, type: 'circle', center: [20, 20], radius: 1,
          visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
        },
        {
          id: 'arm-upper' as GeometryId, type: 'line', start: [0, 22], end: [17, 20],
          visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
        },
        {
          id: 'arm-lower' as GeometryId, type: 'line', start: [0, 18], end: [17, 20],
          visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
        },
      ];
      return { document, bounds: { minX: 0, minY: 15, maxX: 23, maxY: 25 }, provisional: false };
    },
  },
});

const source = {
  attachmentId: 'fixture' as never,
  mediaType: 'image/png', bytes: 1, width: 23, height: 10,
};
drawings.bindPending(sessionId, source as never);
await drawings.importPending(sessionId, {
  data: new Uint8Array([1]), signal: new AbortController().signal,
});

const rigs = new MotionRigService(drawings);

assert(rigs.create(sessionId, ['hand', 'hand-detail']).state === 'ready', 'rig should be ready');
assert(rigs.discard(sessionId, { drawingId: 'drawing-motion-rig', revision: 1 }).status === 'discarded', 'cancel should discard');
assert(drawings.getSnapshot(sessionId)?.ref.revision === 1, 'cancel must not commit');

assert(rigs.create(sessionId, ['hand', 'hand-detail']).state === 'ready', 'second rig should be ready');
const rig = rigs.current(sessionId);
const before = drawings.getSnapshot(sessionId);
assert(rig !== null && before !== null, 'rig and Drawing should exist');
const fixedBefore = rig.connectors.map(({ nodeId, fixedPoint }) => ({ nodeId, fixedPoint }));
const solved = solveTranslationMotionRig(before.document, rig, [8, 12]);
for (const binding of fixedBefore) {
  const node = solved.candidate.geometry.find(({ id }) => String(id) === binding.nodeId);
  assert(node?.type === 'line', `${binding.nodeId} should remain a line`);
  const fixed = rig.connectors.find(({ nodeId }) => nodeId === binding.nodeId)?.movingEndpoint === 'start'
    ? node.end : node.start;
  assert(JSON.stringify(fixed) === JSON.stringify(binding.fixedPoint), `${binding.nodeId} fixed endpoint changed`);
}

const interactive = new InteractiveEditService(drawings, ports);
const staged = interactive.stage(sessionId, { expectedRevision: 1, commands: solved.commands });
assert(staged.status === 'staged', 'interactive edit should stage');
const committed = interactive.apply(sessionId, staged);
assert(committed.status === 'committed', 'interactive edit should commit');
assert(committed.resultingRef.revision === 2, 'commit should create revision 2');
assert(rigs.current(sessionId) === null, 'revision change should invalidate the rig');
assert(drawings.getSnapshot(sessionId)?.document.geometry.find(({ id }) => id === 'hand')?.type === 'circle', 'hand should exist');
expectCenter(drawings, [28, 32]);

const undone = drawings.undoCommit(sessionId, {
  targetCommitId: committed.commitId,
  expectedCurrentRef: committed.resultingRef,
  operationId: 'undo-motion-rig',
  operationBindingDigest: 'sha256:undo-motion-rig',
});
assert(undone.status === 'committed', 'motion-rig commit should undo');
expectCenter(drawings, [20, 20]);

const redone = drawings.redoCommit(sessionId, {
  targetCommitId: undone.commitId,
  expectedCurrentRef: undone.resultingRef,
  operationId: 'redo-motion-rig',
  operationBindingDigest: 'sha256:redo-motion-rig',
});
assert(redone.status === 'committed', 'motion-rig undo should redo');
expectCenter(drawings, [28, 32]);

console.log(JSON.stringify({
  status: 'passed',
  connectors: rig.connectors.length,
  committedRevision: committed.resultingRef.revision,
  undoRevision: undone.resultingRef.revision,
  redoRevision: redone.resultingRef.revision,
}));

function expectCenter(repository: InMemoryDrawingRepository, expected: readonly [number, number]) {
  const hand = repository.getSnapshot(sessionId)?.document.geometry.find(({ id }) => id === 'hand');
  assert(hand?.type === 'circle', 'hand carrier missing');
  assert(JSON.stringify(hand.center) === JSON.stringify(expected), `expected hand center ${expected}, received ${hand.center}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function checksum(value: string): number {
  let output = 0;
  for (let index = 0; index < value.length; index += 1) output = (output * 31 + value.charCodeAt(index)) >>> 0;
  return output;
}
