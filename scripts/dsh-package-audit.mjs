// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from 'node:child_process';

import { RUNTIME_TARGETS, RUNTIME_VERSION } from './vectorizer-runtime-config.mjs';

const allowedEntry = /^package\/(?:package\.json|README\.md|LICENSE|cordis\.patch\.yml|lib\/(?:.*\.js|.*\.d\.ts))$/;
const forbiddenProtocol = /^(?:workspace:|link:|file:)/;

export function auditPackageEntries(entries) {
  const files = entries.filter((entry) => entry && !entry.endsWith('/'));
  for (const entry of files) {
    if (!allowedEntry.test(entry)) {
      throw new Error(`Forbidden release package entry: ${entry}`);
    }
  }
  for (const required of ['package/package.json', 'package/cordis.patch.yml', 'package/LICENSE']) {
    if (!files.includes(required)) throw new Error(`Missing release package entry: ${required}`);
  }
}

export function auditPackedManifest(manifest) {
  if (manifest?.publishConfig?.access !== 'public') {
    throw new Error('Packed package must use public npm access');
  }
  if (manifest?.dsh?.bundle?.patch !== './cordis.patch.yml' || manifest?.dsh?.client?.platform !== 'web') {
    throw new Error('Packed package is missing official DSH Bundle or Client metadata');
  }
  if (manifest.scripts) throw new Error('Packed Bundle must not contain lifecycle scripts');
  for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, specifier] of Object.entries(manifest?.[section] ?? {})) {
      if (typeof specifier !== 'string' || forbiddenProtocol.test(specifier) || specifier.includes('/Users/')) {
        throw new Error(`Forbidden local dependency ${name}: ${String(specifier)}`);
      }
    }
  }
  if (manifest.name === '@newwe/vectorai-plugin-dsh-space') {
    const expected = Object.fromEntries(RUNTIME_TARGETS.map((target) => [target.packageName, RUNTIME_VERSION]));
    if (JSON.stringify(manifest.optionalDependencies ?? {}) !== JSON.stringify(expected)) {
      throw new Error('Space Bundle platform runtime coverage or version mismatch');
    }
  }
}

export function auditTarball(path) {
  const listing = runTar(['-tzf', path]).trim().split('\n').filter(Boolean);
  auditPackageEntries(listing);
  const manifest = JSON.parse(runTar(['-xOzf', path, 'package/package.json']));
  auditPackedManifest(manifest);
  for (const entry of listing.filter((item) => /\.(?:js|json|md|yml|py|d\.ts)$/.test(item))) {
    const content = runTar(['-xOzf', path, entry]);
    if (/\/Users\/|AndroidStudioProjects|sourceMappingURL=/.test(content)) {
      throw new Error(`Packed file contains local or source-map data: ${entry}`);
    }
  }
  return manifest;
}

function runTar(arguments_) {
  const result = spawnSync('/usr/bin/tar', arguments_, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `tar failed with status ${result.status}`);
  return result.stdout;
}
