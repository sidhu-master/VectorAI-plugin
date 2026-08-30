// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { verifyRuntimeArtifactSet } from './verify-runtime-artifact-set.mjs';

const release = {
  version: '1.0.0',
  vectorizer: { protocolVersion: 'p1', pipelineVersion: 'v1' },
  runtimes: [
    { platform: 'darwin', arch: 'arm64', name: 'darwin-arm' },
    { platform: 'linux', arch: 'x64', name: 'linux-x64' },
  ],
};
const record = (platform: string, arch: string, name: string) => ({
  platform, arch, name, version: '1.0.0', protocolVersion: 'p1', pipelineVersion: 'v1',
  commit: 'abc', sha256: 'a'.repeat(64),
});

describe('runtime artifact set verification', () => {
  it('accepts exactly one coherent artifact per target', () => {
    expect(verifyRuntimeArtifactSet([
      record('darwin', 'arm64', 'darwin-arm'), record('linux', 'x64', 'linux-x64'),
    ], release, 'abc')).toHaveLength(2);
  });

  it.each([
    ['missing target', [record('darwin', 'arm64', 'darwin-arm')]],
    ['duplicate target', [record('darwin', 'arm64', 'darwin-arm'), record('darwin', 'arm64', 'darwin-arm')]],
    ['wrong commit', [{ ...record('darwin', 'arm64', 'darwin-arm'), commit: 'other' }, record('linux', 'x64', 'linux-x64')]],
    ['wrong version', [{ ...record('darwin', 'arm64', 'darwin-arm'), version: '2.0.0' }, record('linux', 'x64', 'linux-x64')]],
    ['wrong protocol', [{ ...record('darwin', 'arm64', 'darwin-arm'), protocolVersion: 'p2' }, record('linux', 'x64', 'linux-x64')]],
    ['missing digest', [{ ...record('darwin', 'arm64', 'darwin-arm'), sha256: '' }, record('linux', 'x64', 'linux-x64')]],
  ])('rejects %s', (_name, records) => {
    expect(() => verifyRuntimeArtifactSet(records, release, 'abc')).toThrow();
  });
});
