// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  RecognitionPipelineRunner,
  createRecognitionFingerprint,
  type RecognitionModelPort,
} from './recognition-runtime';

const noModelPort: RecognitionModelPort = {
  review: async () => { throw new Error('MODEL_MUST_NOT_RUN'); },
};

describe('RecognitionPipelineRunner', () => {
  it('runs production and evaluation through the same registered pipeline', async () => {
    let executions = 0;
    const runner = new RecognitionPipelineRunner(noModelPort);
    runner.register<number, number>({
      id: 'fixture',
      version: '1',
      async execute(input, context) {
        executions += 1;
        context.record({
          id: 'local-double',
          kind: 'deterministic',
          status: 'completed',
          digest: 'sha256:local-double',
        });
        return input * 2;
      },
      normalize: (output) => ({ value: output }),
    });

    const production = await runner.run<number, number>('fixture', 3);
    expect(production.output).toBe(6);
    expect(production.normalized).toEqual({ value: 6 });
    expect(production.trace).toEqual([{
      id: 'local-double',
      kind: 'deterministic',
      status: 'completed',
      digest: 'sha256:local-double',
    }]);

    const report = await runner.evaluate<number, number>({
      id: 'case-1',
      pipelineId: 'fixture',
      input: 4,
      attempts: 2,
      fixtureDigest: 'sha256:fixture',
      assert: (output) => output === 8 ? [] : ['wrong output'],
    });

    expect(report.passed).toBe(true);
    expect(report.attempts).toHaveLength(2);
    expect(report.attempts.every(({ passed }) => passed)).toBe(true);
    expect(report.attempts.map(({ normalized }) => normalized)).toEqual([
      { value: 8 },
      { value: 8 },
    ]);
    expect(executions).toBe(3);
  });

  it('rejects duplicate and unknown pipeline identifiers', async () => {
    const runner = new RecognitionPipelineRunner(noModelPort);
    const pipeline = {
      id: 'fixture',
      version: '1',
      execute: async (input: number) => input,
      normalize: (output: number) => output,
    };
    runner.register(pipeline);

    expect(() => runner.register(pipeline)).toThrow('RECOGNITION_PIPELINE_DUPLICATE:fixture');
    await expect(runner.run('missing', 1)).rejects.toThrow('RECOGNITION_PIPELINE_UNKNOWN:missing');
    expect(runner.list()).toEqual(['fixture']);
  });

  it('reports every failed attempt without leaking raw fixture input', async () => {
    const runner = new RecognitionPipelineRunner(noModelPort);
    runner.register<{ secret: string }, string>({
      id: 'redacted',
      version: '3',
      execute: async ({ secret }) => secret,
      normalize: () => ({ status: 'normalized-only' }),
    });

    const report = await runner.evaluate({
      id: 'case-redacted',
      pipelineId: 'redacted',
      input: { secret: 'PRIVATE_FIXTURE_BODY' },
      attempts: 3,
      fixtureDigest: 'sha256:redacted-fixture',
      assert: () => ['expected failure'],
    });

    expect(report.passed).toBe(false);
    expect(report.attempts).toHaveLength(3);
    expect(report.attempts.every(({ failures }) => failures[0] === 'expected failure')).toBe(true);
    expect(JSON.stringify(report)).not.toContain('PRIVATE_FIXTURE_BODY');
  });

  it('collects sanitized observations from model calls made by a pipeline', async () => {
    const model: RecognitionModelPort = {
      review: async <TStructured>() => ({
        stopReason: 'completed',
        structured: { value: 'ok' } as TStructured,
        observations: [{
          provider: 'fixture-provider',
          model: 'fixture-model',
          reasoningEffort: 'high',
          maxTokens: 128,
          messageCount: 2,
          systemDigest: 'sha256:system',
          toolNames: ['structured_output'],
          requestDigest: 'sha256:request',
          runtimeVersions: { agent: 'a', llm: 'b', subagent: 'c' },
        }],
      }),
    };
    const runner = new RecognitionPipelineRunner(model);
    runner.register<string, string>({
      id: 'model-pipeline',
      version: '1',
      execute: async (input, context) => {
        const result = await context.review<{ value: string }>({
          pipelineId: 'model-pipeline',
          pipelineVersion: '1',
          parentSessionId: 'parent',
          prompt: [{ type: 'text', text: input }],
          outputSchema: { type: 'object' },
          maxDepth: 1,
          timeoutMs: 1_000,
        });
        return result.structured?.value ?? '';
      },
      normalize: (output) => output,
    });

    const run = await runner.run<string, string>('model-pipeline', 'DO_NOT_PERSIST_THIS_PROMPT');

    expect(run.modelObservations).toHaveLength(1);
    expect(run.modelObservations[0]?.model).toBe('fixture-model');
    expect(JSON.stringify(run)).not.toContain('DO_NOT_PERSIST_THIS_PROMPT');
  });
});

describe('createRecognitionFingerprint', () => {
  const baseline = {
    pipelineId: 'partition',
    pipelineVersion: '1',
    fixtureDigest: 'sha256:fixture',
    policyDigests: ['sha256:prompt'],
    observations: [{
      provider: 'provider-a',
      model: 'model-a',
      reasoningEffort: 'high',
      maxTokens: 256,
      messageCount: 2,
      systemDigest: 'sha256:system',
      toolNames: ['structured_output'],
      requestDigest: 'sha256:request',
      runtimeVersions: { agent: '1', llm: '1', subagent: '1' },
    }],
  } as const;

  it('changes when a route, pipeline, policy, fixture, or DSH version changes', () => {
    const original = createRecognitionFingerprint(baseline);
    const variants = [
      { ...baseline, pipelineVersion: '2' },
      { ...baseline, fixtureDigest: 'sha256:other-fixture' },
      { ...baseline, policyDigests: ['sha256:other-prompt'] },
      { ...baseline, observations: [{ ...baseline.observations[0], model: 'model-b' }] },
      { ...baseline, observations: [{ ...baseline.observations[0], runtimeVersions: { agent: '2', llm: '1', subagent: '1' } }] },
    ];

    expect(variants.map(createRecognitionFingerprint)).not.toContain(original);
    expect(original).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});
