import { describe, expect, it, vi } from 'vitest';

import {
  type DrawingTransaction,
  type GeometryId,
  type IdFactory,
  MemoryDrawingRepository,
} from '../../../src/drawing/index';
import { DrawingApplication } from '../drawing-application/application';
import {
  DRAWING_TOOL_DEFINITIONS,
  DrawingToolRegistry,
} from './tool-registry';
import type { DrawingToolContext } from './types';

function ids(): IdFactory {
  const counts = new Map<string, number>();
  return { next: (kind) => {
    const next = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, next);
    return `${kind}_${next}`;
  } };
}

async function setup() {
  const idFactory = ids();
  const repository = new MemoryDrawingRepository({ idFactory, now: () => 100 });
  const application = new DrawingApplication({ repository, idFactory, now: () => 1 });
  const workspace = await application.create();
  const context: DrawingToolContext = {
    runId: 'run_1',
    drawingId: workspace.document.id,
    revision: workspace.revision,
    actor: { type: 'AI', id: 'drawing-agent' },
    goalId: 'goal_1',
  };
  const registry = new DrawingToolRegistry({
    application,
    idFactory,
    now: (() => {
      let time = 10;
      return () => time += 5;
    })(),
  });
  return { application, context, registry, workspace };
}

describe('DrawingToolRegistry', () => {
  it('publishes one versioned definition per supported capability', () => {
    expect(DRAWING_TOOL_DEFINITIONS.map((definition) => definition.capability)).toEqual([
      'query_entities',
      'inspect_entity',
      'preview_transaction',
      'commit_transaction',
      'verify_goal',
    ]);
    expect(new Set(DRAWING_TOOL_DEFINITIONS.map((definition) => (
      `${definition.capability}@${definition.version}`
    ))).size).toBe(DRAWING_TOOL_DEFINITIONS.length);
    expect(DRAWING_TOOL_DEFINITIONS).toEqual(expect.arrayContaining([
      expect.objectContaining({ capability: 'query_entities', access: 'read', caller: 'model' }),
      expect.objectContaining({ capability: 'commit_transaction', access: 'write', caller: 'runtime' }),
    ]));
    expect(DRAWING_TOOL_DEFINITIONS.every((definition) => (
      definition.version === '1.0.0' && definition.timeoutMs > 0
    ))).toBe(true);
  });

  it('rejects malformed input before calling the Drawing Application', async () => {
    const application = {
      query: vi.fn(), inspect: vi.fn(), preview: vi.fn(), execute: vi.fn(),
    };
    const registry = new DrawingToolRegistry({ application });

    const result = await registry.invoke({
      capability: 'query_entities',
      caller: 'model',
      toolCallId: 'call_bad',
      context: contextStub(),
      input: { selector: { limit: 0 }, secret: 'must-not-pass' },
    });

    expect(application.query).not.toHaveBeenCalled();
    expect(result.receipt).toMatchObject({
      capability: 'query_entities',
      status: 'rejected',
      outcome: { kind: 'error', codes: ['INVALID_TOOL_INPUT'] },
      retry: { allowed: true, action: 'replan' },
    });
    expect(JSON.stringify(result.receipt)).not.toContain('must-not-pass');
  });

  it('runs bounded read tools without mutating the drawing', async () => {
    const { application, context, registry, workspace } = await setup();
    await application.execute({
      drawingId: workspace.document.id,
      transaction: circleTransaction(workspace.revision, 'circle_read'),
    });
    const current = await application.open(workspace.document.id);

    const queried = await registry.invoke({
      capability: 'query_entities', toolCallId: 'call_query',
      caller: 'model',
      context: { ...context, revision: current.revision },
      input: { selector: { plane: 'geometry', types: ['circle'], limit: 10 } },
    });
    const inspected = await registry.invoke({
      capability: 'inspect_entity', toolCallId: 'call_inspect',
      caller: 'model',
      context: { ...context, revision: current.revision },
      input: { nodeId: 'circle_read' },
    });

    expect(queried).toMatchObject({
      receipt: {
        status: 'succeeded', revisionBefore: current.revision,
        revisionAfter: current.revision, affectedNodeIds: ['circle_read'],
        outcome: { kind: 'query', count: 1, truncated: false },
      },
      output: { items: [{ id: 'circle_read', type: 'circle' }], truncated: false },
    });
    expect(inspected).toMatchObject({
      receipt: { status: 'succeeded', outcome: { kind: 'inspect', found: true } },
      output: { node: { id: 'circle_read', type: 'circle' } },
    });
    expect((await application.open(workspace.document.id)).commits).toHaveLength(1);
  });

  it('previews without persistence and keeps the prepared transaction out of the receipt', async () => {
    const { application, context, registry, workspace } = await setup();

    const result = await registry.invoke({
      capability: 'preview_transaction', toolCallId: 'call_preview', context,
      caller: 'model',
      input: {
        commands: circleTransaction(context.revision, 'circle_preview').commands,
        postconditions: [{ type: 'node.exists', nodeId: 'circle_preview' }],
      },
    });

    expect(result).toMatchObject({
      receipt: {
        status: 'succeeded', revisionBefore: context.revision,
        revisionAfter: context.revision, affectedNodeIds: ['circle_preview'],
        outcome: {
          kind: 'preview', candidate: false, validationValid: true, goalSatisfied: true,
        },
      },
      prepared: { runId: context.runId, drawingId: context.drawingId },
    });
    expect(result.prepared?.handle).toEqual(expect.any(String));
    expect(result.previewDocument?.geometry).toEqual([
      expect.objectContaining({ id: 'circle_preview', type: 'circle' }),
    ]);
    expect(JSON.stringify(result.receipt)).not.toContain(result.prepared!.handle);
    expect(JSON.stringify(result.receipt)).not.toContain('resultingDocument');
    expect((await application.open(workspace.document.id)).commits).toEqual([]);
  });

  it('only commits a prepared transaction in its owning run and consumes the handle once', async () => {
    const { application, context, registry, workspace } = await setup();
    const prepared = await registry.invoke({
      capability: 'preview_transaction', toolCallId: 'call_preview', context,
      caller: 'model',
      input: {
        commands: circleTransaction(context.revision, 'circle_commit').commands,
        postconditions: [{ type: 'node.exists', nodeId: 'circle_commit' }],
      },
    });
    if (!prepared.prepared) throw new Error('expected prepared transaction');

    const directModelCommit = await registry.invoke({
      capability: 'commit_transaction', caller: 'model', toolCallId: 'call_model_commit',
      context,
      input: { previewHandle: prepared.prepared.handle },
    });
    expect(directModelCommit.receipt).toMatchObject({
      status: 'rejected', outcome: { kind: 'error', codes: ['TOOL_CALLER_FORBIDDEN'] },
    });

    const wrongRun = await registry.invoke({
      capability: 'commit_transaction', toolCallId: 'call_wrong_run',
      caller: 'runtime',
      context: { ...context, runId: 'run_2' },
      input: { previewHandle: prepared.prepared.handle },
    });
    expect(wrongRun.receipt).toMatchObject({
      status: 'rejected', outcome: { kind: 'error', codes: ['PREVIEW_SCOPE_MISMATCH'] },
    });
    expect((await application.open(workspace.document.id)).commits).toEqual([]);

    const committed = await registry.invoke({
      capability: 'commit_transaction', toolCallId: 'call_commit', context,
      caller: 'runtime',
      input: { previewHandle: prepared.prepared.handle },
    });
    expect(committed.receipt).toMatchObject({
      status: 'succeeded', revisionBefore: context.revision,
      revisionAfter: expect.not.stringMatching(context.revision),
      affectedNodeIds: ['circle_commit'],
      outcome: { kind: 'commit', committed: true, commitId: expect.any(String) },
    });
    expect((await application.open(workspace.document.id)).document.geometry).toEqual([
      expect.objectContaining({ id: 'circle_commit' }),
    ]);

    const repeated = await registry.invoke({
      capability: 'commit_transaction', toolCallId: 'call_repeat', context,
      caller: 'runtime',
      input: { previewHandle: prepared.prepared.handle },
    });
    expect(repeated.receipt).toMatchObject({
      status: 'rejected', outcome: { kind: 'error', codes: ['PREVIEW_NOT_FOUND'] },
    });
    expect((await application.open(workspace.document.id)).commits).toHaveLength(1);
  });

  it('allows only the latest active preview version in an episode to commit', async () => {
    const { application, context, registry, workspace } = await setup();
    const previewContext = {
      episodeId: 'episode_raise_arm',
      regionId: 'region_right_arm',
      selectionVersionId: 'selection_1',
      strategy: 'geometric-edit' as const,
      lineage: [],
    };
    const first = await registry.invoke({
      capability: 'preview_transaction', caller: 'model', toolCallId: 'call_preview_1', context,
      input: {
        commands: circleTransaction(context.revision, 'circle_first').commands,
        postconditions: [{ type: 'node.exists', nodeId: 'circle_first' }],
        previewContext: { ...previewContext, previewVersionId: 'preview_version_1' },
      },
    });
    const second = await registry.invoke({
      capability: 'preview_transaction', caller: 'model', toolCallId: 'call_preview_2', context,
      input: {
        commands: circleTransaction(context.revision, 'circle_second').commands,
        postconditions: [{ type: 'node.exists', nodeId: 'circle_second' }],
        previewContext: { ...previewContext, previewVersionId: 'preview_version_2' },
      },
    });
    if (!first.prepared || !second.prepared) throw new Error('expected prepared previews');

    expect(first.prepared).toMatchObject({
      ...previewContext,
      previewVersionId: 'preview_version_1',
    });
    const superseded = await registry.invoke({
      capability: 'commit_transaction', caller: 'runtime', toolCallId: 'commit_old', context,
      input: { previewHandle: first.prepared.handle },
    });
    expect(superseded.receipt).toMatchObject({
      status: 'rejected', outcome: { kind: 'error', codes: ['PREVIEW_SUPERSEDED'] },
    });

    const committed = await registry.invoke({
      capability: 'commit_transaction', caller: 'runtime', toolCallId: 'commit_latest', context,
      input: { previewHandle: second.prepared.handle },
    });
    expect(committed.receipt.status).toBe('succeeded');
    expect((await application.open(workspace.document.id)).document.geometry).toEqual([
      expect.objectContaining({ id: 'circle_second' }),
    ]);
  });

  it('returns a structured stale result when the drawing changes after preview', async () => {
    const { application, context, registry, workspace } = await setup();
    const prepared = await registry.invoke({
      capability: 'preview_transaction', toolCallId: 'call_preview', context,
      caller: 'model',
      input: {
        commands: circleTransaction(context.revision, 'circle_stale').commands,
        postconditions: [{ type: 'node.exists', nodeId: 'circle_stale' }],
      },
    });
    if (!prepared.prepared) throw new Error('expected prepared transaction');
    await application.execute({
      drawingId: workspace.document.id,
      transaction: circleTransaction(context.revision, 'circle_external'),
    });

    const stale = await registry.invoke({
      capability: 'commit_transaction', toolCallId: 'call_commit', context,
      caller: 'runtime',
      input: { previewHandle: prepared.prepared.handle },
    });

    expect(stale.receipt).toMatchObject({
      status: 'stale', revisionBefore: context.revision,
      outcome: { kind: 'error', codes: ['STALE_REVISION'] },
      retry: { allowed: true, action: 'requery' },
    });
    expect((await application.open(workspace.document.id)).document.geometry).toEqual([
      expect.objectContaining({ id: 'circle_external' }),
    ]);
  });

  it('verifies acceptance criteria without creating a commit', async () => {
    const { application, context, registry, workspace } = await setup();

    const verified = await registry.invoke({
      capability: 'verify_goal', toolCallId: 'call_verify', context,
      caller: 'runtime',
      input: { assertions: [{ type: 'document.valid' }] },
    });

    expect(verified.receipt).toMatchObject({
      status: 'already_satisfied',
      outcome: { kind: 'verification', satisfied: true, assertionCount: 1 },
    });
    expect((await application.open(workspace.document.id)).commits).toEqual([]);
  });
});

function contextStub(): DrawingToolContext {
  return {
    runId: 'run', drawingId: 'drawing' as DrawingToolContext['drawingId'],
    revision: 'revision' as DrawingToolContext['revision'],
    actor: { type: 'AI', id: 'agent' }, goalId: 'goal',
  };
}

function circleTransaction(revision: string, id: string): DrawingTransaction {
  return {
    id: `tx_${id}`,
    baseRevision: revision as DrawingTransaction['baseRevision'],
    actor: { type: 'AI', id: 'agent' },
    commands: [{
      type: 'geometry.create',
      value: {
        id: id as GeometryId,
        type: 'circle', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
        center: [0, 0], radius: 5,
      },
    }],
    preconditions: [],
    postconditions: [{ type: 'node.exists', nodeId: id }],
    evidenceRefs: [],
  };
}
