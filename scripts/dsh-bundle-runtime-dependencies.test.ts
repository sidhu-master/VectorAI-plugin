// SPDX-License-Identifier: Apache-2.0

import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  inspectBundleRuntimeDependencyInventory,
  runtimeImports,
} from './dsh-bundle-runtime-dependencies.mjs';

const repositoryRoot = resolve(import.meta.dirname, '..');

describe('DSH Bundle runtime dependency inventory', () => {
  it('extracts only unique package-root DSH runtime imports from built JavaScript', () => {
    expect(runtimeImports(`
      import { createUserMessage } from '@deepseek-ai/dsh-llm';
      import { defineTool } from '@deepseek-ai/dsh-tools';
      import { anotherTool } from '@deepseek-ai/dsh-tools';
      import value from '@deepseek-ai/dsh-session/client';
      import react from 'react';
    `)).toEqual([
      '@deepseek-ai/dsh-llm',
      '@deepseek-ai/dsh-session',
      '@deepseek-ai/dsh-tools',
    ]);
  });

  it('matches the authoritative inventory to both real built Host Bundles', async () => {
    const release = JSON.parse(await readFile(
      resolve(repositoryRoot, 'release/dsh-plugins.json'),
      'utf8',
    ));
    expect(await inspectBundleRuntimeDependencyInventory({
      root: repositoryRoot,
      release,
    })).toEqual([]);
  });

  it.each([
    ['missing import', {
      '@newwe/vectorai-plugin-dsh-space': ['@deepseek-ai/dsh-tools'],
      '@newwe/vectorai-plugin-dsh-annotation': ['@deepseek-ai/dsh-session'],
    }, /missing.*dsh-llm/i],
    ['extra dependency', {
      '@newwe/vectorai-plugin-dsh-space': [
        '@deepseek-ai/dsh-extra', '@deepseek-ai/dsh-llm', '@deepseek-ai/dsh-tools',
      ],
      '@newwe/vectorai-plugin-dsh-annotation': ['@deepseek-ai/dsh-session'],
    }, /extra.*dsh-extra/i],
  ])('reports a %s deterministically', async (_name, inventory, expected) => {
    const root = await fixtureRoot();
    const release = {
      bundles: [
        '@newwe/vectorai-plugin-dsh-space',
        '@newwe/vectorai-plugin-dsh-annotation',
      ],
      dsh: { bundleRuntimeDependencies: inventory },
    };
    const diagnostics = await inspectBundleRuntimeDependencyInventory({ root, release });
    expect(diagnostics.join('\n')).toMatch(expected);
  });

  it('rejects Cordis and unknown Bundle names in the manifest boundary', async () => {
    const root = await fixtureRoot();
    const release = {
      bundles: ['@newwe/vectorai-plugin-dsh-space'],
      dsh: { bundleRuntimeDependencies: {
        '@newwe/vectorai-plugin-dsh-space': ['@deepseek-ai/cordis'],
        '@newwe/vectorai-plugin-dsh-unknown': ['@deepseek-ai/dsh-tools'],
      } },
    };
    expect((await inspectBundleRuntimeDependencyInventory({ root, release })).join('\n'))
      .toMatch(/cordis.*forbidden[\s\S]*unknown.*bundle/i);
  });
});

async function fixtureRoot() {
  const root = await mkdtemp(join(tmpdir(), 'vectorai-dsh-dependency-inventory-'));
  await mkdir(resolve(root, 'packages/plugin-dsh-space/lib'), { recursive: true });
  await mkdir(resolve(root, 'packages/plugin-dsh-annotation/lib'), { recursive: true });
  await writeFile(
    resolve(root, 'packages/plugin-dsh-space/lib/index.js'),
    "import { createUserMessage } from '@deepseek-ai/dsh-llm';\nimport { defineTool } from '@deepseek-ai/dsh-tools';\n",
  );
  await writeFile(
    resolve(root, 'packages/plugin-dsh-annotation/lib/index.js'),
    "import { SessionId } from '@deepseek-ai/dsh-session';\n",
  );
  return root;
}
