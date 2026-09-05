// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';
import { accessSync, constants, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import {
  PIPELINE_VERSION, PROTOCOL_VERSION, PYTHON_VERSION, RUNTIME_DEPENDENCIES,
} from './vectorizer-runtime-config.mjs';

const exactVersion = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function contained(root, candidate) {
  const path = relative(root, candidate);
  return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function runtimeTreeDigest(files) {
  const tree = Object.entries(files).sort(([left], [right]) => left.localeCompare(right))
    .map(([entry, digest]) => `${entry}:${digest}\n`).join('');
  return `sha256:${createHash('sha256').update(tree).digest('hex')}`;
}

export function auditRuntimePackage(packageRoot, expected) {
  const root = realpathSync(packageRoot);
  const manifest = readJson(resolve(root, 'package.json'));
  const runtime = readJson(resolve(root, 'runtime.json'));
  const expectedName = `@newwe/vectorai-vectorizer-${expected.platform}-${expected.arch}`;

  if (manifest.name !== expectedName) throw new Error(`Runtime package name mismatch: ${manifest.name}`);
  if (manifest.version !== expected.version || runtime.releaseVersion !== expected.version) {
    throw new Error('Runtime release version mismatch');
  }
  if (runtime.platform !== expected.platform || runtime.arch !== expected.arch) {
    throw new Error('Runtime platform metadata mismatch');
  }
  if (JSON.stringify(manifest.os) !== JSON.stringify([expected.platform]) ||
      JSON.stringify(manifest.cpu) !== JSON.stringify([expected.arch])) {
    throw new Error('npm os/cpu metadata mismatch');
  }
  if (runtime.protocolVersion !== PROTOCOL_VERSION || runtime.pipelineVersion !== PIPELINE_VERSION) {
    throw new Error('Runtime protocol metadata mismatch');
  }
  if (runtime.pythonVersion !== PYTHON_VERSION) throw new Error('Runtime Python version mismatch');
  if (!runtime.dependencies || typeof runtime.dependencies !== 'object' || Array.isArray(runtime.dependencies)) {
    throw new Error('Runtime dependency metadata is missing');
  }
  for (const [name, version] of Object.entries(RUNTIME_DEPENDENCIES)) {
    if (runtime.dependencies[name] !== version) {
      throw new Error(`Runtime dependency version mismatch: ${name}`);
    }
  }
  if (typeof runtime.sourceCommit !== 'string' || !/^[a-f0-9]{40}$/.test(runtime.sourceCommit)) {
    throw new Error('Runtime source commit is invalid');
  }
  if (manifest.dsh) throw new Error('Runtime dependency package must not contain dsh metadata');
  if (manifest.scripts) throw new Error('Runtime dependency package must not contain lifecycle scripts');
  if (manifest.publishConfig?.access !== 'public' || manifest.license !== 'Apache-2.0') {
    throw new Error('Runtime publication metadata mismatch');
  }
  for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      if (typeof version !== 'string' || !exactVersion.test(version)) {
        throw new Error(`Runtime dependency is not pinned: ${name}@${String(version)}`);
      }
    }
  }

  if (typeof runtime.executable !== 'string' || isAbsolute(runtime.executable)) {
    throw new Error('Runtime executable path is invalid');
  }
  const executable = resolve(root, runtime.executable);
  if (!contained(root, executable)) throw new Error('Runtime executable escapes package');
  try {
    accessSync(executable, expected.platform === 'win32' ? constants.R_OK : constants.R_OK | constants.X_OK);
  } catch {
    throw new Error(`Runtime executable is missing or inaccessible: ${runtime.executable}`);
  }
  if (!lstatSync(executable).isFile()) throw new Error('Runtime executable is not a regular file');

  const files = runtime.files;
  if (!files || typeof files !== 'object' || !Object.hasOwn(files, runtime.executable)) {
    throw new Error('Runtime executable digest is missing');
  }
  for (const [entry, digest] of Object.entries(files)) {
    const file = resolve(root, entry);
    if (!contained(root, file) || lstatSync(file).isSymbolicLink()) {
      throw new Error(`Runtime file path is unsafe: ${entry}`);
    }
    if (sha256(file) !== digest) throw new Error(`Runtime file digest mismatch: ${entry}`);
  }
  if (runtime.treeSha256 !== runtimeTreeDigest(files)) {
    throw new Error('Runtime tree digest mismatch');
  }
  return manifest;
}
