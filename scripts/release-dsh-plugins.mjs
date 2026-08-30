// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { waitForNpmPackage } from './wait-for-npm-package.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const semver = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

export function parseReleaseArgs(arguments_) {
  const value = (flag) => {
    const index = arguments_.indexOf(flag);
    return index < 0 ? undefined : arguments_[index + 1];
  };
  const version = value('--version');
  const tag = value('--tag');
  if (!version || !semver.test(version)) throw new Error('A valid semver --version is required');
  if (!tag || !/^[a-z0-9][a-z0-9._-]*$/i.test(tag)) throw new Error('A valid --tag is required');
  return { version, tag };
}

export function assertCleanWorktree(status) {
  if (status.trim()) throw new Error('DSH release requires a clean worktree');
}

export function publicationOrder(manifest) {
  return [...manifest.runtimes.map((runtime) => runtime.name), ...manifest.bundles];
}

export function pendingPublications(order, receipt) {
  const completed = new Set((receipt.published ?? [])
    .filter((entry) => entry.integrity)
    .map((entry) => entry.name));
  return order.filter((name) => !completed.has(name));
}

export function installCommands(manifest) {
  return manifest.bundles.map((name) => [
    'plugin', '--profile', manifest.dsh.profile, 'add',
    ...(manifest.dsh.installArgs?.[name] ?? []), `${name}@${manifest.version}`,
  ]);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: options.cwd ?? root, encoding: 'utf8', stdio: options.inherit ? 'inherit' : 'pipe' });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || `${command} failed`);
  return result.stdout;
}

export async function runRelease() {
  const { version, tag } = parseReleaseArgs(process.argv.slice(2));
  assertCleanWorktree(run('git', ['status', '--porcelain']));
  run(process.execPath, ['scripts/set-dsh-release-version.mjs', '--version', version, '--tag', tag], { inherit: true });
  run('pnpm', ['pack:dsh-plugins'], { inherit: true });
  const manifest = JSON.parse(readFileSync(resolve(root, 'release/dsh-plugins.json'), 'utf8'));
  const receiptPath = resolve(root, 'dist/releases', version, 'release-receipt.json');
  mkdirSync(dirname(receiptPath), { recursive: true });
  const receipt = readFileOr(receiptPath, { version, tag, commit: run('git', ['rev-parse', 'HEAD']).trim(), published: [] });
  const order = publicationOrder(manifest);
  const artifacts = artifactMap(version, manifest);
  for (const name of order) {
    if (!existsSync(artifacts[name])) throw new Error(`Missing release artifact for ${name}@${version}: ${artifacts[name]}`);
  }

  run('npm', ['whoami'], { inherit: true });
  for (const name of pendingPublications(order, receipt)) {
    const tarball = artifacts[name];
    let entry = receipt.published.find((candidate) => candidate.name === name);
    if (!entry) {
      run('npm', ['publish', tarball, '--access', 'public', '--tag', tag], { inherit: true });
      entry = { name, version, tarball, publishedAt: new Date().toISOString() };
      receipt.published.push(entry);
      writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    }
    const metadata = await waitForNpmPackage(name, version);
    entry.integrity = metadata.dist.integrity;
    entry.visibleAt = new Date().toISOString();
    writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  }
  run(process.execPath, ['scripts/verify-public-dsh-install.mjs', '--version', version], { inherit: true });
  receipt.verifiedAt = new Date().toISOString();
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
}

function artifactMap(version, manifest) {
  const map = {};
  for (const runtime of manifest.runtimes) {
    map[runtime.name] = resolve(root, 'dist/releases', version, 'runtimes',
      `${runtime.name.replace('@newwe/', 'newwe-').replaceAll('/', '-')}-${version}.tgz`);
  }
  map[manifest.bundles[0]] = resolve(root, 'dist/npm', `newwe-vectorai-plugin-dsh-space-${version}.tgz`);
  map[manifest.bundles[1]] = resolve(root, 'dist/npm', `newwe-vectorai-plugin-dsh-annotation-${version}.tgz`);
  return map;
}

function readFileOr(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runRelease().catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
}
