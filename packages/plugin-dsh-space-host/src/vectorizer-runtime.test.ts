// SPDX-License-Identifier: Apache-2.0

import { chmod, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  resolveVectorizerRuntime,
  runtimePackageName,
  type VectorizerRuntimeManifest,
} from './vectorizer-runtime';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('runtimePackageName', () => {
  it.each([
    ['darwin', 'arm64', '@newwe/vectorai-vectorizer-darwin-arm64'],
    ['darwin', 'x64', '@newwe/vectorai-vectorizer-darwin-x64'],
    ['linux', 'arm64', '@newwe/vectorai-vectorizer-linux-arm64'],
    ['linux', 'x64', '@newwe/vectorai-vectorizer-linux-x64'],
    ['win32', 'x64', '@newwe/vectorai-vectorizer-win32-x64'],
  ] as const)('maps %s-%s to its optional package', (platform, arch, expected) => {
    expect(runtimePackageName(platform, arch)).toBe(expected);
  });

  it('rejects unsupported platforms without falling back to Python', () => {
    expect(() => runtimePackageName('aix', 'ppc64'))
      .toThrow('VECTORAI_VECTORIZER_PLATFORM_UNSUPPORTED aix-ppc64');
  });
});

describe('resolveVectorizerRuntime', () => {
  it('resolves and validates the packaged executable', async () => {
    const fixture = await runtimeFixture();
    const resolved = await resolveVectorizerRuntime({
      platform: 'darwin',
      arch: 'arm64',
      environment: {},
      resolvePackageJson: () => fixture.packageJson,
    });

    expect(resolved).toMatchObject({
      executablePath: fixture.executable,
      source: 'package',
      packageName: '@newwe/vectorai-vectorizer-darwin-arm64',
      manifest: { protocolVersion: 'vectorai-vectorizer-1', pipelineVersion: 'clean-line-v5' },
    });
  });

  it('uses only an explicit development override and never searches PATH', async () => {
    const fixture = await runtimeFixture();
    const resolved = await resolveVectorizerRuntime({
      platform: 'darwin',
      arch: 'arm64',
      environment: { VECTORAI_VECTORIZER_RUNTIME: fixture.executable, PATH: '/usr/bin' },
      resolvePackageJson: () => { throw new Error('package resolver must not run'); },
    });

    expect(resolved).toMatchObject({ executablePath: fixture.executable, source: 'override' });
  });

  it('reports the exact missing optional package', async () => {
    await expect(resolveVectorizerRuntime({
      platform: 'linux', arch: 'x64', environment: {},
      resolvePackageJson: () => { throw new Error('not found'); },
    })).rejects.toThrow('VECTORAI_VECTORIZER_RUNTIME_MISSING @newwe/vectorai-vectorizer-linux-x64');
  });

  it.each([
    ['protocolVersion', 'vectorai-vectorizer-0', 'VECTORAI_VECTORIZER_PROTOCOL_MISMATCH'],
    ['pipelineVersion', 'clean-line-v4', 'VECTORAI_VECTORIZER_PIPELINE_MISMATCH'],
    ['platform', 'linux', 'VECTORAI_VECTORIZER_RUNTIME_PLATFORM_MISMATCH'],
    ['arch', 'x64', 'VECTORAI_VECTORIZER_RUNTIME_PLATFORM_MISMATCH'],
    ['executable', '../outside', 'VECTORAI_VECTORIZER_RUNTIME_EXECUTABLE_INVALID'],
  ] as const)('rejects invalid manifest field %s', async (key, value, code) => {
    const fixture = await runtimeFixture({ [key]: value });
    await expect(resolveVectorizerRuntime({
      platform: 'darwin', arch: 'arm64', environment: {},
      resolvePackageJson: () => fixture.packageJson,
    })).rejects.toThrow(code);
  });
});

async function runtimeFixture(overrides: Partial<VectorizerRuntimeManifest> = {}) {
  const root = await mkdtemp(join(tmpdir(), 'vectorai-runtime-test-'));
  temporaryDirectories.push(root);
  const runtimeDirectory = join(root, 'runtime');
  await mkdir(runtimeDirectory);
  const executable = join(runtimeDirectory, 'vectorai-vectorizer');
  await writeFile(executable, '#!/bin/sh\nexit 0\n');
  await chmod(executable, 0o755);
  const manifest: VectorizerRuntimeManifest = {
    releaseVersion: '0.1.0-alpha.1',
    protocolVersion: 'vectorai-vectorizer-1',
    pipelineVersion: 'clean-line-v5',
    platform: 'darwin',
    arch: 'arm64',
    pythonVersion: '3.12.11',
    dependencies: {
      numpy: '2.3.3',
      'opencv-python-headless': '4.12.0.88',
      'scikit-image': '0.25.2',
    },
    executable: 'runtime/vectorai-vectorizer',
    treeSha256: `sha256:${'a'.repeat(64)}`,
    ...overrides,
  };
  await writeFile(join(root, 'runtime.json'), JSON.stringify(manifest));
  const packageJson = join(root, 'package.json');
  await writeFile(packageJson, JSON.stringify({ name: '@newwe/vectorai-vectorizer-darwin-arm64' }));
  return { root, packageJson, executable, manifest };
}
