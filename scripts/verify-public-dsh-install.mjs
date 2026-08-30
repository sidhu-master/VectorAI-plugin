// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installCommands } from './release-dsh-plugins.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const release = JSON.parse(readFileSync(resolve(root, 'release/dsh-plugins.json'), 'utf8'));
const dshHome = mkdtempSync(join(tmpdir(), 'vectorai-dsh-public-verify-'));
const dsh = process.env.DSH_BIN || 'dsh';
let succeeded = false;
try {
  for (const args of installCommands(release)) run(dsh, args);
  run(dsh, ['plugin', '--profile', release.dsh.profile, 'list']);
  const runtimeName = release.runtimes.find((runtime) =>
    runtime.platform === process.platform && runtime.arch === process.arch)?.name;
  if (!runtimeName) throw new Error(`No runtime target for ${process.platform}-${process.arch}`);
  const manifest = findFile(dshHome, join(...runtimeName.split('/'), 'runtime.json'));
  if (!manifest) throw new Error(`Installed runtime was not found below ${dshHome}`);
  const metadata = JSON.parse(readFileSync(manifest, 'utf8'));
  const executable = resolve(dirname(manifest), metadata.executable);
  const result = spawnSync(executable, [], {
    input: '{"id":"health","operation":"health"}\n', encoding: 'utf8',
    env: { ...process.env, PATH: '/usr/bin:/bin' },
  });
  if (result.status !== 0 || !JSON.parse(result.stdout.trim()).ok) throw new Error(result.stderr || 'Runtime health failed');
  succeeded = true;
  console.log(`Fresh DSH profile verified: ${release.bundles.join(', ')}`);
} finally {
  if (succeeded) rmSync(dshHome, { recursive: true, force: true });
  else console.error(`Failed verification profile retained at: ${dshHome}`);
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, DSH_HOME: dshHome } });
  if (result.error || result.status !== 0) throw result.error ?? new Error(`${command} ${args.join(' ')} failed`);
}

function findFile(directory, suffix) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      const found = findFile(path, suffix);
      if (found) return found;
    } else if (path.endsWith(suffix)) return path;
  }
}
