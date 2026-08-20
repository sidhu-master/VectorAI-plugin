import { describe, expect, it } from 'vitest';

import { MemoryDrawingRepository, type IdFactory } from '../../../src/drawing/index.js';
import { DrawingApplication } from '../drawing-application/application.js';
import { createModelDrawingToolGateway } from './index.js';

describe('createModelDrawingToolGateway world-model integration', () => {
  it('publishes bounded world, grounding, action, and counterfactual tools with schemas', async () => {
    const idFactory = ids();
    const repository = new MemoryDrawingRepository({ idFactory, now: () => 1 });
    const application = new DrawingApplication({ repository, idFactory, now: () => 1 });
    await application.create();

    const gateway = createModelDrawingToolGateway({ application, idFactory });
    const catalog = gateway.registry.catalog();
    const names = [
      'build_world_slice',
      'inspect_world_slice',
      'ground_semantic_entities',
      'refine_semantic_entity',
      'propose_spatial_actions',
      'inspect_counterfactual_world',
    ];

    for (const name of names) {
      expect(catalog).toContainEqual(expect.objectContaining({
        name, access: 'read', description: expect.any(String), inputSchema: expect.any(Object),
      }));
    }
    expect(catalog).toContainEqual(expect.objectContaining({
      name: 'preview_connected_transform', access: 'write',
      description: expect.any(String), inputSchema: expect.any(Object),
    }));
    expect(catalog).toContainEqual(expect.objectContaining({
      name: 'preview_spatial_program', access: 'write',
      description: expect.stringContaining('SpatialEditProgram'),
      inputSchema: expect.objectContaining({
        required: expect.arrayContaining([
          'baseRevision', 'summary', 'intent', 'targets', 'operations',
        ]),
      }),
    }));
    expect(catalog).toContainEqual(expect.objectContaining({
      name: 'revise_preview', access: 'write',
      description: expect.stringContaining('current Preview'),
      inputSchema: expect.objectContaining({
        required: expect.arrayContaining([
          'basePreviewHandle', 'baseTransactionDigest', 'summary', 'corrections', 'evidenceRefs',
        ]),
      }),
    }));
    expect(gateway.worldModelTools.snapshot()).toEqual({
      sliceCount: 0, ledgerCount: 0, taskViewCount: 0,
    });
  });

  it('discards every run-scoped candidate and derived world through one lifecycle boundary', async () => {
    const idFactory = ids();
    const repository = new MemoryDrawingRepository({ idFactory, now: () => 1 });
    const application = new DrawingApplication({ repository, idFactory, now: () => 1 });
    const created = await application.create();
    const gateway = createModelDrawingToolGateway({ application, idFactory });

    await gateway.registry.invoke({
      runId: 'run_cleanup', episodeId: 'episode_cleanup',
      drawingId: created.document.id, revision: created.revision,
      toolCallId: 'build_cleanup', tool: 'build_world_slice', input: { limit: 10 },
    });
    expect(gateway.worldModelTools.snapshot().sliceCount).toBe(1);

    expect(gateway.discardRun('run_cleanup')).toMatchObject({ worldSlices: 1 });
    expect(gateway.worldModelTools.snapshot()).toEqual({
      sliceCount: 0, ledgerCount: 0, taskViewCount: 0,
    });
  });
});

function ids(): IdFactory {
  let value = 0;
  return { next: (kind) => `${kind}_${++value}` };
}
