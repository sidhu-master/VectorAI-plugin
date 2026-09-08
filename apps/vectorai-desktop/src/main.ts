import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { app, BrowserWindow, shell } from 'electron';

import { renderStartupError } from './error-page.js';
import { isAllowedInAppNavigation, isExternalHttpUrl } from './navigation.js';
import { DSHProcessManager } from './process-manager.js';
import { parseDesktopRuntimeManifest } from './runtime-contract.js';
import { initializeUserHome } from './user-home.js';

let window: BrowserWindow | undefined;
let manager: DSHProcessManager | undefined;
let shutdownComplete = false;
let shutdownStarted = false;

app.setName('VectorAI');
if (process.env.VECTORAI_DESKTOP_USER_DATA_DIR) {
  app.setPath('userData', resolve(process.env.VECTORAI_DESKTOP_USER_DATA_DIR));
}

app.on('before-quit', (event) => {
  if (shutdownComplete || shutdownStarted) return;
  event.preventDefault();
  shutdownStarted = true;
  const stopping = manager?.stop() ?? Promise.resolve();
  void stopping.finally(() => {
    shutdownComplete = true;
    app.quit();
  });
});

void app.whenReady().then(launch);

async function launch(): Promise<void> {
  window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#111820',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const smokeHeadless = process.env.VECTORAI_DESKTOP_SMOKE_HEADLESS === '1';
  if (!smokeHeadless) {
    window.maximize();
    window.once('ready-to-show', () => window?.show());
  }
  window.on('closed', () => {
    window = undefined;
    if (!shutdownStarted) app.quit();
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  await window.loadFile(resolve(import.meta.dirname, 'loading.html'));
  installSmokeControl();

  const userData = app.getPath('userData');
  const logPath = join(userData, 'logs', 'dsh.log');
  try {
    const runtimeRoot = process.env.VECTORAI_DESKTOP_RUNTIME_DIR
      ? resolve(process.env.VECTORAI_DESKTOP_RUNTIME_DIR)
      : join(process.resourcesPath, 'runtime');
    const manifest = parseDesktopRuntimeManifest(JSON.parse(
      await readFile(join(runtimeRoot, 'runtime-manifest.json'), 'utf8'),
    ));
    const credential = (await readFile(
      join(runtimeRoot, 'secrets', 'vectorai-test-api-key'),
      'utf8',
    )).trim();
    if (!credential) throw new Error('VECTORAI_TEST_API_KEY_REQUIRED');
    const home = await initializeUserHome({
      userData,
      profileSeedPath: join(runtimeRoot, 'profile-seed', 'profiles'),
      templatePath: join(runtimeRoot, 'default-settings.yaml'),
      runtimeVersion: `${manifest.vectoraiVersion}:${manifest.dsh.version}`,
    });
    const nodeExecutable = manifest.platform === 'win32'
      ? join(runtimeRoot, 'node', 'node.exe')
      : join(runtimeRoot, 'node', 'bin', 'node');
    manager = new DSHProcessManager({
      nodeExecutable,
      dshEntry: join(runtimeRoot, ...manifest.entry.split('/')),
      dshHome: home.dshHome,
      workspace: home.workspace,
      logPath,
      credential,
      statePath: join(userData, 'owned-process.json'),
    });
    const readyUrl = await manager.start();
    configureNavigation(window, readyUrl);
    await window.loadURL(readyUrl.href);
    if (await ensureDesktopWorkspace(window, home.workspace)) {
      await window.loadURL(new URL('/', readyUrl).href);
    }
    await signalSmokeReady(readyUrl, manager.processIdentifier, window);
  } catch (error) {
    await manager?.stop();
    await signalSmokeFailure(error, logPath);
    if (window && !window.isDestroyed()) {
      await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(renderStartupError(error, logPath))}`);
    }
  }
}

async function signalSmokeReady(readyUrl: URL, dshPid: number, target: BrowserWindow): Promise<void> {
  const readyFile = process.env.VECTORAI_DESKTOP_SMOKE_READY_FILE;
  if (readyFile) {
    await exerciseSmokeDxfDrop(target);
    const page = await target.webContents.executeJavaScript(`({
      url: location.href,
      title: document.title,
      text: document.body?.innerText?.slice(0, 500) ?? '',
      composerEditable: document.querySelector('[data-composer-input]')?.getAttribute('contenteditable') === 'true',
      workspaceActive: document.querySelector('[data-vectorai-workspace-overlay]') !== null,
      dropStatus: document.querySelector('.vai-engineering-drop')?.textContent ?? '',
    })`) as { url: string; title: string; text: string };
    await mkdir(dirname(readyFile), { recursive: true });
    await writeFile(readyFile, `${JSON.stringify({ url: readyUrl.href, dshPid, page })}\n`, 'utf8');
  }
}

async function ensureDesktopWorkspace(target: BrowserWindow, workspacePath: string): Promise<boolean> {
  const workspace = await callPageRemote(target, 'workspace/create', { path: workspacePath }) as {
    workspace?: { workspaceId?: unknown; sessionIds?: unknown };
  };
  const workspaceId = workspace.workspace?.workspaceId;
  const sessionIds = workspace.workspace?.sessionIds;
  if (typeof workspaceId !== 'string' || !Array.isArray(sessionIds)) {
    throw new Error('VECTORAI_DESKTOP_WORKSPACE_RESPONSE_INVALID');
  }
  if (sessionIds.length > 0) return false;
  const session = await callPageRemote(target, 'session/create', { workspaceId }) as { sessionId?: unknown };
  if (typeof session.sessionId !== 'string') throw new Error('VECTORAI_DESKTOP_SESSION_RESPONSE_INVALID');
  return true;
}

async function callPageRemote(target: BrowserWindow, endpoint: string, request: object): Promise<unknown> {
  const rpcId = `vectorai-desktop-${randomUUID()}`;
  const path = `/api/${endpoint}`;
  const body = JSON.stringify({
    type: 'client-request',
    rpcId,
    method: endpoint,
    payload: { args: { request } },
  });
  const result = await target.webContents.executeJavaScript(`(async () => {
    const response = await fetch(${JSON.stringify(path)}, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: ${JSON.stringify(body)},
    });
    return { status: response.status, envelope: await response.json() };
  })()` ) as {
    status?: unknown;
    envelope?: { rpcId?: unknown; result?: { ok?: unknown; value?: unknown; error?: { code?: unknown; message?: unknown } } };
  };
  if (result.status !== 200 || result.envelope?.rpcId !== rpcId) {
    throw new Error(`VECTORAI_DESKTOP_RPC_TRANSPORT_FAILED:${endpoint}`);
  }
  if (result.envelope.result?.ok !== true) {
    const error = result.envelope.result?.error;
    throw new Error(`VECTORAI_DESKTOP_RPC_FAILED:${endpoint}:${String(error?.code)}:${String(error?.message)}`);
  }
  return result.envelope.result.value;
}

async function exerciseSmokeDxfDrop(target: BrowserWindow): Promise<void> {
  const path = process.env.VECTORAI_DESKTOP_SMOKE_DXF_PATH;
  if (!path) return;
  const encoded = (await readFile(path)).toString('base64');
  const filename = basename(path);
  const status = await target.webContents.executeJavaScript(`(async () => {
    const mountDeadline = Date.now() + 15000;
    while (Date.now() < mountDeadline) {
      const composerReady = document.querySelector('[data-composer-input]')?.getAttribute('contenteditable') === 'true';
      const workspaceReady = document.querySelector('[data-vectorai-workspace-overlay]') !== null;
      if (composerReady && workspaceReady) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const bytes = Uint8Array.from(atob(${JSON.stringify(encoded)}), value => value.charCodeAt(0));
    const file = new File([bytes], ${JSON.stringify(filename)}, { type: 'application/dxf' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    for (const type of ['dragenter', 'dragover', 'drop']) {
      document.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }));
    }
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const text = document.querySelector('.vai-engineering-drop')?.textContent ?? '';
      if (text.includes('图纸已打开')) return text;
      if (text.includes('失败')) throw new Error(text);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('VECTORAI_DESKTOP_DXF_DROP_TIMEOUT');
  })()` ) as unknown;
  if (typeof status !== 'string' || !status.includes(filename)) {
    throw new Error('VECTORAI_DESKTOP_DXF_DROP_RESULT_INVALID');
  }
}

async function signalSmokeFailure(error: unknown, logPath: string): Promise<void> {
  const failureFile = process.env.VECTORAI_DESKTOP_SMOKE_FAILURE_FILE;
  if (!failureFile) return;
  await mkdir(dirname(failureFile), { recursive: true });
  await writeFile(failureFile, `${JSON.stringify({ error: error instanceof Error ? error.message : String(error), logPath })}\n`, 'utf8');
}

function installSmokeControl(): void {
  const controlFile = process.env.VECTORAI_DESKTOP_SMOKE_CONTROL_FILE;
  if (controlFile) {
    const timer = setInterval(async () => {
      try {
        if ((await readFile(controlFile, 'utf8')).trim() === 'quit') {
          clearInterval(timer);
          app.quit();
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') clearInterval(timer);
      }
    }, 100);
    timer.unref();
  }
}

function configureNavigation(target: BrowserWindow, readyUrl: URL): void {
  target.webContents.on('will-navigate', (event, rawUrl) => {
    if (rawUrl === 'vectorai://retry') {
      event.preventDefault();
      app.relaunch();
      app.quit();
      return;
    }
    const candidate = safelyParseUrl(rawUrl);
    if (candidate && isAllowedInAppNavigation(candidate, readyUrl)) return;
    event.preventDefault();
    if (candidate && isExternalHttpUrl(candidate)) void shell.openExternal(candidate.href);
  });
  target.webContents.setWindowOpenHandler(({ url }) => {
    const candidate = safelyParseUrl(url);
    if (candidate && isExternalHttpUrl(candidate) && !isAllowedInAppNavigation(candidate, readyUrl)) {
      void shell.openExternal(candidate.href);
    }
    return { action: 'deny' };
  });
}

function safelyParseUrl(rawUrl: string): URL | undefined {
  try { return new URL(rawUrl); } catch { return undefined; }
}

if (pathToFileURL(process.argv[1] ?? '').href === import.meta.url) {
  // Top-level startup above is the Electron entrypoint; this branch documents the executable boundary.
}
