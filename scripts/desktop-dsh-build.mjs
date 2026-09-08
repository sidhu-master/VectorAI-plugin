// SPDX-License-Identifier: Apache-2.0

/** Commands required to turn an exact DSH checkout into release-grade artifacts. */
export function createDshBuildCommands(dshSource) {
  return [
    {
      command: 'corepack',
      args: ['pnpm@11.7.0', '--dir', dshSource, 'install', '--frozen-lockfile'],
    },
    {
      command: 'corepack',
      args: ['pnpm@11.7.0', '--dir', dshSource, 'run', 'build:official'],
    },
  ];
}
