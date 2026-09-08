// SPDX-License-Identifier: Apache-2.0

const windowsCommandShims = new Set(['corepack', 'npm', 'npx', 'pnpm']);

export function portableTarEnvironment(environment, platform = process.platform) {
  if (platform !== 'win32') return environment;
  return {
    ...environment,
    TAR_OPTIONS: [environment.TAR_OPTIONS, '--force-local'].filter(Boolean).join(' '),
  };
}

export function powershellExpandArchiveInvocation(archivePath, destinationPath, environment = process.env) {
  return {
    command: 'powershell.exe',
    args: [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Expand-Archive -LiteralPath $env:VECTORAI_NODE_ARCHIVE -DestinationPath $env:VECTORAI_NODE_DESTINATION -Force',
    ],
    environment: {
      ...environment,
      VECTORAI_NODE_ARCHIVE: archivePath,
      VECTORAI_NODE_DESTINATION: destinationPath,
    },
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
