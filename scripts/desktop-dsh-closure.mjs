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
