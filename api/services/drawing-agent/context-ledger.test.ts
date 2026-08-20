import { describe, expect, it } from 'vitest';

import type { DrawingId, RevisionId } from '../../../src/drawing';
import type { ModelToolResult } from '../drawing-tools/types';
import { RevisionContextLedger } from './context-ledger';

const drawingId = 'drawing_1' as DrawingId;
const revision1 = 'revision_1' as RevisionId;
const revision2 = 'revision_2' as RevisionId;

describe('RevisionContextLedger', () => {
  it('uses stable short aliases in context and resolves them before tool execution', () => {
    const ledger = new RevisionContextLedger(revision1);
    ledger.registerNodeIds(['node_vector_aaaaaaaaaaaaaaaa', 'node_vector_bbbbbbbbbbbbbbbb']);

    const first = ledger.alias('node_vector_aaaaaaaaaaaaaaaa');
    const again = ledger.alias('node_vector_aaaaaaaaaaaaaaaa');
    const second = ledger.alias('node_vector_bbbbbbbbbbbbbbbb');

    expect(first).toBe('g1');
    expect(again).toBe(first);
    expect(second).toBe('g2');
    expect(ledger.resolveAliases({
      nodeIds: ['g1', 'g2'], selector: { ids: ['g1'] },
      nested: { nodeId: 'g1' }, previewHandle: 'preview_g1',
      targetRefs: ['node:g1'], preserveRefs: ['node:g2'],
      targets: [{ id: 'target', nodeRefs: ['g1'] }],
      preserveNodeRefs: ['g2'],
      entities: [{ supports: [{ ref: 'g1' }, { ref: 'node:g2' }] }],
    })).toEqual({
      nodeIds: ['node_vector_aaaaaaaaaaaaaaaa', 'node_vector_bbbbbbbbbbbbbbbb'],
      selector: { ids: ['node_vector_aaaaaaaaaaaaaaaa'] },
      nested: { nodeId: 'node_vector_aaaaaaaaaaaaaaaa' },
      previewHandle: 'preview_g1',
      targetRefs: ['node:node_vector_aaaaaaaaaaaaaaaa'],
      preserveRefs: ['node:node_vector_bbbbbbbbbbbbbbbb'],
      targets: [{ id: 'target', nodeRefs: ['node_vector_aaaaaaaaaaaaaaaa'] }],
      preserveNodeRefs: ['node_vector_bbbbbbbbbbbbbbbb'],
      entities: [{ supports: [
        { ref: 'node_vector_aaaaaaaaaaaaaaaa' },
        { ref: 'node:node_vector_bbbbbbbbbbbbbbbb' },
      ] }],
    });
  });

  it('invalidates old aliases and exact evidence when the revision changes', () => {
    const ledger = new RevisionContextLedger(revision1);
    ledger.registerNodeIds(['old_node']);
    expect(ledger.alias('old_node')).toBe('g1');
    ledger.record(toolResult('inspect_nodes', revision1, ['old_node'], {
      nodes: [{ node: { id: 'old_node', type: 'line' } }],
    }));

    ledger.advanceRevision(revision2);

    expect(ledger.resolveAliases('g1')).toBe('g1');
    expect(JSON.stringify(ledger.project())).not.toContain('old_node');
    expect(ledger.project().receipts).toEqual([]);
  });

  it('keeps source vectorization inventory across Drawing revisions', () => {
    const ledger = new RevisionContextLedger(revision1);
    ledger.record(toolResult('vectorize_image', revision1, [], {
      candidateHandle: 'generation_source_1',
      kind: 'vectorization',
      inventory: { chainCount: 58, batchCount: 8, vectorNodeCount: 58 },
      batches: [{ batchIndex: 0, nodeCount: 8 }],
    }));

    ledger.advanceRevision(revision2);

    expect(ledger.project()).toMatchObject({
      revision: revision2,
      receipts: [{
        tool: 'vectorize_image',
        status: 'succeeded',
        output: {
          candidateHandle: 'generation_source_1',
          inventory: { chainCount: 58, batchCount: 8, vectorNodeCount: 58 },
        },
      }],
    });
  });

  it('stores compact evidence receipts without duplicated render media or vector digests', () => {
    const ledger = new RevisionContextLedger(revision1);
    ledger.registerNodeIds(['node_a']);
    ledger.record(toolResult('render_drawing', revision1, ['node_a'], {
      revision: revision1,
      views: [{ image: { handle: 'image_1' }, grounding: [{ nodeId: 'node_a' }] }],
      observation: { views: [{ image: { handle: 'image_1' } }] },
      vectorDigest: { nodes: [{ id: 'node_a', huge: 'x'.repeat(10_000) }] },
      interactionFrame: {
        kind: 'spatial', phase: 'observing',
        strokes: [{ id: 'stroke_1', role: 'target', points: [[0, 0], [10, 0]] }],
        markers: [], vectors: [],
      },
      previewHandle: 'preview_1',
    }));

    const projection = ledger.project();
    const encoded = JSON.stringify(projection);

    expect(projection.receipts).toEqual([
      expect.objectContaining({
        ref: 'e1', tool: 'render_drawing', status: 'succeeded', affected: ['g1'],
        affectedCount: 1,
        output: { revision: revision1, previewHandle: 'preview_1' },
      }),
    ]);
    expect(encoded).not.toContain('vectorDigest');
    expect(encoded).not.toContain('image_1');
    expect(encoded).not.toContain('interactionFrame');
    expect(encoded).not.toContain('stroke_1');
    expect(encoded).not.toContain('node_a');
  });

  it('keeps an auditable spatial program summary without duplicating compiled commands', () => {
    const ledger = new RevisionContextLedger(revision1);
    ledger.registerNodeIds(['node_a', 'node_b']);
    ledger.record(toolResult('preview_spatial_program', revision1, ['node_a'], {
      status: 'ready', previewHandle: 'preview_program_1', transactionId: 'transaction_1',
      spatialProgram: {
        baseRevision: revision1,
        summary: 'move one target', intent: 'move and reconnect',
        targets: [{ id: 'target', description: 'chosen target', nodeRefs: ['node_a'] }],
        operations: [{
          kind: 'translate', nodeIds: ['node_a'],
          from: { kind: 'node_anchor', nodeId: 'node_a', anchor: 'center' },
          to: { kind: 'node_anchor', nodeId: 'node_b', anchor: 'center' },
        }],
        preserveNodeRefs: ['node_b'], postconditions: [], evidenceRefs: [], confidence: 0.9,
      },
      operationReceipts: [{
        operationIndex: 0, kind: 'translate', affectedNodeIds: ['node_a'],
        resolvedPoints: [{ role: 'to', point: [10, 20] }],
        commands: [{ type: 'geometry.update', id: 'node_a', changes: { center: [10, 20] } }],
      }],
      programDiagnostics: [], diagnostics: [],
      interactionFrame: { kind: 'spatial', phase: 'previewing', strokes: [], markers: [], vectors: [] },
      observation: { views: [{ image: { handle: 'preview_image' } }] },
    }));

    const output = ledger.project().receipts[0]?.output as Record<string, unknown>;
    expect(output).toMatchObject({
      status: 'ready', previewHandle: 'preview_program_1',
      spatialProgram: {
        summary: 'move one target', intent: 'move and reconnect',
        targets: [{ nodeRefs: ['g1'] }], preserveNodeRefs: ['g2'],
      },
      operationReceipts: [{
        operationIndex: 0, kind: 'translate', affectedNodeIds: ['g1'],
        resolvedPoints: [{ role: 'to', point: [10, 20] }],
      }],
    });
    expect(JSON.stringify(output)).not.toContain('geometry.update');
    expect(JSON.stringify(output)).not.toContain('preview_image');
  });

  it('projects only the current candidate contract while the audit log keeps old candidates', () => {
    const ledger = new RevisionContextLedger(revision1);
    ledger.registerNodeIds(['node_a']);
    const candidateOutput = (index: number) => ({
      status: 'ready', previewHandle: `preview_${index}`,
      spatialProgram: {
        baseRevision: revision1, summary: `candidate ${index}`, intent: 'generic edit',
        targets: [{ id: 'target', description: 'target', nodeRefs: ['node_a'] }],
        operations: [], preserveNodeRefs: [], postconditions: [], evidenceRefs: [],
      },
      operationReceipts: [], programDiagnostics: [], diagnostics: [],
      counterfactual: { hugeHistoricalBranch: 'x'.repeat(20_000) },
    });

    ledger.record(toolResult('preview_spatial_program', revision1, ['node_a'], candidateOutput(1)));
    ledger.record(toolResult('preview_spatial_program', revision1, ['node_a'], candidateOutput(2)));

    const projection = ledger.project();
    expect(projection.receipts.filter((item) => item.tool === 'preview_spatial_program'))
      .toHaveLength(1);
    expect(projection.receipts.at(-1)?.output).toMatchObject({
      previewHandle: 'preview_2', spatialProgram: { summary: 'candidate 2' },
    });
    expect(JSON.stringify(projection)).not.toContain('preview_1');
    expect(JSON.stringify(projection)).not.toContain('hugeHistoricalBranch');
  });
});

function toolResult(
  tool: string,
  revision: RevisionId,
  affectedNodeIds: string[],
  output: unknown,
): ModelToolResult {
  return {
    schemaVersion: 1,
    receipt: {
      schemaVersion: 1,
      runId: 'run_1', episodeId: 'episode_1', drawingId,
      toolCallId: `call_${tool}`, tool, toolVersion: '1.0.0', access: 'read',
      status: 'succeeded', revisionBefore: revision, revisionAfter: revision,
      affectedNodeIds, inputDigest: 'sha256:input', outputDigest: 'sha256:output', durationMs: 3,
    },
    output,
  };
}
