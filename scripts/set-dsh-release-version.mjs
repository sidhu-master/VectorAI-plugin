// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const semver = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

export function materializeBundleRuntimeDependencies(manifest, bundleName, baseline) {
  const runtimeDependencies = baseline?.bundleRuntimeDependencies?.[bundleName];
  if (!Array.isArray(runtimeDependencies) || runtimeDependencies.length === 0) {
    throw new Error(`Missing DSH runtime dependency inventory for Bundle: ${bundleName}`);
  }

  const next = structuredClone(manifest);
  next.dependencies = { ...(next.dependencies ?? {}) };
  next.peerDependencies = { ...(next.peerDependencies ?? {}) };
  next.peerDependenciesMeta = { ...(next.peerDependenciesMeta ?? {}) };

  for (const name of runtimeDependencies) {
    next.dependencies[name] = baseline.version;
    delete next.peerDependencies[name];
    delete next.peerDependenciesMeta[name];
  }
  delete next.peerDependenciesMeta['@deepseek-ai/cordis'];

  next.dependencies = sortRecord(next.dependencies);
  next.peerDependencies = sortRecord(next.peerDependencies);
  if (Object.keys(next.peerDependenciesMeta).length > 0) {
    next.peerDependenciesMeta = sortRecord(next.peerDependenciesMeta);
  } else {
    delete next.peerDependenciesMeta;
  }
  if (next.optionalDependencies) next.optionalDependencies = sortRecord(next.optionalDependencies);
  return next;
}

export function prepareDshReleaseVersion({ root = defaultRoot, version, tag }) {
  if (!semver.test(version ?? '')) {
    throw new Error('Usage: node scripts/set-dsh-release-version.mjs --version <semver> --tag <tag>');
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(tag ?? '')) throw new Error('A valid npm --tag is required');

  const releasePath = resolve(root, 'release/dsh-plugins.json');
  const release = readJson(releasePath);
  const names = [...release.runtimes.map((runtime) => runtime.name), ...release.bundles];
  assertUnusedNpmVersion(names, version);

  const spacePath = resolve(root, 'packages/plugin-dsh-space/package.json');
  const annotationPath = resolve(root, 'packages/plugin-dsh-annotation/package.json');
  const spaceSource = readJson(spacePath);
  const annotationSource = readJson(annotationPath);
  const space = materializeBundleRuntimeDependencies(spaceSource, spaceSource.name, release.dsh);
  const annotation = materializeBundleRuntimeDependencies(
    annotationSource,
    annotationSource.name,
    release.dsh,
  );
  space.version = version;
  space.optionalDependencies = sortRecord(Object.fromEntries(
    release.runtimes.map((runtime) => [runtime.name, version]),
  ));
  annotation.version = version;
  annotation.peerDependencies[space.name] = version;
  annotation.peerDependencies = sortRecord(annotation.peerDependencies);
  release.version = version;
  release.npmTag = tag;

  const writes = new Map([
    [releasePath, `${JSON.stringify(release, null, 2)}\n`],
    [spacePath, `${JSON.stringify(space, null, 2)}\n`],
    [annotationPath, `${JSON.stringify(annotation, null, 2)}\n`],
  ]);
  for (const runtime of release.runtimes) {
    const packageRoot = resolve(root, 'dist/vectorizer-runtime', `${runtime.platform}-${runtime.arch}`, 'package');
    const packagePath = resolve(packageRoot, 'package.json');
    const runtimePath = resolve(packageRoot, 'runtime.json');
    if (!existsSync(packagePath) || !existsSync(runtimePath)) continue;
    const packageJson = readJson(packagePath);
    const runtimeJson = readJson(runtimePath);
    packageJson.version = version;
    runtimeJson.releaseVersion = version;
    writes.set(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
    writes.set(runtimePath, `${JSON.stringify(runtimeJson, null, 2)}\n`);
  }
  for (const [path, content] of writes) writeFileSync(path, content);
  return { version, tag };
}

function assertUnusedNpmVersion(names, version) {
  const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  for (const name of names) {
    const result = spawnSync(npmExecutable, ['view', `${name}@${version}`, 'version'], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    if (result.status === 0 && result.stdout.trim()) throw new Error(`npm version already exists: ${name}@${version}`);
    const failure = result.stderr ?? result.error?.message ?? '';
    if (result.status !== 0 && !/E404|404 Not Found/i.test(failure)) {
      throw new Error(`Unable to verify unused npm version ${name}@${version}: ${failure.trim()}`);
    }
  }
}

function sortRecord(record) {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const get = (flag) => args[args.indexOf(flag) + 1];
  const version = get('--version');
  const tag = get('--tag');
  try {
    prepareDshReleaseVersion({ version, tag });
    console.log(`Prepared DSH plugin release ${version} (${tag})`);
  } catch (error) {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  }
}
