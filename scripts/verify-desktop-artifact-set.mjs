// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const TARGETS = ['darwin-arm64', 'darwin-x64', 'win32-x64'];

export function expectedDesktopArtifactName(version, target) {
  if (target === 'darwin-arm64') return `VectorAI-${version}-mac-arm64.dmg`;
  if (target === 'darwin-x64') return `VectorAI-${version}-mac-x64.dmg`;
  if (target === 'win32-x64') return `VectorAI-${version}-win-x64-setup.exe`;
  throw new Error(`DESKTOP_ARTIFACT_TARGET_UNEXPECTED:${target}`);
}

export function verifyDesktopArtifacts(records, expected) {
  if (!expected?.version || !/^[a-f0-9]{40}$/u.test(expected.commit ?? '')) {
    throw new Error('DESKTOP_ARTIFACT_EXPECTATION_INVALID');
  }
  const byTarget = new Map();
  for (const record of records) {
    if (!TARGETS.includes(record.target)) throw new Error(`DESKTOP_ARTIFACT_TARGET_UNEXPECTED:${record.target}`);
    if (byTarget.has(record.target)) throw new Error(`DESKTOP_ARTIFACT_DUPLICATE:${record.target}`);
    if (record.version !== expected.version) throw new Error(`DESKTOP_ARTIFACT_VERSION_MISMATCH:${record.target}`);
    if (record.commit !== expected.commit) throw new Error(`DESKTOP_ARTIFACT_COMMIT_MISMATCH:${record.target}`);
    if (record.file !== expectedDesktopArtifactName(expected.version, record.target)) {
      throw new Error(`DESKTOP_ARTIFACT_NAME_INVALID:${record.target}`);
    }
    if (!/^[a-f0-9]{64}$/u.test(record.sha256 ?? '')) throw new Error(`DESKTOP_ARTIFACT_DIGEST_INVALID:${record.target}`);
    if (!Number.isSafeInteger(record.size) || record.size <= 0) throw new Error(`DESKTOP_ARTIFACT_SIZE_INVALID:${record.target}`);
    byTarget.set(record.target, record);
  }
  for (const target of TARGETS) {
    if (!byTarget.has(target)) throw new Error(`DESKTOP_ARTIFACT_MISSING:${target}`);
  }
  return TARGETS.map((target) => byTarget.get(target));
}

export async function auditDesktopArtifactDirectory(directory, expected) {
  const names = (await readdir(directory)).sort();
  const allowed = new Set(TARGETS.flatMap((target) => [
    `${target}.artifact.json`,
    expectedDesktopArtifactName(expected.version, target),
  ]));
  for (const name of names) {
    if (!allowed.has(name)) throw new Error(`DESKTOP_ARTIFACT_UNEXPECTED_FILE:${name}`);
  }
  const records = [];
  for (const target of TARGETS) {
    const recordPath = join(directory, `${target}.artifact.json`);
    const record = JSON.parse(await readFile(recordPath, 'utf8'));
    const artifactPath = join(directory, basename(record.file ?? ''));
    const artifactStat = await stat(artifactPath);
    const actualDigest = await sha256File(artifactPath);
    if (record.sha256 !== actualDigest) throw new Error(`DESKTOP_ARTIFACT_DIGEST_MISMATCH:${target}`);
    if (record.size !== artifactStat.size) throw new Error(`DESKTOP_ARTIFACT_SIZE_MISMATCH:${target}`);
    records.push(record);
  }
  return verifyDesktopArtifacts(records, expected);
}

export async function sha256File(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function main() {
  const directory = resolve(argumentValue('--input') ?? 'dist/desktop-installers');
  const version = requiredArgument('--version');
  const commit = requiredArgument('--commit');
  const output = resolve(argumentValue('--output') ?? join(directory, 'desktop-artifacts.json'));
  const artifacts = await auditDesktopArtifactDirectory(directory, { version, commit });
  await writeFile(output, `${JSON.stringify({ schemaVersion: 1, version, commit, artifacts }, null, 2)}\n`);
  process.stdout.write(`${output}\n`);
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function requiredArgument(name) {
  const value = argumentValue(name);
  if (!value) throw new Error(`DESKTOP_ARTIFACT_ARGUMENT_REQUIRED:${name}`);
  return value;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
