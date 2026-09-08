// SPDX-License-Identifier: Apache-2.0

/** Select the packed internal packages reachable from the DSH executable. */
export function selectPackedRuntimeClosure(packages, entryNames = '@deepseek-ai/dsh') {
  const byName = new Map(packages.map((entry) => [entry.manifest.name, entry]));
  const selected = new Map();
  const pending = Array.isArray(entryNames) ? [...entryNames] : [entryNames];
  while (pending.length > 0) {
    const name = pending.pop();
    if (selected.has(name)) continue;
    const entry = byName.get(name);
    if (!entry) throw new Error(`DESKTOP_DSH_PACKED_DEPENDENCY_MISSING:${name}`);
    selected.set(name, entry);
    for (const dependencies of [entry.manifest.dependencies, entry.manifest.peerDependencies]) {
      for (const dependency of Object.keys(dependencies ?? {})) {
        if (byName.has(dependency) && !selected.has(dependency)) pending.push(dependency);
      }
    }
  }
  return [...selected.values()].sort((left, right) =>
    left.manifest.name.localeCompare(right.manifest.name));
}

export function dshProductionInstallArgs() {
  return ['install', '--omit=dev', '--include=optional', '--no-audit', '--no-fund', '--package-lock=false'];
}

export function dshProductionInstallEnvironment(environment, cacheDirectory) {
  return {
    ...environment,
    NODE_OPTIONS: '',
    NODE_PATH: '',
    npm_config_cache: cacheDirectory,
  };
}

export function fsExtBuildCleanupPlan(platform) {
  const buildRoot = 'node_modules/fs-ext/build';
  if (platform === 'win32') {
    return {
      remove: [buildRoot],
      preserve: `${buildRoot}/Release/fs_ext.node`,
    };
  }
  return {
    remove: [
      `${buildRoot}/Release/.deps`,
      `${buildRoot}/Release/obj.target`,
      `${buildRoot}/Makefile`,
      `${buildRoot}/binding.Makefile`,
      `${buildRoot}/config.gypi`,
      `${buildRoot}/fs_ext.target.mk`,
      `${buildRoot}/gyp-mac-tool`,
    ],
    strip: platform === 'darwin' ? `${buildRoot}/Release/fs_ext.node` : undefined,
  };
}

export function createPortableDshManifest(packages) {
  return {
    name: 'vectorai-embedded-dsh',
    private: true,
    version: '0.0.0',
    dependencies: Object.fromEntries(packages
      .map(({ manifest }) => [manifest.name, manifest.version])
      .sort(([left], [right]) => left.localeCompare(right))),
  };
}
