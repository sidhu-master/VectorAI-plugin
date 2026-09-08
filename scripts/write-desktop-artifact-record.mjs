// SPDX-License-Identifier: Apache-2.0

import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import { expectedDesktopArtifactName, sha256File } from './verify-desktop-artifact-set.mjs';

const target = requiredArgument('--target');
const artifact = resolve(requiredArgument('--artifact'));
const runtime = resolve(requiredArgument('--runtime'));
const output = resolve(requiredArgument('--output'));
const commit = requiredArgument('--commit');
const manifest = JSON.parse(await readFile(resolve(runtime, 'runtime-manifest.json'), 'utf8'));
const file = basename(artifact);

if (manifest.sourceCommit !== commit) throw new Error('DESKTOP_ARTIFACT_RUNTIME_COMMIT_MISMATCH');
if (manifest.platform + '-' + manifest.arch !== target) throw new Error('DESKTOP_ARTIFACT_RUNTIME_TARGET_MISMATCH');
if (file !== expectedDesktopArtifactName(manifest.vectoraiVersion, target)) {
  throw new Error('DESKTOP_ARTIFACT_NAME_INVALID');
}
const artifactStat = await stat(artifact);
const record = {
  target,
  version: manifest.vectoraiVersion,
  commit,
  file,
  sha256: await sha256File(artifact),
  size: artifactStat.size,
};
await writeFile(output, `${JSON.stringify(record, null, 2)}\n`);
process.stdout.write(`${output}\n`);

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function requiredArgument(name) {
  const value = argumentValue(name);
  if (!value) throw new Error(`DESKTOP_ARTIFACT_ARGUMENT_REQUIRED:${name}`);
  return value;
}

