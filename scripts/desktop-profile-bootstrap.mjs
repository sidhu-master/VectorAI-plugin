// SPDX-License-Identifier: Apache-2.0

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function localTarballSpecifier(tarball, platform = process.platform) {
  if (platform === 'win32') return `file:${tarball.replaceAll('\\', '/')}`;
  return pathToFileURL(tarball).href;
}

export function createLocalPackageOverrides(packed, platform = process.platform) {
  return Object.fromEntries(packed.map(({ manifest, tarball }) => [
    manifest.name, localTarballSpecifier(tarball, platform),
  ]));
}

export function withLocalPackageOverrides(workspace, packed) {
  return { ...structuredClone(workspace), overrides: createLocalPackageOverrides(packed) };
}

export function sanitizeInstalledProfileManifest(source, packed) {
  const manifest = structuredClone(source);
  const versions = new Map(packed.map(({ manifest: entry }) => [entry.name, entry.version]));
  for (const [name, specifier] of Object.entries(manifest.dependencies ?? {})) {
    if (specifier.startsWith('file:') && versions.has(name)) {
      manifest.dependencies[name] = versions.get(name);
    }
  }
  if (manifest.pnpm) {
    delete manifest.pnpm.overrides;
    if (Object.keys(manifest.pnpm).length === 0) delete manifest.pnpm;
  }
  return manifest;
}

export function vectorizerProfileDirectory(home, profile, packageName) {
  return join(home, 'profiles', profile, 'node_modules', ...packageName.split('/'));
}

export function pnpmShimContents(platform) {
  if (platform === 'win32') return '@echo off\r\ncorepack pnpm@11.7.0 %*\r\n';
  return '#!/bin/sh\nexec corepack pnpm@11.7.0 "$@"\n';
}
