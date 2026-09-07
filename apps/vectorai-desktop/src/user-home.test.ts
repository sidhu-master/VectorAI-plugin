import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { rm } from 'node:fs/promises';

import { initializeUserHome } from './user-home.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'vectorai-user-home-'));
  roots.push(root);
  const userData = join(root, 'user-data');
  const profileSeedPath = join(root, 'seed', 'profiles');
  const templatePath = join(root, 'default-settings.yaml');
  await mkdir(join(profileSeedPath, 'web'), { recursive: true });
  await writeFile(join(profileSeedPath, 'web', 'cordis.yml'), 'version: one\n');
  await writeFile(templatePath, 'model: initial\n');
  return { root, userData, profileSeedPath, templatePath };
}

describe('initializeUserHome', () => {
  it('creates the private home, workspace, logs, profile, and settings', async () => {
    const input = await fixture();
    const result = await initializeUserHome({ ...input, runtimeVersion: 'one' });
    expect(await readFile(join(result.dshHome, 'settings.yaml'), 'utf8')).toBe('model: initial\n');
    expect(await readFile(join(result.dshHome, 'profiles', 'web', 'cordis.yml'), 'utf8')).toBe('version: one\n');
    expect(await readFile(join(result.dshHome, '.vectorai-profile-version'), 'utf8')).toBe('one\n');
    expect(result).toMatchObject({
      dshHome: join(input.userData, 'dsh-home'),
      logs: join(input.userData, 'logs'),
      workspace: join(input.userData, 'workspace'),
    });
  });

  it('replaces the owned profile on upgrade and preserves user data', async () => {
    const input = await fixture();
    const first = await initializeUserHome({ ...input, runtimeVersion: 'one' });
    await writeFile(join(first.dshHome, 'settings.yaml'), 'user-owned: true\n');
    await mkdir(join(first.dshHome, 'sessions'), { recursive: true });
    await writeFile(join(first.dshHome, 'sessions', 'kept.jsonl'), '{}\n');
    await writeFile(join(input.profileSeedPath, 'web', 'cordis.yml'), 'version: two\n');

    await initializeUserHome({ ...input, runtimeVersion: 'two' });

    expect(await readFile(join(first.dshHome, 'settings.yaml'), 'utf8')).toBe('user-owned: true\n');
    expect(await readFile(join(first.dshHome, 'sessions', 'kept.jsonl'), 'utf8')).toBe('{}\n');
    expect(await readFile(join(first.dshHome, 'profiles', 'web', 'cordis.yml'), 'utf8')).toBe('version: two\n');
    expect(await readFile(join(first.dshHome, '.vectorai-profile-version'), 'utf8')).toBe('two\n');
  });
});
