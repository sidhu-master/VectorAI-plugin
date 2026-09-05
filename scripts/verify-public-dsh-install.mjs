// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { bundleInstallCommands, publicBundleSources } from './verify-dsh-install-plan.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function verifyDshInstall({
  release,
  sources,
  dsh = process.env.DSH_BIN || 'dsh',
  temporaryRoot = tmpdir(),
}) {
  const dshHome = mkdtempSync(join(temporaryRoot, 'vectorai-dsh-two-command-verify-'));
  const environment = { ...process.env, DSH_HOME: dshHome };
  let succeeded = false;
  try {
    const actualDshVersion = runCapture(dsh, ['--version'], environment).trim();
    if (actualDshVersion !== release.dsh.version) {
      throw new Error(`DSH runtime version mismatch: expected ${release.dsh.version}, got ${actualDshVersion}`);
    }

    for (const args of bundleInstallCommands({ release, sources })) run(dsh, args, environment);
    run(dsh, ['plugin', '--profile', release.dsh.profile, 'list'], environment);

    const composed = runCapture(
      dsh,
      ['--profile', release.dsh.profile, '--dump-config'],
      environment,
    );
    for (const name of release.bundles) {
      if (!composed.includes(name)) throw new Error(`Composed DSH profile is missing Bundle: ${name}`);
    }
    runCapture(dsh, ['--profile', release.dsh.profile, '--help'], environment);

    const runtimeName = release.runtimes.find((runtime) =>
      runtime.platform === process.platform && runtime.arch === process.arch)?.name;
    if (!runtimeName) throw new Error(`No runtime target for ${process.platform}-${process.arch}`);
    const manifest = findFile(dshHome, join(...runtimeName.split('/'), 'runtime.json'));
    if (!manifest) throw new Error(`Installed runtime was not found below ${dshHome}`);
    const metadata = JSON.parse(readFileSync(manifest, 'utf8'));
    const executable = resolve(dirname(manifest), metadata.executable);
    const result = spawnSync(executable, [], {
      input: '{"id":"health","operation":"health"}\n',
      encoding: 'utf8',
      env: { ...process.env, PATH: '/usr/bin:/bin' },
    });
    if (result.status !== 0 || !JSON.parse(result.stdout.trim()).ok) {
      throw new Error(result.stderr || 'Runtime health failed');
    }
    succeeded = true;
    console.log(`Fresh DSH profile verified: ${release.bundles.join(', ')}`);
    return { verified: true };
  } finally {
    if (succeeded) rmSync(dshHome, { recursive: true, force: true });
    else console.error(`Failed verification profile retained at: ${dshHome}`);
  }
}

function run(command, args, environment) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: environment });
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(`${command} ${args.join(' ')} failed`);
  }
}

function runCapture(command, args, environment) {
  const result = spawnSync(command, args, { encoding: 'utf8', env: environment });
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(result.stderr || `${command} ${args.join(' ')} failed`);
  }
  return result.stdout;
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

function readMainOptions(arguments_) {
  const release = JSON.parse(readFileSync(resolve(root, 'release/dsh-plugins.json'), 'utf8'));
  const value = (flag) => {
    const index = arguments_.indexOf(flag);
    return index < 0 ? undefined : arguments_[index + 1];
  };
  const version = value('--version') ?? release.version;
  const space = value('--space');
  const annotation = value('--annotation');
  if ((space && !annotation) || (!space && annotation)) {
    throw new Error('Local DSH verification requires both --space and --annotation tarballs');
  }
  const sources = space && annotation
    ? { [release.bundles[0]]: space, [release.bundles[1]]: annotation }
    : publicBundleSources(release, version);
  return { release, sources };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    verifyDshInstall(readMainOptions(process.argv.slice(2)));
  } catch (error) {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  }
}
