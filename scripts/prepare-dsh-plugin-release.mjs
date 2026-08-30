// SPDX-License-Identifier: Apache-2.0

import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { auditTarball } from './dsh-package-audit.mjs';
import { auditRuntimePackage } from './vectorizer-runtime-audit.mjs';
import { RUNTIME_VERSION, targetFor } from './vectorizer-runtime-config.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'dist/npm');
const packages = ['plugin-dsh-space', 'plugin-dsh-annotation'];
const currentTarget = targetFor();
const localRuntime = resolve(root, 'dist/vectorizer-runtime', currentTarget.id, 'package');
if (existsSync(localRuntime)) {
  auditRuntimePackage(localRuntime, { ...currentTarget, version: RUNTIME_VERSION });
} else {
  const inventoryPath = resolve(root, 'dist/releases', RUNTIME_VERSION, 'runtimes/runtime-artifacts.json');
  if (!existsSync(inventoryPath)) throw new Error(`Missing audited runtime package or artifact inventory for ${currentTarget.id}`);
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
  if (!inventory.some((entry) => entry.platform === currentTarget.platform && entry.arch === currentTarget.arch)) {
    throw new Error(`Runtime artifact inventory does not cover ${currentTarget.id}`);
  }
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
run('pnpm', ['build:dsh-space'], root);
run('pnpm', ['build:dsh-annotation'], root);

for (const packageDirectory of packages) {
  run('pnpm', ['pack', '--pack-destination', output], resolve(root, 'packages', packageDirectory));
}

const tarballs = (await readdir(output))
  .filter((file) => file.endsWith('.tgz'))
  .map((file) => resolve(output, file))
  .sort();
if (tarballs.length !== 2) throw new Error(`Expected exactly two plugin tarballs, found ${tarballs.length}`);
for (const tarball of tarballs) auditTarball(tarball);
process.stdout.write(`${tarballs.join('\n')}\n`);

function run(command, arguments_, cwd) {
  const result = spawnSync(command, arguments_, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${arguments_.join(' ')} failed with status ${result.status}`);
}
