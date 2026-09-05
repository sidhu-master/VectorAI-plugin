// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createProbePluginSource,
  formatProbeSummary,
  resolveProbeBundlePath,
  validateProbeRecords,
} from './probe-dsh-recognition-runtime.mjs';
import { readDshRuntimeManifest } from './dsh-runtime-manifest.mjs';

const version = readDshRuntimeManifest().version;

test('validates and formats only sanitized live recognition facts', () => {
  const summary = validateProbeRecords(safeRecords());

  assert.deepEqual(summary, {
    compatible: true,
    versions: { agent: version, llm: version, subagent: version },
    provider: 'deepseek-official',
    model: 'fixture-model',
    reasoningEffort: 'high',
    observationCount: 1,
  });
  assert.equal(
    formatProbeSummary(summary),
    `recognition probe: pass\ncompatible=true\nversions agent=${version} llm=${version} subagent=${version}\nprovider=deepseek-official model=fixture-model reasoningEffort=high observations=1\n`,
  );
});

test('rejects records that expose prompt or persona content', () => {
  const withPrompt = safeRecords();
  withPrompt[1].prompt = 'Set value to exactly ADAPTER_RUNTIME_OK.';
  assert.throws(() => validateProbeRecords(withPrompt), /DSH_RECOGNITION_PROBE_UNSAFE_OUTPUT/);

  const withPersona = safeRecords();
  withPersona[1].persona = 'Return only the requested structured result.';
  assert.throws(() => validateProbeRecords(withPersona), /DSH_RECOGNITION_PROBE_UNSAFE_OUTPUT/);
});

test('generates one bounded adapter request against the built bundle', () => {
  const source = createProbePluginSource({ bundleUrl: 'file:///repo/packages/plugin-dsh-annotation/lib/index.js' });

  assert.match(source, /createDshRecognitionModelAdapter/);
  assert.match(source, /pipelineId: 'runtime-probe'/);
  assert.match(source, /maxDepth: 1/);
  assert.match(source, /timeoutMs: 60_000/);
  assert.match(source, /VECTORAI_DSH_RECOGNITION_PROBE_OUTPUT/);
  assert.doesNotMatch(source, /process\.env\s*[),]/);
});

test('can probe the physically installed bundle from an isolated source-runtime profile', () => {
  assert.equal(
    resolveProbeBundlePath({ root: '/repo', override: '/profile/node_modules/annotation/lib/index.js' }),
    '/profile/node_modules/annotation/lib/index.js',
  );
  assert.equal(
    resolveProbeBundlePath({ root: '/repo' }),
    '/repo/packages/plugin-dsh-annotation/lib/index.js',
  );
});

function safeRecords() {
  return [{
    type: 'adapter/runtime',
    supportedVersion: version,
    versions: { agent: version, llm: version, subagent: version },
    compatible: true,
  }, {
    type: 'adapter/result',
    stopReason: 'completed',
    structured: { value: 'ADAPTER_RUNTIME_OK' },
    observations: [{
      provider: 'deepseek-official',
      model: 'fixture-model',
      reasoningEffort: 'high',
      maxTokens: 256,
      messageCount: 3,
      systemDigest: `sha256:${'1'.repeat(64)}`,
      toolNames: ['structured_output'],
      requestDigest: `sha256:${'2'.repeat(64)}`,
      runtimeVersions: { agent: version, llm: version, subagent: version },
    }],
  }];
}
