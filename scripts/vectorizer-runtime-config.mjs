// SPDX-License-Identifier: Apache-2.0

export const RUNTIME_VERSION = '0.1.0-alpha.1';
export const PYTHON_VERSION = '3.13.2';
export const PROTOCOL_VERSION = 'vectorai-vectorizer-1';
export const PIPELINE_VERSION = 'clean-line-v5';

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
