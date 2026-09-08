// SPDX-License-Identifier: Apache-2.0

const windowsCommandShims = new Set(['corepack', 'npm', 'npx', 'pnpm']);

export function portableTarEnvironment(environment, platform = process.platform) {
  if (platform !== 'win32') return environment;
  return {
    ...environment,
    TAR_OPTIONS: [environment.TAR_OPTIONS, '--force-local'].filter(Boolean).join(' '),
  };
}

export function platformInvocation(
  command,
  args,
  platform = process.platform,
  commandShell = process.env.ComSpec || 'cmd.exe',
) {
  if (platform !== 'win32') return { command, args };
  if (command === 'tar') return { command, args: ['--force-local', ...args] };
  if (!windowsCommandShims.has(command)) return { command, args };
  return {
    command: commandShell,
    args: ['/d', '/s', '/c', `${command}.cmd`, ...args],
  };
}
