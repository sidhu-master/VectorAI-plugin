// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

import { prepareCredential } from './prepare-desktop-credential.mjs';
import { createDshBuildCommands } from './desktop-dsh-build.mjs';
import { selectPackedRuntimeClosure } from './desktop-dsh-closure.mjs';
import {
  createLocalPackageOverrides,
  sanitizeInstalledProfileManifest,
  vectorizerProfileDirectory,
} from './desktop-profile-bootstrap.mjs';
import { createDesktopRuntimePlan, DESKTOP_NODE_VERSION, parseDesktopTarget } from './desktop-runtime-plan.mjs';
import { materializeBundleRuntimeDependencies } from './set-dsh-release-version.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const release = JSON.parse(await readFile(resolve(root, 'release/dsh-plugins.json'), 'utf8'));
const targetArgument = argumentValue('--target') ?? `${process.platform}-${process.arch}`;
const target = parseDesktopTarget(targetArgument);
createDesktopRuntimePlan(release, target.id);

if (`${process.platform}-${process.arch}` !== target.id) {
  throw new Error(`DESKTOP_RUNTIME_NATIVE_BUILD_REQUIRED:${target.id}`);
}
assertCleanSource();

const output = resolve(root, 'dist/desktop-runtime', target.id);
const temporaryRoot = await mkdtemp(join(tmpdir(), `vectorai-desktop-${target.id}-`));
let succeeded = false;
try {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });

  run('pnpm', ['runtime:pack'], root);
  await packVectorAiBundles();

  const dshSource = await resolveDshSource(temporaryRoot);
  run(process.execPath, [resolve(root, 'scripts/check-dsh-source-runtime.mjs'), dshSource], root);
  for (const command of createDshBuildCommands(dshSource)) {
    run(command.command, command.args, root);
  }

  const vendorPacks = join(temporaryRoot, 'dsh-vendor-packs');
  const dshPacks = join(temporaryRoot, 'dsh-packs');
  run('corepack', ['pnpm@11.7.0', '--dir', dshSource, 'exec', 'tsx', 'scripts/release/pack.ts', '--family', 'vendor', '--out', vendorPacks], root);
  run('corepack', ['pnpm@11.7.0', '--dir', dshSource, 'exec', 'tsx', 'scripts/release/pack.ts', '--family', 'dsh', '--out', dshPacks], root);

  await installNodeRuntime(output, temporaryRoot, target);
  const packedDshPackages = await readPackedPackages([vendorPacks, dshPacks]);
  await installDshClosure(output, selectPackedRuntimeClosure(packedDshPackages));
  const nodeExecutable = target.platform === 'win32'
    ? join(output, 'node', 'node.exe')
    : join(output, 'node', 'bin', 'node');
  const dshEntry = join(output, 'dsh/node_modules/@deepseek-ai/dsh/lib/bin.js');
  const dshVersion = capture(nodeExecutable, [dshEntry, '--version'], root).trim();
  if (dshVersion !== release.dsh.version) {
    throw new Error(`DESKTOP_DSH_VERSION_MISMATCH:${dshVersion}`);
  }

  const assemblyHome = join(temporaryRoot, 'profile-home');
  await mkdir(assemblyHome, { recursive: true });
  const packedProfilePackages = await readPackedPackages([vendorPacks, dshPacks, resolve(root, 'dist/npm')]);
  const spaceBundle = release.bundles[0];
  const annotationBundle = release.bundles[1];
  const spaceClosure = selectPackedRuntimeClosure(packedProfilePackages, spaceBundle);
  const annotationClosure = selectPackedRuntimeClosure(packedProfilePackages, annotationBundle);
  const vectorizer = await packedPackage(await packedVectorizerTarball(target));
  const profilePackages = uniquePackedPackages([...spaceClosure, ...annotationClosure, vectorizer]);
  const environment = {
    ...process.env,
    DSH_HOME: assemblyHome,
    DSH_TELEMETRY_DISABLED: '1',
    PATH: `${dirname(nodeExecutable)}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}`,
  };
  run(nodeExecutable, [
    dshEntry, 'plugin', '--profile', release.dsh.profile, 'why', '@deepseek-ai/dsh-base',
  ], root, environment);
  const profileRoot = join(assemblyHome, 'profiles', release.dsh.profile);
  const profileManifestPath = join(profileRoot, 'package.json');
  const profileManifest = JSON.parse(await readFile(profileManifestPath, 'utf8'));
  profileManifest.pnpm = {
    ...profileManifest.pnpm,
    overrides: createLocalPackageOverrides(profilePackages),
  };
  await writeFile(profileManifestPath, `${JSON.stringify(profileManifest, null, 2)}\n`);
  run(nodeExecutable, [
    dshEntry, 'plugin', '--profile', release.dsh.profile, 'add', '--workspace-root',
    ...spaceClosure.map(({ tarball }) => tarball), vectorizer.tarball,
  ], root, environment);
  run(nodeExecutable, [
    dshEntry, 'plugin', '--profile', release.dsh.profile, 'add', '--workspace-root', '--allow-build=tesseract.js',
    ...annotationClosure.map(({ tarball }) => tarball),
  ], root, environment);

  const installedManifest = JSON.parse(await readFile(profileManifestPath, 'utf8'));
  const installedBundles = installedManifest.dsh?.profile?.bundles ?? [];
  let previousBundle = -1;
  for (const bundle of release.bundles) {
    const index = installedBundles.indexOf(bundle);
    if (index <= previousBundle) throw new Error(`DESKTOP_PROFILE_BUNDLE_MISSING_OR_UNORDERED:${bundle}`);
    previousBundle = index;
  }
  await writeFile(profileManifestPath, `${JSON.stringify(
    sanitizeInstalledProfileManifest(installedManifest, profilePackages), null, 2,
  )}\n`);
  await rm(join(profileRoot, 'pnpm-lock.yaml'), { force: true });

  await replaceInstalledVectorizer(assemblyHome, target);
  await mkdir(join(output, 'profile-seed'), { recursive: true });
  await cp(join(assemblyHome, 'profiles'), join(output, 'profile-seed', 'profiles'), { recursive: true });
  await cp(
    resolve(root, 'apps/vectorai-desktop/resources/default-settings.yaml'),
    join(output, 'default-settings.yaml'),
  );
  await prepareCredential({
    key: process.env.VECTORAI_TEST_API_KEY,
    output: join(output, 'secrets', 'vectorai-test-api-key'),
  });
  await collectLicenses(output, dshSource);

  const sourceCommit = capture('git', ['rev-parse', 'HEAD'], root).trim();
  const manifest = {
    schemaVersion: 1,
    vectoraiVersion: release.version,
    sourceCommit,
    dsh: { version: release.dsh.version, commit: release.dsh.commit },
    nodeVersion: DESKTOP_NODE_VERSION,
    profile: release.dsh.profile,
    bundles: release.bundles,
    platform: target.platform,
    arch: target.arch,
    entry: 'dsh/node_modules/@deepseek-ai/dsh/lib/bin.js',
  };
  await writeFile(join(output, 'runtime-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  run(process.execPath, [resolve(root, 'scripts/verify-desktop-runtime.mjs'), '--runtime', output], root);
  succeeded = true;
  process.stdout.write(`Desktop runtime assembled: ${output}\n`);
} finally {
  if (succeeded || process.env.VECTORAI_KEEP_DESKTOP_BUILD_TEMP !== '1') {
    await rm(temporaryRoot, { recursive: true, force: true });
  } else {
    process.stderr.write(`Desktop build temporary directory retained: ${temporaryRoot}\n`);
  }
}

function assertCleanSource() {
  const status = capture('git', ['status', '--porcelain', '--untracked-files=all'], root).trim();
  if (status) throw new Error('DESKTOP_BUILD_REQUIRES_CLEAN_WORKTREE');
}

async function resolveDshSource(temporaryRoot) {
  const directory = join(temporaryRoot, 'deepseek-harness');
  if (process.env.DSH_SOURCE_DIR) {
    const source = resolve(process.env.DSH_SOURCE_DIR);
    run('git', ['clone', '--no-checkout', source, directory], root);
    run('git', ['-C', directory, 'checkout', '--detach', release.dsh.commit], root);
  } else {
    run('git', ['clone', '--depth', '1', '--branch', release.dsh.tag, 'https://github.com/deepseek-ai/deepseek-harness.git', directory], root);
  }
  const commit = capture('git', ['-C', directory, 'rev-parse', 'HEAD'], root).trim();
  if (commit !== release.dsh.commit) throw new Error(`DESKTOP_DSH_COMMIT_MISMATCH:${commit}`);
  return directory;
}

async function installNodeRuntime(output, temporaryRoot, target) {
  const stem = `node-v${DESKTOP_NODE_VERSION}-${target.platform === 'win32' ? 'win' : 'darwin'}-${target.arch}`;
  const archiveName = target.platform === 'win32' ? `${stem}.zip` : `${stem}.tar.gz`;
  const base = `https://nodejs.org/dist/v${DESKTOP_NODE_VERSION}`;
  const cache = resolve(root, 'dist/desktop-cache/node', DESKTOP_NODE_VERSION);
  const sumsPath = join(cache, 'SHASUMS256.txt');
  const archivePath = join(cache, archiveName);
  await mkdir(cache, { recursive: true });
  await downloadIfMissing(`${base}/SHASUMS256.txt`, sumsPath);
  await downloadIfMissing(`${base}/${archiveName}`, archivePath);
  const expected = (await readFile(sumsPath, 'utf8')).split(/\r?\n/u)
    .find((line) => line.endsWith(`  ${archiveName}`))?.split(/\s/u, 1)[0];
  let archive = await readFile(archivePath);
  let actual = createHash('sha256').update(archive).digest('hex');
  if (expected && actual !== expected) {
    await rm(archivePath, { force: true });
    await downloadIfMissing(`${base}/${archiveName}`, archivePath);
    archive = await readFile(archivePath);
    actual = createHash('sha256').update(archive).digest('hex');
  }
  if (!expected || actual !== expected) throw new Error('DESKTOP_NODE_ARCHIVE_DIGEST_MISMATCH');
  const extracted = join(temporaryRoot, 'node-extracted');
  await mkdir(extracted, { recursive: true });
  if (target.platform === 'win32') {
    run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force', archivePath, extracted], root);
  } else {
    run('tar', ['-xzf', archivePath, '-C', extracted], root);
  }
  await cp(join(extracted, stem), join(output, 'node'), { recursive: true });
}

async function downloadIfMissing(url, destination) {
  try {
    await readFile(destination);
    return;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const partial = `${destination}.partial-${process.pid}`;
  try {
    const executable = process.platform === 'win32' ? 'curl.exe' : 'curl';
    run(executable, [
      '--fail', '--location', '--silent', '--show-error', '--retry', '3',
      '--continue-at', '-', '--connect-timeout', '15', '--max-time', '900',
      '--output', partial, url,
    ], root);
    await rm(destination, { force: true });
    await cp(partial, destination);
  } finally {
    await rm(partial, { force: true });
  }
}

async function readPackedPackages(packDirectories) {
  const packed = [];
  for (const directory of packDirectories) {
    for (const filename of (await readdir(directory)).filter((name) => name.endsWith('.tgz')).sort()) {
      const tarball = join(directory, filename);
      const manifest = JSON.parse(capture('tar', ['-xOzf', tarball, 'package/package.json'], root));
      packed.push({ manifest, tarball });
    }
  }
  return packed;
}

async function packedPackage(tarball) {
  const manifest = JSON.parse(capture('tar', ['-xOzf', tarball, 'package/package.json'], root));
  return { manifest, tarball };
}

function uniquePackedPackages(packed) {
  return [...new Map(packed.map((entry) => [entry.manifest.name, entry])).values()];
}

async function installDshClosure(output, packed) {
  const dependencies = Object.fromEntries(packed
    .map(({ manifest, tarball }) => [manifest.name, pathToFileURL(tarball).href]));
  const dshRoot = join(output, 'dsh');
  await mkdir(dshRoot, { recursive: true });
  await writeFile(join(dshRoot, 'package.json'), `${JSON.stringify({
    name: 'vectorai-embedded-dsh', private: true, version: '0.0.0', dependencies,
  }, null, 2)}\n`);
  run('npm', [
    'install', '--omit=dev', '--omit=optional', '--ignore-scripts', '--no-audit', '--no-fund',
    '--package-lock=false',
  ], dshRoot, { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' });
}

async function packedVectorizerTarball(target) {
  const directory = resolve(root, 'dist/vectorizer-runtime', target.id, 'tarballs');
  const matches = (await readdir(directory)).filter((name) => name.endsWith('.tgz'));
  if (matches.length !== 1) throw new Error(`DESKTOP_VECTORIZER_TARBALL_INVALID:${target.id}`);
  return join(directory, matches[0]);
}

async function packVectorAiBundles() {
  const spacePath = resolve(root, 'packages/plugin-dsh-space/package.json');
  const annotationPath = resolve(root, 'packages/plugin-dsh-annotation/package.json');
  const originals = new Map(await Promise.all([spacePath, annotationPath].map(async (path) => [
    path, await readFile(path, 'utf8'),
  ])));
  try {
    const spaceSource = JSON.parse(originals.get(spacePath));
    const annotationSource = JSON.parse(originals.get(annotationPath));
    const space = materializeBundleRuntimeDependencies(spaceSource, spaceSource.name, release.dsh);
    const annotation = materializeBundleRuntimeDependencies(annotationSource, annotationSource.name, release.dsh);
    space.version = release.version;
    space.optionalDependencies = Object.fromEntries(
      release.runtimes.map((runtime) => [runtime.name, release.version]),
    );
    annotation.version = release.version;
    annotation.peerDependencies[space.name] = release.version;
    await Promise.all([
      writeFile(spacePath, `${JSON.stringify(space, null, 2)}\n`),
      writeFile(annotationPath, `${JSON.stringify(annotation, null, 2)}\n`),
    ]);
    run('pnpm', ['pack:dsh-plugins'], root);
  } finally {
    await Promise.all([...originals].map(([path, content]) => writeFile(path, content)));
  }
}

async function replaceInstalledVectorizer(assemblyHome, target) {
  const runtime = release.runtimes.find((candidate) =>
    candidate.platform === target.platform && candidate.arch === target.arch);
  if (!runtime) throw new Error(`DESKTOP_VECTORIZER_TARGET_MISSING:${target.id}`);
  const destination = vectorizerProfileDirectory(assemblyHome, release.dsh.profile, runtime.name);
  const source = resolve(root, 'dist/vectorizer-runtime', target.id, 'package');
  await rm(destination, { recursive: true, force: true });
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
}

async function collectLicenses(output, dshSource) {
  const licenses = join(output, 'licenses');
  await mkdir(licenses, { recursive: true });
  await cp(resolve(root, 'LICENSE'), join(licenses, 'VectorAI-LICENSE'));
  await cp(resolve(dshSource, 'LICENSE'), join(licenses, 'DSH-LICENSE'));
  const nodeLicense = target.platform === 'win32'
    ? join(output, 'node', 'LICENSE')
    : join(output, 'node', 'LICENSE');
  await cp(nodeLicense, join(licenses, 'Node.js-LICENSE'));
  await writeFile(join(licenses, 'README.txt'), [
    'VectorAI includes third-party packages inside the DSH and profile node_modules directories.',
    'Their package manifests and included license files remain beside the installed packages.',
    '',
  ].join('\n'));
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(`${basename(command)} failed with status ${String(result.status)}`);
  }
}

function capture(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(result.stderr || `${basename(command)} failed with status ${String(result.status)}`);
  }
  return result.stdout;
}
