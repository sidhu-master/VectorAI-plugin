// SPDX-License-Identifier: Apache-2.0

export function isDevelopmentRuntimePath(relative) {
  const parts = relative.split(/[\\/]/u);
  if (parts.includes('.git')) return true;
  const dependencyBoundary = parts.indexOf('node_modules');
  const ownedParts = dependencyBoundary < 0 ? parts : parts.slice(0, dependencyBoundary);
  return ownedParts.some((part) => part === 'tests' || part === '__tests__');
}
