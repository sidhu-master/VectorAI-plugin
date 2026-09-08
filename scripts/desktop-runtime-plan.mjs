// SPDX-License-Identifier: Apache-2.0

const TARGETS = new Set(['darwin-arm64', 'darwin-x64', 'win32-x64']);
const STEP_IDS = [
  'verify-clean-source',
  'build-vectorizer',
  'pack-vectorai-bundles',
  'checkout-dsh',
  'build-dsh',
  'pack-dsh-families',
  'install-dsh-closure',
  'install-space',
  'install-annotation',
  'write-settings',
  'write-manifest',
  'audit-runtime',
];

export const DESKTOP_NODE_VERSION = '22.19.0';

export function createDesktopRuntimePlan(release, target) {
  if (!TARGETS.has(target)) throw new Error(`DESKTOP_RUNTIME_TARGET_UNSUPPORTED:${target}`);
  if (!release?.dsh?.version || !release?.dsh?.commit || release?.dsh?.profile !== 'web') {
    throw new Error('DESKTOP_RUNTIME_RELEASE_INVALID');
  }
  if (JSON.stringify(release.bundles) !== JSON.stringify([
    '@newwe/vectorai-plugin-dsh-space',
    '@newwe/vectorai-plugin-dsh-annotation',
  ])) throw new Error('DESKTOP_RUNTIME_BUNDLE_ORDER_INVALID');
  return {
    target,
    nodeVersion: DESKTOP_NODE_VERSION,
    steps: STEP_IDS.map((id) => ({ id })),
    installCommands: [
      { bundle: release.bundles[0], allowBuild: [] },
      { bundle: release.bundles[1], allowBuild: release.dsh.installArgs?.[release.bundles[1]]
        ?.filter((argument) => argument.startsWith('--allow-build='))
        .map((argument) => argument.slice('--allow-build='.length)) ?? [] },
    ],
  };
}

export function parseDesktopTarget(target = `${process.platform}-${process.arch}`) {
  if (!TARGETS.has(target)) throw new Error(`DESKTOP_RUNTIME_TARGET_UNSUPPORTED:${target}`);
  const separator = target.indexOf('-');
  return { id: target, platform: target.slice(0, separator), arch: target.slice(separator + 1) };
}

export function desktopUnpackedDirectoryName(target) {
  if (target.platform === 'win32') return 'win-unpacked';
  return target.arch === 'x64' ? 'mac' : `mac-${target.arch}`;
}
