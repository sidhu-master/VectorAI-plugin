// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditRuntimePackage } from './vectorizer-runtime-audit.mjs';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const executable = 'bin/vectorai-vectorizer/vectorai-vectorizer';
const files = { [executable]: digest('runtime') };
const treeSha256 = `sha256:${createHash('sha256')
  .update(`${executable}:${files[executable]}\n`)
  .digest('hex')}`;

function fixture(overrides: Record<string, unknown> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'vectorai-runtime-audit-'));
  mkdirSync(join(root, 'bin/vectorai-vectorizer'), { recursive: true });
  writeFileSync(join(root, executable), 'runtime');
  chmodSync(join(root, executable), 0o755);
  writeFileSync(join(root, 'package.json'), JSON.stringify({
    name: '@newwe/vectorai-vectorizer-darwin-arm64',
    version: '0.1.0-alpha.1',
    os: ['darwin'],
    cpu: ['arm64'],
    files: ['bin', 'runtime.json', 'LICENSE'],
    publishConfig: { access: 'public' },
    license: 'Apache-2.0',
  }));
  writeFileSync(join(root, 'runtime.json'), JSON.stringify({
    releaseVersion: '0.1.0-alpha.1',
    protocolVersion: 'vectorai-vectorizer-1',
    pipelineVersion: 'clean-line-v5',
    platform: 'darwin',
    arch: 'arm64',
    pythonVersion: '3.13.2',
    dependencies: {
      numpy: '2.5.1',
      'opencv-python-headless': '4.14.0.94',
      'scikit-image': '0.26.0',
    },
    sourceCommit: 'a'.repeat(40),
    executable,
    treeSha256,
    files,
    ...overrides,
  }));
  return root;
}

describe('vectorizer runtime package audit', () => {
  it('accepts an intact pinned platform runtime', () => {
    expect(auditRuntimePackage(fixture(), {
      platform: 'darwin', arch: 'arm64', version: '0.1.0-alpha.1',
    }).name).toBe('@newwe/vectorai-vectorizer-darwin-arm64');
  });

  it.each([
    ['wrong platform', { platform: 'linux' }],
    ['wrong release', { releaseVersion: '9.9.9' }],
    ['executable traversal', { executable: '../escape' }],
    ['wrong tree digest', { treeSha256: `sha256:${'b'.repeat(64)}` }],
    ['missing Python metadata', { pythonVersion: undefined }],
    ['missing dependency metadata', { dependencies: undefined }],
    ['wrong dependency version', { dependencies: {
      numpy: '9.9.9',
      'opencv-python-headless': '4.14.0.94',
      'scikit-image': '0.26.0',
    } }],
  ])('rejects %s', (_name, overrides) => {
    expect(() => auditRuntimePackage(fixture(overrides), {
      platform: 'darwin', arch: 'arm64', version: '0.1.0-alpha.1',
    })).toThrow();
  });

  it('rejects a missing executable', () => {
    const root = fixture({ executable: 'bin/missing' });
    expect(() => auditRuntimePackage(root, {
      platform: 'darwin', arch: 'arm64', version: '0.1.0-alpha.1',
    })).toThrow(/executable/i);
  });

  it('rejects a changed file digest', () => {
    const root = fixture();
    writeFileSync(join(root, 'bin/vectorai-vectorizer/vectorai-vectorizer'), 'changed');
    expect(() => auditRuntimePackage(root, {
      platform: 'darwin', arch: 'arm64', version: '0.1.0-alpha.1',
    })).toThrow(/digest/i);
  });

  it.each([
    ['unexpected DSH metadata', { dsh: { bundle: {} } }],
    ['unpinned dependency', { dependencies: { foo: '^1.0.0' } }],
  ])('rejects %s', (_name, manifestPatch) => {
    const root = fixture();
    const path = join(root, 'package.json');
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    writeFileSync(path, JSON.stringify({ ...manifest, ...manifestPatch }));
    expect(() => auditRuntimePackage(root, {
      platform: 'darwin', arch: 'arm64', version: '0.1.0-alpha.1',
    })).toThrow();
  });
});
