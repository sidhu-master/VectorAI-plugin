import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { DSHProcessManager } from './process-manager.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(mode: 'ready' | 'silent' = 'ready') {
  const root = await mkdtemp(join(tmpdir(), 'vectorai-process-manager-'));
  roots.push(root);
  const script = join(root, 'fake-dsh.mjs');
  const environmentPath = join(root, 'environment.json');
  const source = mode === 'ready' ? `
    import { writeFileSync } from 'node:fs';
    const port = process.argv[process.argv.indexOf('--port') + 1];
    writeFileSync(${JSON.stringify(environmentPath)}, JSON.stringify({
      DSH_HOME: process.env.DSH_HOME,
      VECTORAI_TEST_API_KEY: process.env.VECTORAI_TEST_API_KEY,
      host: process.argv[process.argv.indexOf('--host') + 1],
    }));
    console.log('dsh web: http://127.0.0.1:' + port + '/?token=fixture-token');
    setTimeout(() => console.error('POST_READY_LINE'), 20);
    setInterval(() => {}, 1000);
  ` : `setInterval(() => {}, 1000);`;
  await writeFile(script, source);
  return {
    root,
    environmentPath,
    manager: new DSHProcessManager({
      nodeExecutable: process.execPath,
      dshEntry: script,
      dshHome: join(root, 'dsh-home'),
      workspace: root,
      logPath: join(root, 'logs', 'dsh.log'),
      credential: 'fixture-key',
      statePath: join(root, 'owned-process.json'),
      startupTimeoutMs: mode === 'ready' ? 5_000 : 100,
    }),
  };
}

describe('DSHProcessManager', () => {
  it('starts on loopback, passes private state to the child, and stops it', async () => {
    const { manager, environmentPath, root } = await fixture();
    const ready = await manager.start();
    expect(ready.hostname).toBe('127.0.0.1');
    expect(ready.searchParams.get('token')).toBe('fixture-token');
    expect(JSON.parse(await readFile(environmentPath, 'utf8'))).toEqual({
      DSH_HOME: join(root, 'dsh-home'),
      VECTORAI_TEST_API_KEY: 'fixture-key',
      host: '127.0.0.1',
    });
    const pid = manager.processIdentifier;
    expect(pid).toBeGreaterThan(0);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(await readFile(join(root, 'logs', 'dsh.log'), 'utf8')).toContain('POST_READY_LINE');
    await manager.stop();
    expect(processIsAlive(pid)).toBe(false);
    await expect(access(join(root, 'owned-process.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('kills a child that never becomes ready', async () => {
    const { manager } = await fixture('silent');
    await expect(manager.start()).rejects.toThrow('DSH_STARTUP_TIMEOUT');
    expect(processIsAlive(manager.processIdentifier)).toBe(false);
  });
});

function processIsAlive(pid: number): boolean {
  if (pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
