// SPDX-License-Identifier: Apache-2.0

import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  checkDshBuildFreshness,
  writeDshBuildFreshnessManifest,
} from './dsh-build-freshness.mjs';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('DSH build freshness', () => {
  it('rejects a bundle after a transitive workspace source changes', async () => {
    const fixture = await workspaceFixture();
    await writeDshBuildFreshnessManifest({ root: fixture.root, target: 'annotation' });

    await writeFile(join(fixture.root, 'packages/domain/src/index.ts'), 'export const value = 2;\n');

    await expect(checkDshBuildFreshness({ root: fixture.root, target: 'annotation' })).resolves.toMatchObject({
      fresh: false,
      reason: 'source-changed',
    });
  });

  it('accepts an unchanged bundle and rejects modified artifacts', async () => {
    const fixture = await workspaceFixture();
    await writeDshBuildFreshnessManifest({ root: fixture.root, target: 'annotation' });

    await expect(checkDshBuildFreshness({ root: fixture.root, target: 'annotation' })).resolves.toMatchObject({ fresh: true });

    await writeFile(join(fixture.root, 'packages/plugin-dsh-annotation/lib/index.js'), 'tampered\n');
    await expect(checkDshBuildFreshness({ root: fixture.root, target: 'annotation' })).resolves.toMatchObject({
      fresh: false,
      reason: 'artifact-changed',
    });
  });
});

async function workspaceFixture(): Promise<{ root: string }> {
  const root = await mkdtemp(join(tmpdir(), 'vectorai-build-freshness-'));
  temporaryDirectories.push(root);
  await mkdir(join(root, 'packages/plugin-dsh-annotation-host/src'), { recursive: true });
  await mkdir(join(root, 'packages/plugin-dsh-annotation-client/src'), { recursive: true });
  await mkdir(join(root, 'packages/plugin-dsh-annotation/lib'), { recursive: true });
  await mkdir(join(root, 'packages/domain/src'), { recursive: true });
  await writeJson(join(root, 'packages/plugin-dsh-annotation-host/package.json'), {
    name: '@vectorai/plugin-dsh-annotation-host', dependencies: { '@vectorai/domain': 'workspace:*' },
  });
  await writeJson(join(root, 'packages/plugin-dsh-annotation-client/package.json'), {
    name: '@vectorai/plugin-dsh-annotation-client', dependencies: { '@vectorai/domain': 'workspace:*' },
  });
  await writeJson(join(root, 'packages/plugin-dsh-annotation/package.json'), {
    name: '@newwe/vectorai-plugin-dsh-annotation',
  });
  await writeJson(join(root, 'packages/domain/package.json'), { name: '@vectorai/domain' });
  await writeFile(join(root, 'packages/plugin-dsh-annotation-host/src/index.ts'), "import '@vectorai/domain';\n");
  await writeFile(join(root, 'packages/plugin-dsh-annotation-client/src/index.ts'), "import '@vectorai/domain';\n");
  await writeFile(join(root, 'packages/domain/src/index.ts'), 'export const value = 1;\n');
  await writeFile(join(root, 'packages/plugin-dsh-annotation/lib/index.js'), 'built host\n');
  await writeFile(join(root, 'packages/plugin-dsh-annotation/lib/client.js'), 'built client\n');
  return { root };
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value)}\n`);
}
