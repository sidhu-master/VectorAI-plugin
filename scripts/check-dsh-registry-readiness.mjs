// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  DSH_BUILD_INPUT_DIRECTORIES,
  defaultRepositoryRoot,
} from './dsh-runtime-manifest.mjs';

export function requiredDshRegistryPackages({ root, release }) {
  const names = new Set();
  for (const dependencies of Object.values(release.dsh?.bundleRuntimeDependencies ?? {})) {
    for (const name of dependencies) names.add(name);
  }

  for (const directory of DSH_BUILD_INPUT_DIRECTORIES) {
    const manifest = readJson(resolve(root, 'packages', directory, 'package.json'));
    addDshNames(names, manifest.dependencies);
  }
  const rootManifest = readJson(resolve(root, 'package.json'));
  addDshNames(names, rootManifest.devDependencies);

  return [...names]
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({ name, version: release.dsh.version }));
}

export async function checkDshRegistryReadiness(
  { root = defaultRepositoryRoot(), release },
  { lookup = lookupNpmVersion } = {},
) {
  const results = await Promise.all(requiredDshRegistryPackages({ root, release }).map(async ({ name, version }) => {
    try {
      await lookup(name, version);
      return { name, status: 'available' };
    } catch (error) {
      if (isMissingPackage(error)) {
        return { name, status: 'missing' };
      }
      return { name, status: 'failed' };
    }
  }));
  const failed = results.find((result) => result.status === 'failed');
  if (failed) {
    throw new Error(`DSH_REGISTRY_CHECK_FAILED:${failed.name}`);
  }
  const missing = results.filter((result) => result.status === 'missing').map((result) => result.name);
  if (missing.length > 0) {
    throw new Error(`DSH_REGISTRY_PACKAGES_UNAVAILABLE:${missing.join(',')}`);
  }
  if (release.dsh.registrySdkVersion !== release.dsh.version) {
    throw new Error(
      `DSH_REGISTRY_SDK_BASELINE_STALE:${release.dsh.registrySdkVersion}:${release.dsh.version}`,
    );
  }
  return { ready: true };
}

async function lookupNpmVersion(name, version) {
  const executable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(executable, ['view', `${name}@${version}`, 'version', '--json'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: 'pipe',
  });
  if (result.status === 0 && result.stdout.trim()) return JSON.parse(result.stdout);
  const failure = `${result.stderr ?? ''}\n${result.error?.message ?? ''}`;
  if (/E404|404 Not Found/iu.test(failure)) {
    throw Object.assign(new Error('npm package unavailable'), { code: 'E404' });
  }
  throw Object.assign(new Error('npm registry lookup failed'), { code: 'EREGISTRY' });
}

function addDshNames(target, dependencies = {}) {
  for (const name of Object.keys(dependencies)) {
    if (name.startsWith('@deepseek-ai/dsh-')) target.add(name);
  }
}

function isMissingPackage(error) {
  return error?.code === 'E404' || /E404|404 Not Found/iu.test(error?.message ?? '');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = defaultRepositoryRoot();
  const release = readJson(resolve(root, 'release/dsh-plugins.json'));
  checkDshRegistryReadiness({ root, release })
    .then(() => process.stdout.write(`DSH registry ready for ${release.dsh.version}\n`))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
