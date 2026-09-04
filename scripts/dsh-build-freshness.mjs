// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFEST_VERSION = 1;
const MANIFEST_NAME = '.vectorai-build.json';
const TARGETS = {
  space: {
    entryPackages: ['plugin-dsh-space-host', 'plugin-dsh-space-client'],
    bundlePackage: 'plugin-dsh-space',
  },
  annotation: {
    entryPackages: ['plugin-dsh-annotation-host', 'plugin-dsh-annotation-client'],
    bundlePackage: 'plugin-dsh-annotation',
  },
};

export async function writeDshBuildFreshnessManifest({ root, target }) {
  const descriptor = targetDescriptor(root, target);
  const sourceFiles = await collectSourceFiles(descriptor);
  const artifactFiles = await collectArtifactFiles(descriptor.outputDir);
  const manifest = {
    version: MANIFEST_VERSION,
    target,
    sourceDigest: await digestFiles(root, sourceFiles),
    artifactDigest: await digestFiles(root, artifactFiles),
    sourceFiles: sourceFiles.map((path) => relative(root, path)).sort(),
    artifactFiles: artifactFiles.map((path) => relative(root, path)).sort(),
  };
  await writeFile(join(descriptor.outputDir, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export async function checkDshBuildFreshness({ root, target }) {
  const descriptor = targetDescriptor(root, target);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(descriptor.outputDir, MANIFEST_NAME), 'utf8'));
  } catch {
    return { fresh: false, reason: 'manifest-missing' };
  }
  if (manifest.version !== MANIFEST_VERSION || manifest.target !== target) {
    return { fresh: false, reason: 'manifest-incompatible' };
  }
  const sourceFiles = await collectSourceFiles(descriptor);
  const sourceDigest = await digestFiles(root, sourceFiles);
  if (sourceDigest !== manifest.sourceDigest) {
    return { fresh: false, reason: 'source-changed', expected: manifest.sourceDigest, actual: sourceDigest };
  }
  const artifactFiles = await collectArtifactFiles(descriptor.outputDir);
  const artifactDigest = await digestFiles(root, artifactFiles);
  if (artifactDigest !== manifest.artifactDigest) {
    return { fresh: false, reason: 'artifact-changed', expected: manifest.artifactDigest, actual: artifactDigest };
  }
  return { fresh: true, sourceDigest, artifactDigest };
}

async function collectSourceFiles(descriptor) {
  const packages = await workspacePackages(descriptor.root);
  const selected = new Set();
  const visit = (directoryName) => {
    if (selected.has(directoryName)) return;
    const workspacePackage = packages.byDirectory.get(directoryName);
    if (!workspacePackage) throw new Error(`Unknown workspace package: ${directoryName}`);
    selected.add(directoryName);
    for (const dependencyName of workspaceDependencyNames(workspacePackage.manifest)) {
      const dependency = packages.byName.get(dependencyName);
      if (dependency) visit(dependency.directoryName);
    }
  };
  descriptor.entryPackages.forEach(visit);

  const files = [];
  for (const directoryName of [...selected].sort()) {
    const packageDirectory = join(descriptor.packagesDir, directoryName);
    files.push(join(packageDirectory, 'package.json'));
    files.push(...await filesBelow(join(packageDirectory, 'src'), isRuntimeSource));
  }
  for (const name of ['package.json', 'cordis.patch.yml']) {
    const path = join(descriptor.bundleDir, name);
    if (await exists(path)) files.push(path);
  }
  for (const scriptName of ['build-dsh-space.mjs', 'dsh-build-freshness.mjs']) {
    const scriptPath = join(descriptor.root, 'scripts', scriptName);
    if (await exists(scriptPath)) files.push(scriptPath);
  }
  return unique(files);
}

async function workspacePackages(root) {
  const packagesDir = join(root, 'packages');
  const byName = new Map();
  const byDirectory = new Map();
  for (const entry of await readdir(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(packagesDir, entry.name, 'package.json');
    if (!await exists(manifestPath)) continue;
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const workspacePackage = { directoryName: entry.name, manifest };
    byDirectory.set(entry.name, workspacePackage);
    if (typeof manifest.name === 'string') byName.set(manifest.name, workspacePackage);
  }
  return { byName, byDirectory };
}

function workspaceDependencyNames(manifest) {
  return Object.entries({
    ...(manifest.dependencies ?? {}),
    ...(manifest.optionalDependencies ?? {}),
  }).flatMap(([name, version]) => String(version).startsWith('workspace:') ? [name] : []);
}

async function collectArtifactFiles(outputDir) {
  return filesBelow(outputDir, (path) => !path.endsWith(`/${MANIFEST_NAME}`) && !path.endsWith(`\\${MANIFEST_NAME}`));
}

async function filesBelow(directory, include) {
  if (!await exists(directory)) return [];
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(path, include));
    else if (entry.isFile() && include(path)) files.push(path);
  }
  return files;
}

function isRuntimeSource(path) {
  return !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)
    && !path.includes(`${join('test', 'fixtures')}`)
    && !path.includes(`${join('__tests__')}`);
}

async function digestFiles(root, files) {
  const hash = createHash('sha256');
  for (const path of [...files].sort()) {
    hash.update(relative(root, path));
    hash.update('\0');
    hash.update(await readFile(path));
    hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}

function targetDescriptor(rootInput, target) {
  const root = resolve(rootInput);
  const value = TARGETS[target];
  if (!value) throw new Error(`Unknown DSH build target: ${target}`);
  const packagesDir = join(root, 'packages');
  const bundleDir = join(packagesDir, value.bundlePackage);
  return {
    root,
    packagesDir,
    bundleDir,
    outputDir: join(bundleDir, 'lib'),
    entryPackages: value.entryPackages,
  };
}

async function exists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    try {
      await readdir(path);
      return true;
    } catch {
      return false;
    }
  }
}

function unique(values) {
  return [...new Set(values)];
}

export function defaultRepositoryRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}
