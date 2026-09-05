// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';

const releaseManifest = JSON.parse(readFileSync(
  new URL('../release/dsh-plugins.json', import.meta.url),
  'utf8',
));

export const RUNTIME_VERSION = releaseManifest.version;
export const PYTHON_VERSION = releaseManifest.vectorizer.pythonVersion;
export const PROTOCOL_VERSION = releaseManifest.vectorizer.protocolVersion;
export const PIPELINE_VERSION = releaseManifest.vectorizer.pipelineVersion;
export const RUNTIME_DEPENDENCIES = Object.freeze(Object.fromEntries(
  ['numpy', 'opencv-python-headless', 'scikit-image'].map((name) => [
    name,
    releaseManifest.vectorizer.buildDependencies[name],
  ]),
));

export const RUNTIME_TARGETS = [
  { platform: 'darwin', arch: 'arm64' },
  { platform: 'darwin', arch: 'x64' },
  { platform: 'linux', arch: 'arm64' },
  { platform: 'linux', arch: 'x64' },
  { platform: 'win32', arch: 'x64' },
].map((target) => ({
  ...target,
  id: `${target.platform}-${target.arch}`,
  packageName: `@newwe/vectorai-vectorizer-${target.platform}-${target.arch}`,
}));

export function targetFor(platform = process.platform, arch = process.arch) {
  const target = RUNTIME_TARGETS.find((candidate) =>
    candidate.platform === platform && candidate.arch === arch);
  if (!target) throw new Error(`Unsupported vectorizer runtime target: ${platform}-${arch}`);
  return target;
}

export function runtimeExecutable(target) {
  const suffix = target.platform === 'win32' ? '.exe' : '';
  return `bin/vectorai-vectorizer/vectorai-vectorizer${suffix}`;
}
