// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from 'node:child_process';

const allowedEntry = /^package\/(?:package\.json|README\.md|LICENSE|cordis\.patch\.yml|lib\/(?:.*\.js|.*\.d\.ts|vectorai_vectorizer\.py))$/;
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
  if (manifest?.publishConfig?.access !== 'restricted') {
    throw new Error('Packed package must use restricted npm access');
  }
  if (manifest?.dsh?.bundle?.patch !== './cordis.patch.yml' || manifest?.dsh?.client?.platform !== 'web') {
    throw new Error('Packed package is missing official DSH Bundle or Client metadata');
  }
  for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, specifier] of Object.entries(manifest?.[section] ?? {})) {
      if (typeof specifier !== 'string' || forbiddenProtocol.test(specifier) || specifier.includes('/Users/')) {
        throw new Error(`Forbidden local dependency ${name}: ${String(specifier)}`);
      }
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
