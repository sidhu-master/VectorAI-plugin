// SPDX-License-Identifier: Apache-2.0

const windowsCommandShims = new Set(['corepack', 'npm', 'npx', 'pnpm']);

export function platformInvocation(
  command,
  args,
  platform = process.platform,
  commandShell = process.env.ComSpec || 'cmd.exe',
) {
  if (platform !== 'win32' || !windowsCommandShims.has(command)) return { command, args };
  return {
    command: commandShell,
    args: ['/d', '/s', '/c', `${command}.cmd`, ...args],
  };
}

export function platformTarCommand(platform = process.platform) {
  return platform === 'win32' ? 'tar' : '/usr/bin/tar';
}
