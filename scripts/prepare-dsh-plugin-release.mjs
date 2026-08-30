// SPDX-License-Identifier: Apache-2.0

import { mkdir, readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { auditTarball } from './dsh-package-audit.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'dist/npm');
const packages = ['plugin-dsh-space', 'plugin-dsh-annotation'];

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
