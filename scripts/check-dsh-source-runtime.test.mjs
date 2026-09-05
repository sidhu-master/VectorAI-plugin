// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateDshSourceRuntimeFacts } from './check-dsh-source-runtime.mjs';

const baseline = {
  version: '0.1.3-alpha.1',
  tag: 'dsh-v0.1.3-alpha.1',
  commit: 'd347e703908d0406b7a7ef80e3a0e594d86b2215',
  registrySdkVersion: '0.1.2-rc.1',
  profile: 'web',
};

const facts = {
  rootVersion: baseline.version,
  commit: baseline.commit,
  packageVersions: {
    '@deepseek-ai/dsh-agent': baseline.version,
    '@deepseek-ai/dsh-llm': baseline.version,
    '@deepseek-ai/dsh-session': baseline.version,
    '@deepseek-ai/dsh-subagent': baseline.version,
  },
  capabilities: { createDrafts: true, addAttachments: true },
};

test('accepts only the exact source runtime with the latest attachment API', () => {
  assert.deepEqual(validateDshSourceRuntimeFacts(baseline, facts), facts);
});

test('rejects root, commit, package, and API drift independently', () => {
  assert.throws(
    () => validateDshSourceRuntimeFacts(baseline, { ...facts, rootVersion: '0.1.2-alpha.5' }),
    /DSH_SOURCE_ROOT_VERSION_MISMATCH/,
  );
  assert.throws(
    () => validateDshSourceRuntimeFacts(baseline, { ...facts, commit: '0'.repeat(40) }),
    /DSH_SOURCE_COMMIT_MISMATCH/,
  );
  assert.throws(
    () => validateDshSourceRuntimeFacts(baseline, {
      ...facts,
      packageVersions: { ...facts.packageVersions, '@deepseek-ai/dsh-session': '0.1.2-rc.1' },
    }),
    /DSH_SOURCE_PACKAGE_VERSION_MISMATCH:@deepseek-ai\/dsh-session/,
  );
  assert.throws(
    () => validateDshSourceRuntimeFacts(baseline, {
      ...facts,
      capabilities: { ...facts.capabilities, createDrafts: false },
    }),
    /DSH_SOURCE_CAPABILITY_MISSING:createDrafts/,
  );
});
