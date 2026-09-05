// SPDX-License-Identifier: Apache-2.0

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const BUNDLE_DIRECTORIES = new Map([
  ['@newwe/vectorai-plugin-dsh-space', 'plugin-dsh-space'],
  ['@newwe/vectorai-plugin-dsh-annotation', 'plugin-dsh-annotation'],
]);

export function runtimeImports(source) {
  const imports = [...source.matchAll(
    /\bfrom\s+['"](@deepseek-ai\/dsh-[^/'"]+)(?:\/[^'"]+)?['"]/gu,
  )].map(([, name]) => name);
  return [...new Set(imports)].sort();
}

export async function inspectBundleRuntimeDependencyInventory({ root, release }) {
  const diagnostics = [];
  const releaseBundles = new Set(release.bundles ?? []);
  const inventory = release.dsh?.bundleRuntimeDependencies ?? {};

  for (const bundle of Object.keys(inventory).sort()) {
    if (!releaseBundles.has(bundle) || !BUNDLE_DIRECTORIES.has(bundle)) {
      diagnostics.push(`BUNDLE_RUNTIME_DEPENDENCY_UNKNOWN_BUNDLE:${bundle}`);
    }
  }

  for (const bundle of [...releaseBundles].sort()) {
    const directory = BUNDLE_DIRECTORIES.get(bundle);
    if (!directory) {
      diagnostics.push(`BUNDLE_RUNTIME_DEPENDENCY_UNKNOWN_BUNDLE:${bundle}`);
      continue;
    }
    const configured = new Set(inventory[bundle] ?? []);
    if (configured.has('@deepseek-ai/cordis')) {
      diagnostics.push(`BUNDLE_RUNTIME_DEPENDENCY_CORDIS_FORBIDDEN:${bundle}`);
      configured.delete('@deepseek-ai/cordis');
    }
    const source = await readFile(resolve(root, 'packages', directory, 'lib/index.js'), 'utf8');
    const actual = new Set(runtimeImports(source));
    for (const name of [...actual].sort()) {
      if (!configured.has(name)) diagnostics.push(`BUNDLE_RUNTIME_DEPENDENCY_MISSING:${bundle}:${name}`);
    }
    for (const name of [...configured].sort()) {
      if (!actual.has(name)) diagnostics.push(`BUNDLE_RUNTIME_DEPENDENCY_EXTRA:${bundle}:${name}`);
    }
  }
  return diagnostics.sort();
}
