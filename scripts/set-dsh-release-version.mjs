// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const get = (flag) => args[args.indexOf(flag) + 1];
const version = get('--version');
const tag = get('--tag');
if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(version ?? '')) {
  throw new Error('Usage: node scripts/set-dsh-release-version.mjs --version <semver> --tag <tag>');
}
if (!/^[a-z0-9][a-z0-9._-]*$/i.test(tag ?? '')) throw new Error('A valid npm --tag is required');

const releasePath = resolve(root, 'release/dsh-plugins.json');
const release = readJson(releasePath);
const names = [...release.runtimes.map((runtime) => runtime.name), ...release.bundles];
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

const spacePath = resolve(root, 'packages/plugin-dsh-space/package.json');
const annotationPath = resolve(root, 'packages/plugin-dsh-annotation/package.json');
const space = readJson(spacePath);
const annotation = readJson(annotationPath);
space.version = version;
space.optionalDependencies = Object.fromEntries(release.runtimes.map((runtime) => [runtime.name, version]));
annotation.version = version;
annotation.peerDependencies[space.name] = version;
release.version = version;
release.npmTag = tag;

const configPath = resolve(root, 'scripts/vectorizer-runtime-config.mjs');
const config = readFileSync(configPath, 'utf8').replace(
  /export const RUNTIME_VERSION = '[^']+';/,
  `export const RUNTIME_VERSION = '${version}';`,
);
const writes = new Map([
  [releasePath, `${JSON.stringify(release, null, 2)}\n`],
  [spacePath, `${JSON.stringify(space, null, 2)}\n`],
  [annotationPath, `${JSON.stringify(annotation, null, 2)}\n`],
  [configPath, config],
]);
for (const runtime of release.runtimes) {
  const packageRoot = resolve(root, 'dist/vectorizer-runtime', `${runtime.platform}-${runtime.arch}`, 'package');
  const packagePath = resolve(packageRoot, 'package.json');
  const runtimePath = resolve(packageRoot, 'runtime.json');
  if (!existsSync(packagePath) || !existsSync(runtimePath)) continue;
  const packageJson = readJson(packagePath);
  const runtimeJson = readJson(runtimePath);
  packageJson.version = version;
  runtimeJson.runtimeVersion = version;
  writes.set(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  writes.set(runtimePath, `${JSON.stringify(runtimeJson, null, 2)}\n`);
}
for (const [path, content] of writes) writeFileSync(path, content);
console.log(`Prepared DSH plugin release ${version} (${tag})`);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
