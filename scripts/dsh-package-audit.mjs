// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { runtimeImports } from './dsh-bundle-runtime-dependencies.mjs';
import { platformInvocation } from './desktop-command.mjs';
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

export function auditPackedManifest(manifest, { release, hostSource } = {}) {
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
  if (release && typeof hostSource === 'string') {
    auditDshDependencyClassification(manifest, release, hostSource);
  }
}

export function auditTarball(path) {
  const listing = runTar(['-tzf', path]).trim().split('\n').filter(Boolean);
  auditPackageEntries(listing);
  const manifest = JSON.parse(runTar(['-xOzf', path, 'package/package.json']));
  const hostSource = runTar(['-xOzf', path, 'package/lib/index.js']);
  const release = JSON.parse(readFileSync(
    new URL('../release/dsh-plugins.json', import.meta.url),
    'utf8',
  ));
  auditPackedManifest(manifest, { release, hostSource });
  for (const entry of listing.filter((item) => /\.(?:js|json|md|yml|py|d\.ts)$/.test(item))) {
    const content = runTar(['-xOzf', path, entry]);
    if (/\/Users\/|AndroidStudioProjects|sourceMappingURL=/.test(content)) {
      throw new Error(`Packed file contains local or source-map data: ${entry}`);
    }
  }
  return manifest;
}

function auditDshDependencyClassification(manifest, release, hostSource) {
  const expected = release.dsh?.bundleRuntimeDependencies?.[manifest.name];
  if (!Array.isArray(expected) || expected.length === 0) {
    throw new Error(`Missing DSH runtime dependency inventory for Bundle: ${manifest.name}`);
  }
  const actual = runtimeImports(hostSource);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Built Host runtime dependency inventory mismatch for ${manifest.name}`);
  }

  for (const name of expected) {
    if (manifest.dependencies?.[name] !== release.dsh.version) {
      throw new Error(`Packed runtime dependency ${name} must be an exact normal dependency`);
    }
    if (manifest.peerDependencies?.[name] !== undefined
      || manifest.peerDependenciesMeta?.[name] !== undefined) {
      throw new Error(`Packed runtime dependency ${name} must not remain an optional peer`);
    }
  }
  for (const [name, version] of Object.entries(manifest.dependencies ?? {})) {
    if (name.startsWith('@deepseek-ai/dsh-') && !expected.includes(name)) {
      throw new Error(`Unexpected packed DSH runtime dependency ${name}`);
    }
    if (name.startsWith('@deepseek-ai/dsh-') && version !== release.dsh.version) {
      throw new Error(`Packed DSH runtime dependency version mismatch for ${name}`);
    }
  }
  for (const [name, version] of Object.entries(manifest.peerDependencies ?? {})) {
    if (!name.startsWith('@deepseek-ai/dsh-')) continue;
    if (version !== release.dsh.version) {
      throw new Error(`Packed DSH peer dependency version mismatch for ${name}`);
    }
    if (manifest.peerDependenciesMeta?.[name]?.optional !== true) {
      throw new Error(`Packed Host-provided DSH peer must remain optional: ${name}`);
    }
  }
  if (!manifest.peerDependencies?.['@deepseek-ai/cordis']) {
    throw new Error('Packed Bundle must keep Cordis as a required peer');
  }
  if (manifest.peerDependenciesMeta?.['@deepseek-ai/cordis'] !== undefined) {
    throw new Error('Packed Bundle must not mark Cordis optional');
  }
}

function runTar(arguments_) {
  return readTarOutput(arguments_);
}

export function readTarOutput(arguments_) {
  const invocation = platformInvocation(process.platform === 'win32' ? 'tar' : '/usr/bin/tar', arguments_);
  const result = spawnSync(invocation.command, invocation.args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(result.stderr || `tar failed with status ${result.status}`);
  }
  return result.stdout;
}
