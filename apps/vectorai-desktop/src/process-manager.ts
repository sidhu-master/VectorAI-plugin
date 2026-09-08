import { spawn, execFile, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createWriteStream, type WriteStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname } from 'node:path';
import { promisify } from 'node:util';

import { findReadyUrl } from './ready-url.js';

const execFileAsync = promisify(execFile);
const OUTPUT_LIMIT = 1024 * 1024;

export interface DSHProcessManagerOptions {
  nodeExecutable: string;
  dshEntry: string;
  dshHome: string;
  workspace: string;
  logPath: string;
  credential: string;
  statePath: string;
  startupTimeoutMs?: number;
  platform?: NodeJS.Platform;
}

interface OwnedProcessRecord {
  pid: number;
  executable: string;
  dshEntry: string;
  port: number;
  launchedAt: string;
}

export class DSHProcessManager {
  readonly #options: DSHProcessManagerOptions;
  #child: ChildProcessWithoutNullStreams | undefined;
  #log: WriteStream | undefined;
  #processIdentifier = 0;
  #stopping: Promise<void> | undefined;

  constructor(options: DSHProcessManagerOptions) {
    this.#options = options;
  }

  get processIdentifier(): number {
    return this.#processIdentifier;
  }

  async start(): Promise<URL> {
    if (this.#child) throw new Error('DSH_PROCESS_ALREADY_RUNNING');
    await this.#recoverStaleProcess();
    await Promise.all([
      mkdir(dirname(this.#options.logPath), { recursive: true }),
      mkdir(this.#options.dshHome, { recursive: true }),
      mkdir(this.#options.workspace, { recursive: true }),
    ]);
    const port = await allocateLoopbackPort();
    const platform = this.#options.platform ?? process.platform;
    const child = spawn(this.#options.nodeExecutable, [
      this.#options.dshEntry,
      'web',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--no-open',
    ], {
      cwd: this.#options.workspace,
      detached: platform !== 'win32',
      env: {
        ...process.env,
        DSH_HOME: this.#options.dshHome,
        DSH_TELEMETRY_DISABLED: '1',
        VECTORAI_TEST_API_KEY: this.#options.credential,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.#child = child;
    this.#processIdentifier = child.pid ?? 0;
    if (this.#processIdentifier <= 0) {
      this.#child = undefined;
      throw new Error('DSH_PROCESS_PID_MISSING');
    }

    const record: OwnedProcessRecord = {
      pid: this.#processIdentifier,
      executable: this.#options.nodeExecutable,
      dshEntry: this.#options.dshEntry,
      port,
      launchedAt: new Date().toISOString(),
    };
    await writeFile(this.#options.statePath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

    const log = createWriteStream(this.#options.logPath, { flags: 'a', mode: 0o600 });
    this.#log = log;
    let output = '';
    const ready = new Promise<URL>((resolve, reject) => {
      const consume = (chunk: Buffer) => {
        log.write(chunk);
        output = `${output}${chunk.toString('utf8')}`.slice(-OUTPUT_LIMIT);
        const url = findReadyUrl(output, port);
        if (url) resolve(url);
      };
      child.stdout.on('data', consume);
      child.stderr.on('data', consume);
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        this.#closeLog();
        reject(new Error(`DSH_PROCESS_EXITED:${String(code)}:${String(signal)}`));
      });
    });
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('DSH_STARTUP_TIMEOUT')), this.#options.startupTimeoutMs ?? 45_000)
        .unref();
    });
    try {
      return await Promise.race([ready, timeout]);
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.#stopping) return this.#stopping;
    this.#stopping = this.#stopInternal();
    try {
      await this.#stopping;
    } finally {
      this.#stopping = undefined;
    }
  }

  async #stopInternal(): Promise<void> {
    const child = this.#child;
    this.#child = undefined;
    if (child && child.pid && child.exitCode === null && child.signalCode === null) {
      await terminateProcessTree(child, this.#options.platform ?? process.platform);
    }
    this.#closeLog();
    await rm(this.#options.statePath, { force: true });
  }

  #closeLog(): void {
    const log = this.#log;
    this.#log = undefined;
    if (log && !log.destroyed) log.end();
  }

  async #recoverStaleProcess(): Promise<void> {
    let record: OwnedProcessRecord;
    try {
      record = JSON.parse(await readFile(this.#options.statePath, 'utf8')) as OwnedProcessRecord;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
      await rm(this.#options.statePath, { force: true });
      return;
    }
    if (await processMatchesRecord(record, this.#options.platform ?? process.platform)) {
      await terminateRecordedProcess(record.pid, this.#options.platform ?? process.platform);
    }
    await rm(this.#options.statePath, { force: true });
  }
}

export async function allocateLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('DSH_PORT_ALLOCATION_FAILED')));
        return;
      }
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

async function terminateProcessTree(child: ChildProcessWithoutNullStreams, platform: NodeJS.Platform): Promise<void> {
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  await terminateRecordedProcess(child.pid!, platform, false);
  await Promise.race([exited, delay(1_000)]);
  if (child.exitCode === null && child.signalCode === null) {
    if (platform === 'win32') await terminateRecordedProcess(child.pid!, platform, true);
    else {
      try { process.kill(-child.pid!, 'SIGKILL'); } catch { /* already gone */ }
    }
    await Promise.race([exited, delay(2_000)]);
  }
}

async function terminateRecordedProcess(pid: number, platform: NodeJS.Platform, force = false): Promise<void> {
  if (platform === 'win32') {
    const args = ['/PID', String(pid), '/T', ...(force ? ['/F'] : [])];
    try { await execFileAsync('taskkill', args); } catch { /* already gone */ }
    return;
  }
  try { process.kill(-pid, force ? 'SIGKILL' : 'SIGTERM'); } catch { /* already gone */ }
}

async function processMatchesRecord(record: OwnedProcessRecord, platform: NodeJS.Platform): Promise<boolean> {
  if (!Number.isSafeInteger(record.pid) || record.pid <= 1) return false;
  try {
    const command = platform === 'win32'
      ? (await execFileAsync('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-Command',
        `(Get-CimInstance Win32_Process -Filter "ProcessId = ${record.pid}").CommandLine`,
      ])).stdout
      : (await execFileAsync('/bin/ps', ['-p', String(record.pid), '-o', 'command='])).stdout;
    return command.includes(record.executable) && command.includes(record.dshEntry);
  } catch {
    return false;
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
