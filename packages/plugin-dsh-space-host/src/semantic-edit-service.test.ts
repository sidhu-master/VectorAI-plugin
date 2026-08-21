// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { createEmptyDrawing, type GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import type { DrawingDurableState } from './durable-envelope';
import { InMemoryDrawingRepository, type DrawingRepositoryStorage } from './repository';
import { SemanticEditService } from './semantic-edit-service';

class Storage implements DrawingRepositoryStorage {
  state: DrawingDurableState | null = null;
  load() { return this.state?.entry ?? null; }
  save(_sessionId: string, entry: DrawingDurableState['entry']) {
    this.state = { version: 2, entry: structuredClone(entry), commits: [], operations: [] };
  }
  loadDurable() { return this.state === null ? null : structuredClone(this.state); }
  saveDurable(_sessionId: string, state: DrawingDurableState) { this.state = structuredClone(state); }
}

async function setup(
  provisional = false,
  review?: ConstructorParameters<typeof SemanticEditService>[1]['review'],
) {
  const storage = new Storage();
  let sequence = 0;
  const drawings = new InMemoryDrawingRepository({
    storage,
    previewHandle: () => `workspace-preview-${++sequence}`,
    now: () => 100 + sequence,
    drawingId: () => 'drawing-wave',
    vectorizer: {
      async vectorize({ drawingId }) {
        const document = createEmptyDrawing({ idFactory: { next: () => drawingId }, now: () => 1 });
        const quality = { status: provisional ? 'candidate' as const : 'confirmed' as const, evidenceRefs: [] };
        document.geometry = [
          { id: 'body' as GeometryId, type: 'circle', center: [0, 0], radius: 10, visible: true, quality },
          { id: 'right-hand' as GeometryId, type: 'circle', center: [15, 0], radius: 3, visible: true, quality },
          { id: 'right-arm-top' as GeometryId, type: 'line', start: [9, 2], end: [12.7639320225, 2], visible: true, quality },
          { id: 'right-arm-bottom' as GeometryId, type: 'line', start: [9, -2], end: [12.7639320225, -2], visible: true, quality },
          { id: 'left-hand' as GeometryId, type: 'circle', center: [-15, 0], radius: 3, visible: true, quality },
        ];
        return { document, bounds: { minX: -30, minY: -20, maxX: 30, maxY: 30 }, provisional };
      },
    },
  });
  const attachment: ImageAttachmentRef = {
    attachmentId: 'source' as never, mediaType: 'image/png', bytes: 1, width: 60, height: 50,
  };
  drawings.bindPending('session-1', attachment);
  await drawings.importPending('session-1', { data: new Uint8Array([1]), signal: new AbortController().signal });
  const service = new SemanticEditService(drawings, {
    id: (kind) => `${kind}-${++sequence}`,
    now: () => 1_000 + sequence,
    digest: (value) => `sha256:test-${value.length}-${checksum(value)}`,
    async renderObservation() {
      return {
        contentDigest: 'sha256:observation-render',
        attachment,
        width: 60,
        height: 50,
        worldToImage: [1, 0, 0, -1, 30, 30],
      };
    },
    ...(review ? { review } : {}),
  });
  return { drawings, service, storage };
}

async function previewRightHand(service: SemanticEditService) {
  const task = service.startTask('session-1', {
    objective: '把右手抬起来打招呼',
    rootUserMessageDigest: 'sha256:user-message',
    policy: 'auto-safe',
  });
  const observation = await service.observe('session-1', { taskId: task.taskId });
  const context = service.buildContext('session-1', {
    taskId: task.taskId,
    observationId: observation.observationId,
  });
  const grounding = service.ground('session-1', {
    taskId: task.taskId,
    contextId: context.contextId,
    targetNodeIds: ['right-hand'],
    interfaces: [
      { interfaceId: 'right-arm-top:end', nodeId: 'right-arm-top', endpoint: 'end' },
      { interfaceId: 'right-arm-bottom:end', nodeId: 'right-arm-bottom', endpoint: 'end' },
    ],
  });
  const preview = service.previewProgram('session-1', {
    taskId: task.taskId,
    groundingId: grounding.groundingId,
    program: {
      baseRef: task.baseRef,
      targetHandle: grounding.targetHandle,
      summary: 'Raise right hand',
      objective: '把右手抬起来打招呼',
      operations: [{
        kind: 'connected_transform', translation: [-3, 11],
        interfaceIds: ['right-arm-top:end', 'right-arm-bottom:end'],
      }],
      preserveScopes: [{ kind: 'node-field', nodeId: 'left-hand', fields: ['center'] }],
      postconditions: [{ kind: 'within_bounds', bounds: { minX: -30, minY: -20, maxX: 30, maxY: 30 } }],
      evidenceRefs: ['evidence:right-hand'],
    },
  });
  return { task, observation, context, grounding, preview };
}

describe('SemanticEditService', () => {
  it('previews, evaluates, commits, replays, and undoes the current semantic episode without caller handles', async () => {
    const { service, drawings, storage } = await setup();
    service.projectSelection('session-1', {
      expectedRef: { drawingId: 'drawing-wave', revision: 1 }, nodeIds: ['right-hand'],
    });
    service.bindUserInstruction('session-1', {
      rootUserMessageId: 'message-current-write',
      objective: '把选中的部件向上移动',
      rootUserMessageDigest: 'sha256:message-current-write', numericConstraints: [],
    });
    await service.observeCurrent('session-1');
    service.selectCurrentParts('session-1', {
      parts: [{ partKey: 'moving', label: 'selected part', references: [{ kind: 'current_selection' }] }],
    });
    const intent = {
      summary: 'move the selected part upward',
      goals: [{ kind: 'direction' as const, subject: 'moving', direction: 'up' as const, magnitude: 'moderate' as const }],
      preserve: [{ kind: 'connectivity' as const, partKey: 'moving' }, { kind: 'protected_scope' as const }],
    };

    const preview = service.previewCurrentIntent('session-1', intent);
    const replayedPreview = service.previewCurrentIntent('session-1', intent);
    expect(replayedPreview).toEqual(preview);
    const evaluated = await service.evaluateCurrentPreview('session-1');
    expect(evaluated.assessment.disposition).toBe('auto_safe');
    const committed = service.finalizeCurrentPreview('session-1');
    expect(committed).toMatchObject({ status: 'committed', mode: 'auto-safe', ref: { revision: 2 } });
    expect(service.finalizeCurrentPreview('session-1')).toEqual(committed);
    expect(service.currentSelectedParts('session-1')).toEqual({});
    expect(service.currentGroundingOverlay('session-1')).toBeNull();
    expect(storage.state?.commits.at(-1)?.solverProvenance).toMatchObject({
      solverVersion: 'spatial-intent-solver-0.1.0',
      canonicalIntentDigest: expect.stringMatching(/^sha256:/),
      selectedPartScopeDigests: { moving: expect.stringMatching(/^sha256:/) },
      receipt: { inputsContainModelCoordinates: false },
    });

    if (committed.status !== 'committed') throw new Error('expected commit');
    const undone = service.undoAuthorized('session-1', {
      targetCommitId: committed.commitId,
      expectedCurrentRef: committed.ref,
    });
    expect(undone).toMatchObject({ status: 'committed', mode: 'undo', resultingRef: { revision: 3 } });
    expect(drawings.getSnapshot('session-1')?.document.geometry.find(({ id }) => id === 'right-hand'))
      .toMatchObject({ center: [15, 0] });
  });

  it('replaces a different semantic revision atomically and enforces the per-task candidate budget', async () => {
    const { service } = await setup();
    service.projectSelection('session-1', {
      expectedRef: { drawingId: 'drawing-wave', revision: 1 }, nodeIds: ['left-hand'],
    });
    service.bindUserInstruction('session-1', {
      rootUserMessageId: 'message-current-revision', objective: '调整选中的部件',
      rootUserMessageDigest: 'sha256:message-current-revision', numericConstraints: [],
    });
    await service.observeCurrent('session-1');
    service.selectCurrentParts('session-1', {
      parts: [{ partKey: 'moving', label: 'selected part', references: [{ kind: 'current_selection' }] }],
    });
    const first = service.previewCurrentIntent('session-1', {
      summary: 'move upward',
      goals: [{ kind: 'direction', subject: 'moving', direction: 'up', magnitude: 'slight' }],
      preserve: [],
    });
    const second = service.reviseCurrentIntent('session-1', {
      goalDelta: [{ kind: 'direction', subject: 'moving', direction: 'left', magnitude: 'slight' }],
    });
    expect(second.previewHandle).not.toBe(first.previewHandle);
    expect(() => service.resolveCurrentPreview('session-1', first.previewHandle)).toThrow('EDIT_PREVIEW_STALE');
    service.reviseCurrentIntent('session-1', {
      goalDelta: [{ kind: 'direction', subject: 'moving', direction: 'down', magnitude: 'slight' }],
    });
    expect(() => service.reviseCurrentIntent('session-1', {
      goalDelta: [{ kind: 'direction', subject: 'moving', direction: 'right', magnitude: 'slight' }],
    })).toThrow('EDIT_CANDIDATE_BUDGET_EXHAUSTED');
  });

  it('commits two selected semantic parts in one revision and one undo batch', async () => {
    const { service, drawings } = await setup();
    service.bindUserInstruction('session-1', {
      rootUserMessageId: 'message-current-multi', objective: '把左右两个部件一起向下移动',
      rootUserMessageDigest: 'sha256:message-current-multi', numericConstraints: [],
    });
    await service.observeCurrent('session-1');
    service.selectCurrentParts('session-1', {
      parts: [{
        partKey: 'left', label: 'left part', references: [{ kind: 'semantic_query', text: 'left hand' }],
      }, {
        partKey: 'right', label: 'right part', references: [{ kind: 'semantic_query', text: 'right hand' }],
      }],
    });
    service.previewCurrentIntent('session-1', {
      summary: 'move both parts downward',
      goals: [
        { kind: 'direction', subject: 'left', direction: 'down', magnitude: 'slight' },
        { kind: 'direction', subject: 'right', direction: 'down', magnitude: 'slight' },
      ],
      preserve: [{ kind: 'protected_scope' }],
    });
    await service.evaluateCurrentPreview('session-1');
    const result = service.finalizeCurrentPreview('session-1');
    expect(result).toMatchObject({ status: 'committed', ref: { revision: 2 } });
    if (result.status !== 'committed') throw new Error('expected commit');
    expect(drawings.getSnapshot('session-1')?.document.geometry.find(({ id }) => id === 'left-hand'))
      .toMatchObject({ center: [-15, expect.any(Number)] });
    const undo = service.undoAuthorized('session-1', {
      targetCommitId: result.commitId, expectedCurrentRef: result.ref,
    });
    expect(undo).toMatchObject({ status: 'committed', resultingRef: { revision: 3 } });
    expect(drawings.getSnapshot('session-1')?.document.geometry.find(({ id }) => id === 'left-hand'))
      .toMatchObject({ center: [-15, 0] });
    expect(drawings.getSnapshot('session-1')?.document.geometry.find(({ id }) => id === 'right-hand'))
      .toMatchObject({ center: [15, 0] });
  });

  it('keeps confirmation distinct and clears a discarded current Preview', async () => {
    const { service } = await setup(true);
    service.projectSelection('session-1', {
      expectedRef: { drawingId: 'drawing-wave', revision: 1 }, nodeIds: ['right-hand'],
    });
    service.bindUserInstruction('session-1', {
      rootUserMessageId: 'message-current-confirm', objective: '移动候选来源部件',
      rootUserMessageDigest: 'sha256:message-current-confirm', numericConstraints: [],
    });
    await service.observeCurrent('session-1');
    service.selectCurrentParts('session-1', {
      parts: [{ partKey: 'moving', label: 'candidate part', references: [{ kind: 'current_selection' }] }],
    });
    service.previewCurrentIntent('session-1', {
      summary: 'move candidate upward',
      goals: [{ kind: 'direction', subject: 'moving', direction: 'up', magnitude: 'slight' }],
      preserve: [],
    });
    const evaluated = await service.evaluateCurrentPreview('session-1');
    expect(evaluated.assessment.disposition).toBe('confirmation_required');
    expect(service.finalizeCurrentPreview('session-1')).toMatchObject({
      status: 'rejected', disposition: 'confirmation_required',
    });
    expect(service.discardCurrentPreview('session-1')).toMatchObject({ status: 'discarded' });
    expect(service.currentSelectedParts('session-1')).toEqual({});
  });

  it('does not create a Preview for an already-satisfied goal and invalidates on a concurrent revision', async () => {
    const { service, drawings } = await setup();
    service.bindUserInstruction('session-1', {
      rootUserMessageId: 'message-current-stale', objective: '保持左右部件不相交',
      rootUserMessageDigest: 'sha256:message-current-stale', numericConstraints: [],
    });
    await service.observeCurrent('session-1');
    service.selectCurrentParts('session-1', {
      parts: [{
        partKey: 'left', label: 'left part', references: [{ kind: 'semantic_query', text: 'left hand' }],
      }, {
        partKey: 'right', label: 'right part', references: [{ kind: 'semantic_query', text: 'right hand' }],
      }],
    });
    expect(() => service.previewCurrentIntent('session-1', {
      summary: 'keep the parts from crossing',
      goals: [{
        kind: 'topology', subject: 'left', reference: { kind: 'part', partKey: 'right' },
        relation: 'does_not_cross',
      }],
      preserve: [],
    })).toThrow('EDIT_SPATIAL_ALREADY_SATISFIED');
    expect(drawings.getPreview('session-1')).toBeNull();

    service.previewCurrentIntent('session-1', {
      summary: 'move left part down',
      goals: [{ kind: 'direction', subject: 'left', direction: 'down', magnitude: 'slight' }],
      preserve: [],
    });
    drawings.commit('session-1', {
      expectedRevision: 1,
      commands: [{ type: 'node.update', id: 'body', changes: { visible: false }, expected: { visible: true } }],
    });
    await expect(service.evaluateCurrentPreview('session-1')).rejects.toThrow('EDIT_BASE_STALE');
  });

  it('grounds the current verified selection without exposing Host lineage to the model', async () => {
    const { service } = await setup();
    service.projectSelection('session-1', {
      expectedRef: { drawingId: 'drawing-wave', revision: 1 },
      nodeIds: ['right-hand'],
    });
    service.bindUserInstruction('session-1', {
      rootUserMessageId: 'message-current-selection',
      objective: '把选中的部件向上移动',
      rootUserMessageDigest: 'sha256:message-current-selection',
      numericConstraints: [],
    });

    const observed = await service.observeCurrent('session-1');
    const selected = service.selectCurrentParts('session-1', {
      parts: [{
        partKey: 'part-a',
        label: 'selected part',
        references: [{ kind: 'current_selection' }],
      }],
    });

    expect(observed.state).toBe('observed');
    expect(selected).toMatchObject({
      state: 'selected',
      parts: [{ partKey: 'part-a', label: 'selected part', sourceStatus: 'confirmed', interfaceCount: 2 }],
    });
    expect(JSON.stringify(selected)).not.toMatch(/taskId|groundingId|contextId|nodeIds|right-hand/);
    expect(service.currentSelectedParts('session-1')['part-a']).toMatchObject({
      targetNodeIds: ['right-hand'],
      interfaces: [
        { nodeId: 'right-arm-bottom', endpoint: 'end' },
        { nodeId: 'right-arm-top', endpoint: 'end' },
      ],
    });
    expect(service.currentGroundingLedger('session-1').map(({ kind }) => kind)).toEqual(['proposed', 'selected']);
  });

  it('resolves Observation points and bounded regions into independent semantic parts', async () => {
    const { service } = await setup();
    service.bindUserInstruction('session-1', {
      rootUserMessageId: 'message-observation-selection',
      objective: '移动图中左右两个小圆部件',
      rootUserMessageDigest: 'sha256:message-observation-selection',
      numericConstraints: [],
    });
    await service.observeCurrent('session-1');

    const selected = service.selectCurrentParts('session-1', {
      parts: [{
        partKey: 'part-left',
        label: 'left circular part',
        references: [{
          kind: 'observation_region',
          polygon: [[0.18, 0.48], [0.32, 0.48], [0.32, 0.72], [0.18, 0.72]],
        }],
      }, {
        partKey: 'part-right',
        label: 'right circular part',
        references: [{ kind: 'observation_point', normalized: [0.75, 0.6] }],
      }],
    });

    expect(selected.state).toBe('selected');
    expect(service.currentSelectedParts('session-1')).toMatchObject({
      'part-left': { targetNodeIds: ['left-hand'] },
      'part-right': { targetNodeIds: ['right-hand'] },
    });
  });

  it('publishes episode-bound short candidates so opaque geometry ids never enter model context', async () => {
    const { service } = await setup();
    service.bindUserInstruction('session-1', {
      rootUserMessageId: 'message-short-candidates',
      objective: '选择画面左右两侧的圆形部件',
      rootUserMessageDigest: 'sha256:message-short-candidates',
      numericConstraints: [],
    });

    const observed = await service.observeCurrent('session-1');
    const left = observed.selectionCandidates.find(({ summary }) => (
      summary.includes('circle') && summary.includes('middle-left')
    ));
    const right = observed.selectionCandidates.find(({ summary }) => (
      summary.includes('circle') && summary.includes('middle-right')
    ));

    expect(left?.key).toMatch(/^c\d+$/);
    expect(right?.key).toMatch(/^c\d+$/);
    expect(JSON.stringify(observed.selectionCandidates)).not.toMatch(/left-hand|right-hand|node_/);
    expect((await service.observeCurrent('session-1')).selectionCandidates)
      .toEqual(observed.selectionCandidates);

    const selected = service.selectCurrentParts('session-1', {
      parts: [{
        partKey: 'left-part', label: 'left circular part',
        references: [{ kind: 'candidate', key: left!.key }],
      }, {
        partKey: 'right-part', label: 'right circular part',
        references: [{ kind: 'candidate', key: right!.key }],
      }],
    });
    expect(selected).toMatchObject({
      state: 'selected',
      parts: [{ partKey: 'left-part', nodeCount: 1 }, { partKey: 'right-part', nodeCount: 1 }],
    });
  });

  it('falls back from an ungrounded semantic phrase to bounded visual candidates', async () => {
    const { service } = await setup();
    service.bindUserInstruction('session-1', {
      rootUserMessageId: 'message-semantic-fallback', objective: '选择画面左侧的目标部件',
      rootUserMessageDigest: 'sha256:message-semantic-fallback', numericConstraints: [],
    });
    await service.observeCurrent('session-1');

    const result = service.selectCurrentParts('session-1', {
      parts: [{
        partKey: 'target', label: 'semantic target',
        references: [{ kind: 'semantic_query', text: 'opaque semantic component' }],
      }],
    });

    expect(result).toMatchObject({ state: 'selection_ambiguous', partKey: 'target' });
    if (result.state !== 'selection_ambiguous') throw new Error('expected visual candidates');
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates.every(({ key, summary }) => (
      /^c\d+$/.test(key) && summary.length > 0
    ))).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/left-hand|node_/);
  });

  it('treats one visual region as one multi-node part and applies model-click hit slop', async () => {
    const { service } = await setup();
    service.bindUserInstruction('session-1', {
      rootUserMessageId: 'message-region-group', objective: '选择右侧组合部件',
      rootUserMessageDigest: 'sha256:message-region-group', numericConstraints: [],
    });
    await service.observeCurrent('session-1');

    const grouped = service.selectCurrentParts('session-1', {
      parts: [{
        partKey: 'right-group', label: 'right connected group',
        references: [{
          kind: 'observation_region',
          polygon: [[0.62, 0.50], [0.82, 0.50], [0.82, 0.68], [0.62, 0.68]],
        }],
      }],
    });
    expect(grouped).toMatchObject({
      state: 'selected', parts: [{ partKey: 'right-group', nodeCount: 3 }],
    });

    service.bindUserInstruction('session-1', {
      rootUserMessageId: 'message-hit-slop', objective: '选择左侧圆形部件',
      rootUserMessageDigest: 'sha256:message-hit-slop', numericConstraints: [],
    });
    await service.observeCurrent('session-1');
    const nearMiss = service.selectCurrentParts('session-1', {
      parts: [{
        partKey: 'left-part', label: 'left circular part',
        references: [{ kind: 'observation_point', normalized: [0.18, 0.6] }],
      }],
    });
    expect(nearMiss).toMatchObject({
      state: 'selected', parts: [{ partKey: 'left-part', nodeCount: 1 }],
    });
  });

  it('rejects Preview before any semantic part is selected', async () => {
    const { service } = await setup();
    service.bindUserInstruction('session-1', {
      rootUserMessageId: 'message-selection-gate', objective: '移动一个部件',
      rootUserMessageDigest: 'sha256:message-selection-gate', numericConstraints: [],
    });
    await service.observeCurrent('session-1');

    expect(() => service.previewCurrentIntent('session-1', {
      summary: 'move part upward',
      goals: [{ kind: 'direction', subject: 'part', direction: 'up', magnitude: 'moderate' }],
      preserve: [],
    })).toThrow('EDIT_SELECTION_REQUIRED');
  });

  it('returns short ambiguous candidates and accepts only a current-episode candidate key', async () => {
    const { service } = await setup();
    service.bindUserInstruction('session-1', {
      rootUserMessageId: 'message-ambiguous-selection',
      objective: '选择右侧接触位置的部件',
      rootUserMessageDigest: 'sha256:message-ambiguous-selection',
      numericConstraints: [],
    });
    await service.observeCurrent('session-1');

    const ambiguous = service.selectCurrentParts('session-1', {
      parts: [{
        partKey: 'part-a',
        label: 'contacted part',
        references: [{ kind: 'observation_point', normalized: [0.7127322, 0.56] }],
      }],
    });

    expect(ambiguous).toMatchObject({ state: 'selection_ambiguous', partKey: 'part-a' });
    if (ambiguous.state !== 'selection_ambiguous') throw new Error('expected ambiguity');
    expect(ambiguous.candidates.length).toBeGreaterThan(1);
    expect(ambiguous.candidates.every(({ key }) => /^c\d+$/.test(key))).toBe(true);
    expect(JSON.stringify(ambiguous)).not.toMatch(/right-hand|right-arm|groundingId|nodeIds/);

    const selected = service.selectCurrentParts('session-1', {
      parts: [{
        partKey: 'part-a',
        label: 'contacted part',
        references: [{ kind: 'candidate', key: ambiguous.candidates[0]!.key }],
      }],
    });
    expect(selected.state).toBe('selected');
    const expired = service.selectCurrentParts('session-1', {
      parts: [{
        partKey: 'part-b',
        label: 'stale candidate',
        references: [{ kind: 'candidate', key: ambiguous.candidates[0]!.key }],
      }],
    });
    expect(expired).toMatchObject({ state: 'invalid_state', code: 'EDIT_CANDIDATE_EXPIRED' });
  });

  it('applies semantic-query exclusions and fails closed across sessions or revisions', async () => {
    const { service, drawings } = await setup();
    service.bindUserInstruction('session-1', {
      rootUserMessageId: 'message-query-selection',
      objective: '选择右侧的手部圆，不要手臂线',
      rootUserMessageDigest: 'sha256:message-query-selection',
      numericConstraints: [],
    });
    await service.observeCurrent('session-1');

    const selected = service.selectCurrentParts('session-1', {
      parts: [{
        partKey: 'part-right',
        label: 'right circular component',
        references: [{ kind: 'semantic_query', text: 'right' }],
        exclude: [{ kind: 'semantic_query', value: 'arm' }],
      }],
    });
    expect(selected.state).toBe('selected');
    expect(service.currentSelectedParts('session-1')['part-right']?.targetNodeIds).toEqual(['right-hand']);
    expect(service.selectCurrentParts('session-2', {
      parts: [{ partKey: 'part-x', label: 'other', references: [{ kind: 'candidate', key: 'c1' }] }],
    })).toMatchObject({ state: 'invalid_state' });

    drawings.commit('session-1', {
      expectedRevision: 1,
      commands: [{ type: 'node.update', id: 'body', changes: { visible: false }, expected: { visible: true } }],
    });
    expect(service.selectCurrentParts('session-1', {
      parts: [{ partKey: 'part-x', label: 'stale', references: [{ kind: 'semantic_query', text: 'left' }] }],
    })).toMatchObject({ state: 'reobserve_required' });
    await expect(service.observeCurrent('session-1')).resolves.toMatchObject({
      state: 'observed', drawing: { drawingId: 'drawing-wave', revision: 2 },
    });
  });

  it('projects named Groundings as transient groups and replaces only the same part key', async () => {
    const { service } = await setup();
    const task = service.startTask('session-1', {
      objective: 'Move two independent components',
      rootUserMessageDigest: 'sha256:multi-overlay',
      policy: 'auto-safe',
    });
    const observation = await service.observe('session-1', { taskId: task.taskId });
    const context = service.buildContext('session-1', {
      taskId: task.taskId, observationId: observation.observationId,
    });
    expect(context.coordinateSystem).toEqual({
      space: 'world',
      positiveX: 'right',
      positiveY: 'up',
      negativeX: 'left',
      negativeY: 'down',
      positiveRotation: 'counterclockwise',
      modelRotationUnit: 'degrees',
    });

    service.ground('session-1', {
      taskId: task.taskId, contextId: context.contextId,
      targetNodeIds: ['left-hand'], interfaces: [],
      partKey: 'part-a', label: 'Part A',
    });
    service.ground('session-1', {
      taskId: task.taskId, contextId: context.contextId,
      targetNodeIds: ['right-hand'], interfaces: [],
      partKey: 'part-b', label: 'Part B',
    });

    const first = service.currentGroundingOverlay('session-1');
    expect(first).toMatchObject({
      version: 1,
      drawingRef: task.baseRef,
      taskId: task.taskId,
      groups: [
        { partKey: 'part-a', label: 'Part A', colorIndex: 0, nodeIds: ['left-hand'] },
        { partKey: 'part-b', label: 'Part B', colorIndex: 1, nodeIds: ['right-hand'] },
      ],
    });

    service.ground('session-1', {
      taskId: task.taskId, contextId: context.contextId,
      targetNodeIds: ['left-hand'], interfaces: [],
      partKey: 'part-a', label: 'Part A refined',
    });
    expect(service.currentGroundingOverlay('session-1')?.groups).toMatchObject([
      { partKey: 'part-a', label: 'Part A refined', colorIndex: 0 },
      { partKey: 'part-b', label: 'Part B', colorIndex: 1 },
    ]);

    if (!first) throw new Error('overlay missing');
    first.groups[0]!.label = 'caller mutation';
    expect(service.currentGroundingOverlay('session-1')?.groups[0]?.label).toBe('Part A refined');
  });

  it('lets a legacy Grounding replace named groups and clears them for a new task', async () => {
    const { service } = await setup();
    const task = service.startTask('session-1', {
      objective: 'Inspect components', rootUserMessageDigest: 'sha256:legacy-overlay', policy: 'auto-safe',
    });
    const observation = await service.observe('session-1', { taskId: task.taskId });
    const context = service.buildContext('session-1', { taskId: task.taskId, observationId: observation.observationId });
    service.ground('session-1', {
      taskId: task.taskId, contextId: context.contextId,
      targetNodeIds: ['left-hand'], interfaces: [], partKey: 'part-a', label: 'Part A',
    });
    service.ground('session-1', {
      taskId: task.taskId, contextId: context.contextId,
      targetNodeIds: ['right-hand'], interfaces: [],
    });
    expect(service.currentGroundingOverlay('session-1')?.groups).toHaveLength(1);
    expect(service.currentGroundingOverlay('session-1')?.groups[0]?.nodeIds).toEqual(['right-hand']);

    service.startTask('session-1', {
      objective: 'Start another task', rootUserMessageDigest: 'sha256:new-task', policy: 'auto-safe',
    });
    expect(service.currentGroundingOverlay('session-1')).toBeNull();
  });

  it('creates one Preview for multiple exact Groundings and clears Overlay on discard', async () => {
    const { service, drawings } = await setup();
    const task = service.startTask('session-1', {
      objective: 'Move two independent components',
      rootUserMessageDigest: 'sha256:multi-preview', policy: 'auto-safe',
    });
    const observation = await service.observe('session-1', { taskId: task.taskId });
    const context = service.buildContext('session-1', { taskId: task.taskId, observationId: observation.observationId });
    const left = service.ground('session-1', {
      taskId: task.taskId, contextId: context.contextId,
      targetNodeIds: ['left-hand'], interfaces: [], partKey: 'part-a', label: 'Part A',
    });
    const right = service.ground('session-1', {
      taskId: task.taskId, contextId: context.contextId,
      targetNodeIds: ['right-hand'], interfaces: [], partKey: 'part-b', label: 'Part B',
    });

    const preview = service.previewMultiPartTransform('session-1', {
      taskId: task.taskId,
      summary: 'Move two components',
      parts: [
        { groundingId: left.groundingId, translation: [3, -5] },
        { groundingId: right.groundingId, translation: [-3, 11] },
      ],
    });

    expect(preview.groundingIds).toEqual([left.groundingId, right.groundingId]);
    expect(drawings.getPreview('session-1')?.candidate.document.geometry
      .find(({ id }) => id === 'left-hand')).toMatchObject({ center: [-12, -5] });
    expect(drawings.getPreview('session-1')?.candidate.document.geometry
      .find(({ id }) => id === 'right-hand')).toMatchObject({ center: [12, 11] });
    expect(service.currentGroundingOverlay('session-1')).toBeNull();

    service.discardPreview('session-1', preview.previewHandle);
    expect(service.currentGroundingOverlay('session-1')).toBeNull();
  });

  it('evaluates, commits, and undoes a multi-part transform as one revision', async () => {
    const { service, drawings } = await setup();
    const task = service.startTask('session-1', {
      objective: 'Move two independent components in opposite directions',
      rootUserMessageDigest: 'sha256:multi-round-trip', policy: 'auto-safe',
    });
    const observation = await service.observe('session-1', { taskId: task.taskId });
    const context = service.buildContext('session-1', {
      taskId: task.taskId, observationId: observation.observationId,
    });
    const left = service.ground('session-1', {
      taskId: task.taskId, contextId: context.contextId,
      targetNodeIds: ['left-hand'], interfaces: [], partKey: 'part-a', label: 'Part A',
    });
    const right = service.ground('session-1', {
      taskId: task.taskId, contextId: context.contextId,
      targetNodeIds: ['right-hand'], interfaces: [], partKey: 'part-b', label: 'Part B',
    });
    const preview = service.previewMultiPartTransform('session-1', {
      taskId: task.taskId, summary: 'Opposing component motion',
      parts: [
        { groundingId: left.groundingId, translation: [3, -5] },
        { groundingId: right.groundingId, translation: [-3, 11] },
      ],
    });

    const evaluated = await service.evaluatePreview('session-1', {
      taskId: task.taskId,
      previewHandle: preview.previewHandle,
      candidateDigest: preview.candidateDigest,
    });
    expect(evaluated.assessment.disposition).toBe('auto_safe');
    const committed = service.finalizePreview('session-1', {
      previewHandle: preview.previewHandle,
      previewDigest: preview.candidateDigest,
      finalizeOperationId: preview.finalizeOperationId,
      finalizeOperationBindingDigest: preview.finalizeOperationBindingDigest,
      evaluationId: evaluated.evaluation.evaluationId,
    });

    expect(committed).toMatchObject({ status: 'committed', ref: { revision: 2 } });
    expect(drawings.getSnapshot('session-1')?.document.geometry
      .find(({ id }) => id === 'left-hand')).toMatchObject({ center: [-12, -5] });
    expect(drawings.getSnapshot('session-1')?.document.geometry
      .find(({ id }) => id === 'right-hand')).toMatchObject({ center: [12, 11] });
    if (committed.status !== 'committed') throw new Error('expected committed multi-part edit');
    expect(service.undo('session-1', {
      targetCommitId: committed.commitId,
      expectedCurrentRef: committed.ref,
      operationId: 'undo-multi-1',
      operationBindingDigest: 'sha256:undo-multi-binding',
    })).toMatchObject({ status: 'committed', resultingRef: { revision: 3 } });
    expect(drawings.getSnapshot('session-1')?.document.geometry
      .find(({ id }) => id === 'left-hand')).toMatchObject({ center: [-15, 0] });
    expect(drawings.getSnapshot('session-1')?.document.geometry
      .find(({ id }) => id === 'right-hand')).toMatchObject({ center: [15, 0] });
  });

  it('atomically replaces a multi-part Preview during visual revision', async () => {
    const { service, drawings } = await setup();
    const task = service.startTask('session-1', {
      objective: 'Move two independent components', rootUserMessageDigest: 'sha256:multi-revise', policy: 'auto-safe',
    });
    const observation = await service.observe('session-1', { taskId: task.taskId });
    const context = service.buildContext('session-1', { taskId: task.taskId, observationId: observation.observationId });
    const left = service.ground('session-1', {
      taskId: task.taskId, contextId: context.contextId,
      targetNodeIds: ['left-hand'], interfaces: [], partKey: 'part-a', label: 'Part A',
    });
    const right = service.ground('session-1', {
      taskId: task.taskId, contextId: context.contextId,
      targetNodeIds: ['right-hand'], interfaces: [], partKey: 'part-b', label: 'Part B',
    });
    const first = service.previewMultiPartTransform('session-1', {
      taskId: task.taskId, summary: 'First pose',
      parts: [
        { groundingId: left.groundingId, translation: [3, -5] },
        { groundingId: right.groundingId, translation: [-3, 11] },
      ],
    });

    const revised = service.reviseMultiPartTransform('session-1', {
      taskId: task.taskId,
      currentPreviewHandle: first.previewHandle,
      currentCandidateDigest: first.candidateDigest,
      summary: 'Smaller pose',
      parts: [
        { groundingId: left.groundingId, translation: [2, -3] },
        { groundingId: right.groundingId, translation: [-2, 8] },
      ],
    });

    expect(revised.previewHandle).not.toBe(first.previewHandle);
    expect(drawings.getPreview('session-1')?.handle).toBe(revised.previewHandle);
    expect(() => service.discardPreview('session-1', first.previewHandle)).toThrow('EDIT_PREVIEW_STALE');
  });

  it('treats an empty optional selectionProjectionId as omitted for model-generated grounding input', async () => {
    const { service } = await setup();
    const task = service.startTask('session-1', {
      objective: '把右手抬起来打招呼',
      rootUserMessageDigest: 'sha256:empty-selection-handle',
      policy: 'auto-safe',
    });
    const observation = await service.observe('session-1', { taskId: task.taskId });
    const context = service.buildContext('session-1', {
      taskId: task.taskId,
      observationId: observation.observationId,
    });

    const grounding = service.ground('session-1', {
      taskId: task.taskId,
      contextId: context.contextId,
      selectionProjectionId: '',
      targetNodeIds: ['right-hand'],
      interfaces: [],
    });

    expect(grounding.targetNodeIds).toEqual(['right-hand']);
    expect(grounding.interfaces).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: 'right-arm-top', endpoint: 'end' }),
      expect.objectContaining({ nodeId: 'right-arm-bottom', endpoint: 'end' }),
    ]));
  });

  it('builds a complete connected transform Preview from simple model-facing transform fields', async () => {
    const { service, drawings } = await setup();
    const projected = service.projectSelection('session-1', {
      expectedRef: { drawingId: 'drawing-wave', revision: 1 },
      nodeIds: ['right-hand'],
    });
    if (projected.status !== 'projected') throw new Error('selection projection missing');
    const task = service.startTask('session-1', {
      objective: '把选中的右手抬起来打招呼',
      rootUserMessageDigest: 'sha256:simple-transform',
      policy: 'auto-safe',
    });
    const observation = await service.observe('session-1', { taskId: task.taskId });
    const context = service.buildContext('session-1', {
      taskId: task.taskId,
      observationId: observation.observationId,
    });
    const grounding = service.ground('session-1', {
      taskId: task.taskId,
      contextId: context.contextId,
      selectionProjectionId: projected.projection.selectionProjectionId,
      targetNodeIds: [],
      interfaces: [],
    });

    const preview = service.previewGroundedTransform('session-1', {
      taskId: task.taskId,
      groundingId: grounding.groundingId,
      translation: [-3, 11],
      rotationDegrees: -60,
      summary: 'Raise the selected hand to wave',
    });

    expect(preview).toMatchObject({ taskId: task.taskId, baseRef: task.baseRef });
    expect(drawings.getPreview('session-1')?.candidate.document.geometry
      .find(({ id }) => id === 'right-hand')).toMatchObject({ center: [12, 11] });

    const revised = service.reviseGroundedTransform('session-1', {
      taskId: task.taskId,
      currentPreviewHandle: preview.previewHandle,
      currentCandidateDigest: preview.candidateDigest,
      groundingId: grounding.groundingId,
      translation: [-2, 8],
      rotationDegrees: -35,
      summary: 'Use a smaller wave motion',
    });
    expect(revised.previewHandle).not.toBe(preview.previewHandle);
    expect(drawings.getPreview('session-1')?.candidate.document.geometry
      .find(({ id }) => id === 'right-hand')).toMatchObject({ center: [13, 8] });
  });

  it('clears the Host selection projection when the canvas deselects everything', async () => {
    const { service } = await setup();
    const expectedRef = { drawingId: 'drawing-wave', revision: 1 };

    expect(service.projectSelection('session-1', { expectedRef, nodeIds: ['right-hand'] }).status).toBe('projected');
    expect(service.currentSelectionProjection('session-1')).not.toBeNull();

    expect(service.projectSelection('session-1', { expectedRef, nodeIds: [] })).toEqual({ status: 'cleared' });
    expect(service.currentSelectionProjection('session-1')).toBeNull();
  });

  it('projects the exact canvas selection into grounding and resolves contacted connector endpoints', async () => {
    let reviewedAfter: unknown;
    const { service, drawings } = await setup(false, async (input) => {
      reviewedAfter = input.afterDocument.geometry.find(({ id }) => id === 'right-hand');
      return {
        outcome: 'satisfied', defects: [],
        render: {
          rendererVersion: 'vectorai-review-svg-v1', contentDigest: 'sha256:comparison',
          width: 1280, height: 720, comparisonLayout: 'before | after',
          worldToImage: [1, 0, 0, -1, 0, 720], overlays: ['changed-nodes', 'motion-vectors'],
          attachment: {
            attachmentId: 'comparison-image' as never,
            mediaType: 'image/png', bytes: 10, width: 1280, height: 720,
          },
        },
      };
    });
    const projected = service.projectSelection('session-1', {
      expectedRef: { drawingId: 'drawing-wave', revision: 1 },
      nodeIds: ['right-hand'],
    });
    expect(projected).toMatchObject({
      status: 'projected',
      projection: {
        drawingRef: { drawingId: 'drawing-wave', revision: 1 },
        nodeIds: ['right-hand'],
      },
    });
    if (projected.status !== 'projected') throw new Error('selection projection missing');

    const task = service.startTask('session-1', {
      objective: '把选中的右手抬起来打招呼',
      rootUserMessageDigest: 'sha256:selected-wave',
      policy: 'auto-safe',
    });
    const observation = await service.observe('session-1', { taskId: task.taskId });
    expect(observation.selectionProjectionId).toBe(projected.projection.selectionProjectionId);
    const context = service.buildContext('session-1', {
      taskId: task.taskId,
      observationId: observation.observationId,
    });
    const grounding = service.ground('session-1', {
      taskId: task.taskId,
      contextId: context.contextId,
      selectionProjectionId: projected.projection.selectionProjectionId,
      targetNodeIds: [],
      interfaces: [],
    });

    expect(grounding.targetNodeIds).toEqual(['right-hand']);
    expect(grounding.interfaces).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: 'right-arm-top', endpoint: 'end' }),
      expect.objectContaining({ nodeId: 'right-arm-bottom', endpoint: 'end' }),
    ]));

    const preview = service.previewProgram('session-1', {
      taskId: task.taskId,
      groundingId: grounding.groundingId,
      program: {
        baseRef: task.baseRef,
        targetHandle: grounding.targetHandle,
        summary: 'Raise selected hand',
        objective: '把选中的右手抬起来打招呼',
        operations: [{
          kind: 'connected_transform', translation: [-3, 11],
          interfaceIds: grounding.interfaces.map(({ interfaceId }) => interfaceId),
        }],
        preserveScopes: [{ kind: 'node-field', nodeId: 'left-hand', fields: ['center'] }],
        postconditions: [{ kind: 'within_bounds', bounds: { minX: -30, minY: -20, maxX: 30, maxY: 30 } }],
        evidenceRefs: [projected.projection.projectionDigest],
      },
    });
    const evaluated = await service.evaluatePreview('session-1', {
      taskId: task.taskId,
      previewHandle: preview.previewHandle,
      candidateDigest: preview.candidateDigest,
    });
    expect(evaluated.assessment.disposition).toBe('auto_safe');
    expect(evaluated.evaluation.review.renderManifest).toMatchObject({
      rendererVersion: 'vectorai-review-svg-v1',
      artifactContentDigest: 'sha256:comparison',
      width: 1280,
      height: 720,
    });
    expect(evaluated.imageAttachment).toMatchObject({ attachmentId: 'comparison-image' });
    const committed = service.finalizePreview('session-1', {
      previewHandle: preview.previewHandle,
      previewDigest: preview.candidateDigest,
      finalizeOperationId: preview.finalizeOperationId,
      finalizeOperationBindingDigest: preview.finalizeOperationBindingDigest,
      evaluationId: evaluated.evaluation.evaluationId,
    });
    expect(committed).toMatchObject({ status: 'committed', mode: 'auto-safe' });
    expect(reviewedAfter).toMatchObject({ center: [12, 11] });
    expect(drawings.getSnapshot('session-1')?.ref.revision).toBe(2);
  });

  it('runs the right-hand edit through Preview, evaluation, auto-safe commit, and Undo', async () => {
    const { service, drawings, storage } = await setup();
    const { preview } = await previewRightHand(service);

    expect(drawings.getSnapshot('session-1')?.ref.revision).toBe(1);
    expect(drawings.getPreview('session-1')?.candidate.document.geometry
      .find(({ id }) => id === 'right-hand')).toMatchObject({ center: [12, 11] });

    const evaluation = await service.evaluatePreview('session-1', {
      taskId: preview.taskId,
      previewHandle: preview.previewHandle,
      candidateDigest: preview.candidateDigest,
    });
    expect(evaluation.assessment.disposition).toBe('auto_safe');

    const finalized = service.finalizePreview('session-1', {
      previewHandle: preview.previewHandle,
      previewDigest: preview.candidateDigest,
      finalizeOperationId: preview.finalizeOperationId,
      finalizeOperationBindingDigest: preview.finalizeOperationBindingDigest,
      evaluationId: evaluation.evaluation.evaluationId,
    });

    expect(finalized).toMatchObject({ status: 'committed', mode: 'auto-safe', ref: { revision: 2 } });
    expect(drawings.getSnapshot('session-1')?.document.geometry
      .find(({ id }) => id === 'right-hand')).toMatchObject({ center: [12, 11] });
    expect(storage.state?.commits[0]).toMatchObject({ mode: 'auto-safe' });

    if (finalized.status !== 'committed') throw new Error('expected committed finalize');
    const undone = service.undo('session-1', {
      targetCommitId: finalized.commitId,
      expectedCurrentRef: finalized.ref,
      operationId: 'undo-1',
      operationBindingDigest: 'sha256:undo-binding',
    });
    expect(undone.status).toBe('committed');
    expect(drawings.getSnapshot('session-1')?.document.geometry
      .find(({ id }) => id === 'right-hand')).toMatchObject({ center: [15, 0] });
  });

  it('requires confirmation for provisional source and does not mutate formal state', async () => {
    const { service, drawings } = await setup(true);
    const { preview } = await previewRightHand(service);
    const evaluation = await service.evaluatePreview('session-1', {
      taskId: preview.taskId,
      previewHandle: preview.previewHandle,
      candidateDigest: preview.candidateDigest,
    });

    expect(evaluation.assessment).toMatchObject({
      disposition: 'confirmation_required',
      reasons: expect.arrayContaining(['SOURCE_NOT_CONFIRMED']),
    });
    expect(service.finalizePreview('session-1', {
      previewHandle: preview.previewHandle,
      previewDigest: preview.candidateDigest,
      finalizeOperationId: preview.finalizeOperationId,
      finalizeOperationBindingDigest: preview.finalizeOperationBindingDigest,
      evaluationId: evaluation.evaluation.evaluationId,
    })).toMatchObject({ status: 'rejected', disposition: 'confirmation_required' });
    expect(drawings.getSnapshot('session-1')?.ref.revision).toBe(1);
  });

  it('invalidates the former task Preview when a new direct task starts', async () => {
    const { service, drawings } = await setup();
    const { preview } = await previewRightHand(service);

    service.startTask('session-1', {
      objective: 'Inspect the body', rootUserMessageDigest: 'sha256:new-message', policy: 'review',
    });

    expect(drawings.getPreview('session-1')).toBeNull();
    expect(() => service.finalizePreview('session-1', {
      previewHandle: preview.previewHandle,
      previewDigest: preview.candidateDigest,
      finalizeOperationId: preview.finalizeOperationId,
      finalizeOperationBindingDigest: preview.finalizeOperationBindingDigest,
      evaluationId: 'evaluation-old',
    })).toThrow('EDIT_TASK_STALE');
  });

  it('revises the current candidate atomically and makes the former Preview unusable', async () => {
    const { service, drawings } = await setup();
    const { task, grounding, preview } = await previewRightHand(service);
    const revised = service.revisePreview('session-1', {
      taskId: task.taskId,
      currentPreviewHandle: preview.previewHandle,
      currentCandidateDigest: preview.candidateDigest,
      groundingId: grounding.groundingId,
      program: {
        baseRef: task.baseRef,
        targetHandle: grounding.targetHandle,
        summary: 'Raise right hand a little less',
        objective: '把右手抬起来打招呼',
        operations: [{
          kind: 'connected_transform', translation: [-2, 10], rotationRadians: 0,
          pivot: [15, 0], interfaceIds: ['right-arm-top:end', 'right-arm-bottom:end'],
        }],
        preserveScopes: [{ kind: 'node-field', nodeId: 'left-hand', fields: ['center'] }],
        postconditions: [{ kind: 'within_bounds', bounds: { minX: -30, minY: -20, maxX: 30, maxY: 30 } }],
        evidenceRefs: ['evidence:right-hand'],
      },
    });

    expect(revised.previewHandle).not.toBe(preview.previewHandle);
    expect(drawings.getPreview('session-1')?.handle).toBe(revised.previewHandle);
    expect(() => service.discardPreview('session-1', preview.previewHandle)).toThrow('EDIT_PREVIEW_STALE');
  });

  it('joins concurrent reviews and keeps a negative result sticky for the same semantic candidate', async () => {
    let reviewCalls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const { service } = await setup(false, async () => {
      reviewCalls += 1;
      await gate;
      return {
        outcome: 'needs_revision',
        defects: [{ code: 'HAND_POSE', reason: 'The greeting pose is unclear.', scopeDigest: 'sha256:scope' }],
      };
    });
    const { preview } = await previewRightHand(service);
    const request = {
      taskId: preview.taskId,
      previewHandle: preview.previewHandle,
      candidateDigest: preview.candidateDigest,
    };
    const first = service.evaluatePreview('session-1', request);
    const second = service.evaluatePreview('session-1', request);
    await Promise.resolve();
    expect(reviewCalls).toBe(1);
    release();

    const [a, b] = await Promise.all([first, second]);
    expect(a.assessment.disposition).toBe('confirmation_required');
    expect(b.assessment.disposition).toBe('confirmation_required');
    await service.evaluatePreview('session-1', request);
    expect(reviewCalls).toBe(1);
  });
});

function checksum(value: string): number {
  let result = 0;
  for (const character of value) result = (result * 33 + character.charCodeAt(0)) >>> 0;
  return result;
}
