// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { PartitionDraft } from '@vectorai/engineering-annotation';
import { describe, expect, it } from 'vitest';
import { RecognitionPipelineRunner, recognitionDigest, type RecognitionModelPort } from './recognition-runtime';
import { createPartitionSemanticPipeline, PARTITION_SEMANTIC_PIPELINE_ID } from './semantic-reviewer';

describe('partition recognition contract', () => {
  it('evaluates the production pipeline through rendering, model review, validation and local grounding', async () => {
    const model: RecognitionModelPort = {
      review: async <TStructured>() => ({
        stopReason: 'completed',
        structured: { proposals: [{
          segmentIds: ['segment:bearing'],
          semanticType: 'bearing-seat',
          dimensionRole: 'functional-feature',
          name: '左轴承位',
          confidence: 0.94,
          reason: '稳定圆柱支承面',
          visualEvidenceIds: ['observation:segment:bearing'],
        }] } as TStructured,
        observations: [{
          provider: 'fixture-provider', model: 'fixture-model', reasoningEffort: 'high',
          messageCount: 3, systemDigest: 'sha256:system', toolNames: ['structured_output'],
          requestDigest: 'sha256:model-request',
          runtimeVersions: { agent: '0.1.2-alpha.5', llm: '0.1.2-alpha.5', subagent: '0.1.2-alpha.5' },
        }],
      }),
    };
    const runner = new RecognitionPipelineRunner(model);
    runner.register(createPartitionSemanticPipeline({
      renderObservation: async () => ({
        status: 'rendered', png: new Uint8Array([137, 80, 78, 71]),
        contentDigest: 'sha256:fixture-observation', width: 960, height: 720,
      }),
    } as never));
    const input = {
      agent: { id: 'contract-session' } as Agent,
      draft: contractDraft(),
      segmentIds: ['segment:bearing', 'segment:transition'],
    };

    const report = await runner.evaluate({
      id: 'partition-bearing-seat-v1',
      pipelineId: PARTITION_SEMANTIC_PIPELINE_ID,
      input,
      attempts: 3,
      fixtureDigest: recognitionDigest({ drawing: 'contract-shaft-v1' }),
      policyDigests: [recognitionDigest('partition-semantic-policy-v1')],
      assert: ({ draft }) => {
        const failures: string[] = [];
        const group = draft.semanticGroups.find(({ name }) => name === '左轴承位');
        if (group?.semanticType !== 'bearing-seat') failures.push('bearing group missing');
        if (group?.dimensionRole !== 'functional-feature') failures.push('bearing role missing');
        if (draft.segments.find(({ id }) => id === 'segment:transition')?.semanticType !== undefined) {
          failures.push('unreviewed transition was classified');
        }
        return failures;
      },
    });

    expect(report.passed).toBe(true);
    expect(report.attempts).toHaveLength(3);
    expect(report.attempts.every(({ trace }) => trace.map(({ kind }) => kind).join(',') === 'deterministic,model,grounding')).toBe(true);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('不要展示分析过程');
    expect(serialized).not.toContain('137,80,78,71');
    expect(serialized).not.toContain('稳定圆柱支承面');
  });
});

function contractDraft(): PartitionDraft {
  const base = {
    profile: { minRadius: 10, maxRadius: 12, sampleCount: 6 },
    boundaryConfidence: 0.95,
    geometryNodeIds: [], boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [],
  };
  return {
    version: 1,
    drawingRef: { drawingId: 'contract-drawing', revision: 4 },
    axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 32, orientation: 'forward' },
    segments: [
      { ...base, id: 'segment:bearing', zStart: 0, zEnd: 24 },
      { ...base, id: 'segment:transition', zStart: 24, zEnd: 32 },
    ],
    semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
  };
}
