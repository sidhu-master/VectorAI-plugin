// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function verifyRuntimeArtifactSet(records, release, expectedCommit) {
  const expected = new Map(release.runtimes.map((runtime) => [`${runtime.platform}-${runtime.arch}`, runtime]));
  const seen = new Set();
  for (const record of records) {
    const key = `${record.platform}-${record.arch}`;
    const target = expected.get(key);
    if (!target || target.name !== record.name) throw new Error(`Unexpected runtime target: ${key}`);
    if (seen.has(key)) throw new Error(`Duplicate runtime target: ${key}`);
    seen.add(key);
    if (record.version !== release.version) throw new Error(`Runtime version mismatch: ${key}`);
    if (record.protocolVersion !== release.vectorizer.protocolVersion ||
        record.pipelineVersion !== release.vectorizer.pipelineVersion) throw new Error(`Runtime protocol mismatch: ${key}`);
    if (record.commit !== expectedCommit) throw new Error(`Runtime commit mismatch: ${key}`);
    if (!/^[a-f0-9]{64}$/.test(record.sha256)) {
      throw new Error(`Runtime digest missing: ${key}`);
    }
  }
  const missing = [...expected.keys()].filter((key) => !seen.has(key));
  if (missing.length) throw new Error(`Missing runtime targets: ${missing.join(', ')}`);
  return [...records].sort((a, b) => `${a.platform}-${a.arch}`.localeCompare(`${b.platform}-${b.arch}`));
}

function tarEntry(tarball, entry) {
  const result = spawnSync('tar', ['-xOzf', tarball, entry], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `Cannot read ${entry} from ${tarball}`);
  return JSON.parse(result.stdout);
}

function main() {
  const args = process.argv.slice(2);
  const directory = resolve(args[args.indexOf('--directory') + 1] ?? 'dist/runtime-artifacts');
  const commit = args[args.indexOf('--commit') + 1];
  const requestedVersion = args[args.indexOf('--version') + 1];
  if (!commit) throw new Error('--commit is required');
  const release = JSON.parse(readFileSync(resolve(root, 'release/dsh-plugins.json'), 'utf8'));
  if (requestedVersion) release.version = requestedVersion;
  const records = readdirSync(directory).filter((file) => file.endsWith('.tgz')).map((file) => {
    const tarball = resolve(directory, file);
    const runtime = tarEntry(tarball, 'package/runtime.json');
    const manifest = tarEntry(tarball, 'package/package.json');
    return {
      platform: runtime.platform,
      arch: runtime.arch,
      name: manifest.name,
      version: manifest.version,
      protocolVersion: runtime.protocolVersion,
      pipelineVersion: runtime.pipelineVersion,
      commit: runtime.sourceCommit,
      sha256: createHash('sha256').update(readFileSync(tarball)).digest('hex'),
      tarball,
    };
  });
  const inventory = verifyRuntimeArtifactSet(records, release, commit);
  const output = resolve(directory, 'runtime-artifacts.json');
  writeFileSync(output, `${JSON.stringify(inventory, null, 2)}\n`);
  console.log(output);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
