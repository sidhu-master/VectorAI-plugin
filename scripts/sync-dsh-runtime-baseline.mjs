// SPDX-License-Identifier: Apache-2.0

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  defaultRepositoryRoot,
  DSH_BUILD_INPUT_DIRECTORIES,
  DSH_BUNDLE_DIRECTORIES,
  inspectDshRuntimeDrift,
  readDshRuntimeManifest,
  renderDshSwiftBaseline,
  renderDshTypeScriptBaseline,
} from './dsh-runtime-manifest.mjs';

const root = defaultRepositoryRoot();
const checkOnly = process.argv.includes('--check');

if (checkOnly) {
  const drift = await inspectDshRuntimeDrift(root);
  if (drift.length > 0) {
    process.stderr.write(`DSH runtime baseline drift:\n${drift.map((entry) => `  - ${entry}`).join('\n')}\n`);
    process.exitCode = 1;
  }
} else {
  const baseline = await readDshRuntimeManifest(root);
  for (const directory of DSH_BUNDLE_DIRECTORIES) {
    const path = resolve(root, 'packages', directory, 'package.json');
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    const metadata = { ...(manifest.peerDependenciesMeta ?? {}) };
    for (const name of Object.keys(manifest.peerDependencies ?? {})) {
      if (!name.startsWith('@deepseek-ai/dsh-')) continue;
      manifest.peerDependencies[name] = baseline.version;
      metadata[name] = { optional: true };
    }
    manifest.peerDependenciesMeta = metadata;
    await writeJson(path, manifest);
  }
  for (const directory of DSH_BUILD_INPUT_DIRECTORIES) {
    const path = resolve(root, 'packages', directory, 'package.json');
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    for (const name of Object.keys(manifest.dependencies ?? {})) {
      if (name.startsWith('@deepseek-ai/dsh-')) {
        manifest.dependencies[name] = baseline.registrySdkVersion;
      }
    }
    await writeJson(path, manifest);
  }
  const rootManifestPath = resolve(root, 'package.json');
  const rootManifest = JSON.parse(await readFile(rootManifestPath, 'utf8'));
  for (const name of Object.keys(rootManifest.devDependencies ?? {})) {
    if (name.startsWith('@deepseek-ai/dsh-')) {
      rootManifest.devDependencies[name] = baseline.registrySdkVersion;
    }
  }
  await writeJson(rootManifestPath, rootManifest);
  await writeFile(
    resolve(root, 'packages/plugin-dsh-annotation-host/src/dsh-runtime-baseline.generated.ts'),
    renderDshTypeScriptBaseline(baseline),
  );
  await writeFile(
    resolve(root, 'apps/dsh-launcher-macos/Sources/DSHRuntimeBaseline.generated.swift'),
    renderDshSwiftBaseline(baseline),
  );
  process.stdout.write(`Synchronized DSH runtime ${baseline.version} (registry SDK ${baseline.registrySdkVersion}).\n`);
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, undefined, 2)}\n`);
}
