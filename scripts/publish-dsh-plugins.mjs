// SPDX-License-Identifier: Apache-2.0

import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { auditTarball } from './dsh-package-audit.mjs';

const tagIndex = process.argv.indexOf('--tag');
const tag = tagIndex >= 0 ? process.argv[tagIndex + 1] : undefined;
if (!tag || !/^[a-z0-9][a-z0-9._-]*$/i.test(tag)) {
  throw new Error('Usage: pnpm publish:dsh-plugins -- --tag <dist-tag>');
}

run('npm', ['whoami']);
const output = resolve(import.meta.dirname, '../dist/npm');
const files = await readdir(output);
const ordered = [
  files.find((file) => /plugin-dsh-space-.*\.tgz$/.test(file)),
  files.find((file) => /plugin-dsh-annotation-.*\.tgz$/.test(file)),
];
if (ordered.some((file) => file === undefined)) {
  throw new Error('Run pnpm pack:dsh-plugins before publishing');
}

const manifests = ordered.map((file) => auditTarball(resolve(output, file)));
if (manifests[0].version !== manifests[1].version) {
  throw new Error(`Bundle versions differ: ${manifests[0].version} and ${manifests[1].version}`);
}
for (const file of ordered) {
  run('npm', ['publish', resolve(output, file), '--access', 'restricted', '--tag', tag]);
}

function run(command, arguments_) {
  const result = spawnSync(command, arguments_, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${arguments_.join(' ')} failed with status ${result.status}`);
}
