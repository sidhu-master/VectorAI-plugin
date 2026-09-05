// SPDX-License-Identifier: Apache-2.0

export function bundleInstallCommands({ release, sources }) {
  if (!Array.isArray(release?.bundles) || release.bundles.length !== 2) {
    throw new Error('DSH install plan requires exactly two ordered Bundles');
  }
  return release.bundles.map((name) => {
    const source = sources?.[name];
    if (typeof source !== 'string' || source.length === 0) {
      throw new Error(`Missing DSH Bundle install source: ${name}`);
    }
    return [
      'plugin', '--profile', release.dsh.profile, 'add',
      ...(release.dsh.installArgs?.[name] ?? []), source,
    ];
  });
}

export function publicBundleSources(release, version = release.version) {
  return Object.fromEntries(release.bundles.map((name) => [name, `${name}@${version}`]));
}
