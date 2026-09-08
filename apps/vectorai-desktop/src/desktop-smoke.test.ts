import { spawn, type ChildProcess } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { desktopUnpackedDirectoryName, parseDesktopTarget } from '../../../scripts/desktop-runtime-plan.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const unpackedDirectory = desktopUnpackedDirectoryName(parseDesktopTarget(`${process.platform}-${process.arch}`));
const executable = process.env.VECTORAI_DESKTOP_SMOKE_APP ?? (process.platform === 'darwin'
  ? join(repositoryRoot, 'dist', 'desktop-installers', unpackedDirectory, 'VectorAI.app', 'Contents', 'MacOS', 'VectorAI')
  : join(repositoryRoot, 'dist', 'desktop-installers', unpackedDirectory, 'VectorAI.exe'));
const roots: string[] = [];
const instances: Array<Awaited<ReturnType<typeof launch>>> = [];

afterAll(async () => {
  for (const instance of instances.splice(0)) await stop(instance);
  for (const root of roots.splice(0)) {
    await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  }
});

describe('packaged VectorAI desktop', () => {
  it('boots its bundled runtime, preserves user data, and owns the DSH lifecycle', async () => {
    await access(executable);
    const root = await mkdtemp(join(tmpdir(), 'vectorai-packaged-smoke-'));
    roots.push(root);
    const userData = join(root, 'user-data');

    const first = await launch(userData, 'first');
    instances.push(first);
    expect(first.ready.page.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\//u);
    expect(`${first.ready.page.title}\n${first.ready.page.text}`).not.toMatch(/401|unauthorized/u);
    expect(first.ready.page.composerEditable).toBe(true);
    expect(first.ready.page.workspaceActive).toBe(true);
    expect(first.ready.page.dropStatus).toContain('图纸已打开：initial-shaft.dxf');
    const settings = await readFile(join(userData, 'dsh-home', 'settings.yaml'), 'utf8');
    expect(settings).toContain('name: 维构 AI');
    expect(settings).toContain('model: doubao-seed-2.0-lite');
    expect(settings).toContain('provider: deepseek-official');
    expect(settings).toContain('https://ark.cn-beijing.volces.com/api/plan/v3');
    await stop(first);
    instances.splice(instances.indexOf(first), 1);
    expect(isAlive(first.ready.dshPid)).toBe(false);
    await expect(access(join(userData, 'owned-process.json'))).rejects.toMatchObject({ code: 'ENOENT' });

    const sessionPath = join(userData, 'dsh-home', 'sessions', 'smoke.jsonl');
    await mkdir(resolve(sessionPath, '..'), { recursive: true });
    await writeFile(sessionPath, '{"preserved":true}\n');
    const second = await launch(userData, 'second');
    instances.push(second);
    expect(await readFile(sessionPath, 'utf8')).toBe('{"preserved":true}\n');
    await stop(second);
    instances.splice(instances.indexOf(second), 1);
    expect(isAlive(second.ready.dshPid)).toBe(false);
  }, 180_000);
});

async function launch(userData: string, name: string) {
  const readyFile = join(userData, `${name}-ready.json`);
  const failureFile = join(userData, `${name}-failure.json`);
  const controlFile = join(userData, `${name}-control`);
  const child = spawn(executable, [], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      HOME: join(userData, 'isolated-home'),
      PATH: process.platform === 'win32' ? 'C:\\Windows\\System32' : '/usr/bin:/bin',
      DSH_HOME: '',
      VECTORAI_DESKTOP_USER_DATA_DIR: userData,
      VECTORAI_DESKTOP_SMOKE_HEADLESS: '1',
      VECTORAI_DESKTOP_SMOKE_READY_FILE: readyFile,
      VECTORAI_DESKTOP_SMOKE_FAILURE_FILE: failureFile,
      VECTORAI_DESKTOP_SMOKE_CONTROL_FILE: controlFile,
      VECTORAI_DESKTOP_SMOKE_DXF_PATH: join(repositoryRoot, 'packages', 'dxf-import', 'test', 'fixtures', 'initial-shaft.dxf'),
    },
  });
  const output: Buffer[] = [];
  child.stdout?.on('data', (chunk) => output.push(chunk));
  child.stderr?.on('data', (chunk) => output.push(chunk));
  const ready = await waitForReady(child, readyFile, failureFile, controlFile, output);
  return { child, controlFile, ready };
}

async function waitForReady(child: ChildProcess, path: string, failurePath: string, controlFile: string, output: Buffer[]) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`PACKAGED_APP_EXITED:${child.exitCode}:${Buffer.concat(output).toString('utf8')}`);
    try {
      return JSON.parse(await readFile(path, 'utf8')) as {
        url: string;
        dshPid: number;
        page: {
          url: string;
          title: string;
          text: string;
          composerEditable: boolean;
          workspaceActive: boolean;
          dropStatus: string;
        };
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    try {
      const failure = await readFile(failurePath, 'utf8');
      await writeFile(controlFile, 'quit\n');
      await waitForExit(child);
      throw new Error(`PACKAGED_APP_STARTUP_FAILED:${failure}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await delay(100);
  }
  child.kill();
  await waitForExit(child);
  throw new Error(`PACKAGED_APP_READY_TIMEOUT:${Buffer.concat(output).toString('utf8')}`);
}

async function waitForExit(child: ChildProcess) {
  if (child.exitCode !== null) return;
  await Promise.race([
    new Promise<void>((resolveExit) => child.once('exit', () => resolveExit())),
    delay(10_000),
  ]);
}

async function stop(instance: { child: ChildProcess; controlFile: string }) {
  if (instance.child.exitCode !== null || instance.child.signalCode !== null) return;
  await writeFile(instance.controlFile, 'quit\n');
  await Promise.race([
    new Promise<void>((resolve, reject) => instance.child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`PACKAGED_APP_EXIT:${code}`)))),
    delay(20_000).then(() => { throw new Error('PACKAGED_APP_QUIT_TIMEOUT'); }),
  ]);
}

function isAlive(pid: number) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function delay(milliseconds: number) {
  return new Promise<void>((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}
