import { access, copyFile, cp, link, lstat, mkdir, readFile, readdir, readlink, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

export interface InitializeUserHomeOptions {
  userData: string;
  profileSeedPath: string;
  templatePath: string;
  runtimeVersion: string;
}

export interface UserHomePaths {
  dshHome: string;
  logs: string;
  workspace: string;
}

const PROFILE_LAYOUT_VERSION = 3;

export function installedProfileVersion(runtimeVersion: string): string {
  return `${runtimeVersion}:profile-${PROFILE_LAYOUT_VERSION}`;
}

export async function initializeUserHome(options: InitializeUserHomeOptions): Promise<UserHomePaths> {
  const dshHome = join(options.userData, 'dsh-home');
  const logs = join(options.userData, 'logs');
  const workspace = join(options.userData, 'workspace');
  await Promise.all([
    mkdir(dshHome, { recursive: true }),
    mkdir(logs, { recursive: true }),
    mkdir(workspace, { recursive: true }),
  ]);

  const settingsPath = join(dshHome, 'settings.yaml');
  if (!(await exists(settingsPath))) {
    const temporarySettings = `${settingsPath}.tmp-${process.pid}`;
    await copyFile(options.templatePath, temporarySettings);
    await rename(temporarySettings, settingsPath);
  }

  const versionPath = join(dshHome, '.vectorai-profile-version');
  const installedVersion = await readOptional(versionPath);
  if (installedVersion?.trim() !== options.runtimeVersion) {
    await replaceOwnedProfiles(dshHome, options.profileSeedPath);
    const temporaryVersion = `${versionPath}.tmp-${process.pid}`;
    await writeFile(temporaryVersion, `${options.runtimeVersion}\n`, 'utf8');
    await rename(temporaryVersion, versionPath);
  }

  return { dshHome, logs, workspace };
}

async function replaceOwnedProfiles(dshHome: string, profileSeedPath: string): Promise<void> {
  const destination = join(dshHome, 'profiles');
  const temporary = join(dshHome, `.profiles-next-${process.pid}`);
  const backup = join(dshHome, `.profiles-previous-${process.pid}`);
  await rm(temporary, { recursive: true, force: true });
  await rm(backup, { recursive: true, force: true });
  await cp(profileSeedPath, temporary, {
    recursive: true,
    force: false,
    filter: (source) => basename(source) !== 'node_modules',
  });
  await materializeProfileModules(profileSeedPath, temporary);

  const hadPrevious = await exists(destination);
  try {
    if (hadPrevious) await rename(destination, backup);
    await rename(temporary, destination);
    await rm(backup, { recursive: true, force: true });
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    if (hadPrevious && !(await exists(destination)) && await exists(backup)) {
      await rename(backup, destination);
    }
    throw error;
  }
}

async function materializeProfileModules(sourceProfiles: string, destinationProfiles: string): Promise<void> {
  for (const entry of await readdir(sourceProfiles, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sourceModules = join(sourceProfiles, entry.name, 'node_modules');
    if (!(await exists(sourceModules))) continue;
    const destinationModules = join(destinationProfiles, entry.name, 'node_modules');
    await mkdir(destinationModules, { recursive: true });
    await cloneTreeWithHardlinks(sourceModules, destinationModules);
  }
}

async function cloneTreeWithHardlinks(source: string, destination: string): Promise<void> {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);
    if (entry.isDirectory()) {
      await mkdir(destinationPath);
      await cloneTreeWithHardlinks(sourcePath, destinationPath);
      continue;
    }
    if (entry.isSymbolicLink()) {
      await symlink(await readlink(sourcePath), destinationPath);
      continue;
    }
    if (!(await lstat(sourcePath)).isFile()) continue;
    try {
      await link(sourcePath, destinationPath);
    } catch (error) {
      if (!['EXDEV', 'EPERM', 'EACCES', 'ENOTSUP'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
      await copyFile(sourcePath, destinationPath);
    }
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}
