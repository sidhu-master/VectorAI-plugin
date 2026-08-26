import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import * as dshPatch from './dsh-inline-workspace-patch.mjs';

const {
  applyConversationWorkspacePatch,
  patchConversationClient,
  resolveConversationPackageFromDshBin,
} = dshPatch;

function workspaceRuntimeFixture(): string {
  return `class WorkspaceRuntime {
  constructor(list, sessions) {
    this.list = list;
    this.sessions = sessions;
  }
  connectWorkspace(workspaceId) {
    return Promise.resolve(\`reused-\${workspaceId}\`);
  }
  startSession(workspaceId) {
    const workspace = this.list.getSnapshot();
    const current = this.sessions.list.getSnapshot().current;
    const currentWorkspaceId = current === void 0 ? void 0 : workspace.items.find((item) => item.sessionIds.includes(current))?.workspaceId;
    const target = workspaceId ?? currentWorkspaceId ?? workspace.recentWorkspaceId;
    if (target === void 0) {
      this.sessions.clear();
      return;
    }
    this.connectWorkspace(target).then((sessionId) => {
      this.sessions.open(sessionId);
    }, (reason) => {
      console.warn("new session failed:", reason);
    });
  }
}
export { WorkspaceRuntime };`;
}

const ROOT_STATE_ANCHOR = `
\t\t\tconst [pendingWorkspaceId, setPendingWorkspaceId] = (0, react.useState)();
\t\t\tconst pickerAnchor = (0, react.useRef)(null);`;

const ROOT_RETURN_ANCHOR = `
\t\t\treturn (0, react_jsx_runtime.jsxs)("div", {
\t\t\t\tclassName: ConversationRoot_module_css_default.root,
\t\t\t\t"data-phase": phase,
\t\t\t\tchildren: [renderSlot("conversation.session.header", {}), (0, react_jsx_runtime.jsxs)("div", {
\t\t\t\t\tclassName: ConversationRoot_module_css_default.scrollBody,
\t\t\t\t\t"data-conversation-scroll": "",
\t\t\t\t\tchildren: [renderSlot("conversation.session", {}), composerSeat]
\t\t\t\t})]
\t\t\t});`;

const ROOT_CHILD_ANCHOR = `
\t\t\t\tchildren: {
\t\t\t\t\t"conversation.session": {
\t\t\t\t\t\tkind: "single",
\t\t\t\t\t\tscope: "session"
\t\t\t\t\t},
\t\t\t\t\t"conversation.session.header": {`;

function rc8Fixture(): string {
  return [ROOT_STATE_ANCHOR, ROOT_RETURN_ANCHOR, ROOT_CHILD_ANCHOR].join('\n');
}

function legacyPatchedResizeFixture(): string {
  return `
\t\t\tconst resizeWorkspaceChat = (0, react.useCallback)((event) => {
\t\t\t\tconst handle = event.currentTarget;
\t\t\t\tconst pointerId = event.pointerId;
\t\t\t\tconst startX = event.clientX;
\t\t\t\tconst startWidth = workspaceChatWidth;
\t\t\t\tconst move = (next) => {
\t\t\t\t\tsetWorkspaceChatWidth(Math.min(640, Math.max(360, startWidth - (next.clientX - startX))));
\t\t\t\t};
\t\t\t\tconst finish = () => {
\t\t\t\t\thandle.removeEventListener("pointermove", move);
\t\t\t\t\thandle.removeEventListener("pointerup", finish);
\t\t\t\t\thandle.removeEventListener("pointercancel", finish);
\t\t\t\t\tif (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
\t\t\t\t};
\t\t\t\thandle.setPointerCapture(pointerId);
\t\t\t\thandle.addEventListener("pointermove", move);
\t\t\t\thandle.addEventListener("pointerup", finish, { once: true });
\t\t\t\thandle.addEventListener("pointercancel", finish, { once: true });
\t\t\t}, [workspaceChatWidth]);
\t\t\tconst workspaceLayoutStyles = "[data-conversation-workspace-pane]:not(:empty)";
\t\t\t\t\t"data-conversation-workspace-pane": "",
\t\t\t\t\tchildren: workspacePane
\t\t\t"data-vectorai-dsh-workspace-patch": "rc.8"`;
}

function agentLoopFixture(): string {
  return `function parseArguments(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return raw;
  }
}
export { parseArguments };`;
}

describe('patchAgentLoopToolArgumentsParser', () => {
  it('repairs only missing structural closers before typed tool validation', async () => {
    const patchAgentLoopToolArgumentsParser = (
      dshPatch as unknown as {
        patchAgentLoopToolArgumentsParser(source: string): { status: string; source: string };
      }
    ).patchAgentLoopToolArgumentsParser;

    const result = patchAgentLoopToolArgumentsParser(agentLoopFixture());
    const moduleUrl = `data:text/javascript;base64,${Buffer.from(result.source).toString('base64')}`;
    const loop = await import(moduleUrl) as { parseArguments(raw: string): unknown };

    expect(loop.parseArguments('{"parts":[{"partKey":"right_hand","references":[]}}'))
      .toEqual({ parts: [{ partKey: 'right_hand', references: [] }] });
    expect(loop.parseArguments('{"parts":[]}')).toEqual({ parts: [] });
    expect(loop.parseArguments('{"parts":')).toBe('{"parts":');
  });
});

describe('patchConversationClient', () => {
  it('adds one generic workspace slot and split conversation shell', () => {
    const result = patchConversationClient(rc8Fixture());

    expect(result.status).toBe('patched');
    expect(result.source).toContain('"conversation.workspace"');
    expect(result.source).toContain(
      'const workspacePane = sessionId === void 0 ? null : renderSlot("conversation.workspace", {});',
    );
    expect(result.source).not.toContain('phase === "active" ? renderSlot("conversation.workspace", {}) : null');
    expect(result.source).toContain('data-conversation-workspace-layout');
    expect(result.source).toContain('data-conversation-workspace-pane');
    expect(result.source).toContain('key: sessionId ?? "new-session"');
    expect(result.source).toContain('data-conversation-workspace-resizer');
    expect(result.source).toContain('data-conversation-chat-pane');
    expect(result.source).toContain('[data-conversation-workspace-active]');
    expect(result.source).not.toContain('[data-conversation-workspace-pane]:not(:empty)');
    expect(result.source).toContain('Math.min(640, Math.max(360');
    expect(result.source).toContain('(next.buttons & 1) === 0');
    expect(result.source).toContain('lostpointercapture');
    expect(result.source).toContain('window.addEventListener("blur", finish');
  });

  it('upgrades the installed v2 layout selector instead of treating it as current', () => {
    const current = patchConversationClient(rc8Fixture()).source;
    const v2 = current
      .replace('"data-vectorai-dsh-workspace-patch": "rc.8-v5"', '"data-vectorai-dsh-workspace-patch": "rc.8-v2"')
      .replace(
        'const workspacePane = sessionId === void 0 ? null : renderSlot("conversation.workspace", {});',
        'const workspacePane = phase === "active" ? renderSlot("conversation.workspace", {}) : null;',
      )
      .replaceAll(
        '[data-conversation-workspace-pane] [data-conversation-workspace-active]',
        '[data-conversation-workspace-pane]:not(:empty)',
      );

    const result = patchConversationClient(v2);

    expect(result.status).toBe('upgraded');
    expect(result.source).toContain('"data-vectorai-dsh-workspace-patch": "rc.8-v5"');
    expect(result.source).toContain('[data-conversation-workspace-active]');
    expect(result.source).not.toContain('[data-conversation-workspace-pane]:not(:empty)');
  });

  it('upgrades the installed v3 phase gate so a new session can reveal an imported drawing', () => {
    const current = patchConversationClient(rc8Fixture()).source;
    const v3 = current
      .replace('"data-vectorai-dsh-workspace-patch": "rc.8-v5"', '"data-vectorai-dsh-workspace-patch": "rc.8-v3"')
      .replace(
        'const workspacePane = sessionId === void 0 ? null : renderSlot("conversation.workspace", {});',
        'const workspacePane = phase === "active" ? renderSlot("conversation.workspace", {}) : null;',
      );

    const result = patchConversationClient(v3);

    expect(result.status).toBe('upgraded');
    expect(result.source).toContain('"data-vectorai-dsh-workspace-patch": "rc.8-v5"');
    expect(result.source).toContain(
      'const workspacePane = sessionId === void 0 ? null : renderSlot("conversation.workspace", {});',
    );
  });

  it('upgrades the installed v4 unconditional gate to hide stale drawings in a new session', () => {
    const current = patchConversationClient(rc8Fixture()).source;
    const v4 = current
      .replace('"data-vectorai-dsh-workspace-patch": "rc.8-v5"', '"data-vectorai-dsh-workspace-patch": "rc.8-v4"')
      .replace(
        'const workspacePane = sessionId === void 0 ? null : renderSlot("conversation.workspace", {});',
        'const workspacePane = renderSlot("conversation.workspace", {});',
      );

    const result = patchConversationClient(v4);

    expect(result.status).toBe('upgraded');
    expect(result.source).toContain('"data-vectorai-dsh-workspace-patch": "rc.8-v5"');
    expect(result.source).toContain(
      'const workspacePane = sessionId === void 0 ? null : renderSlot("conversation.workspace", {});',
    );
  });

  it('upgrades the installed rc.8 resize handler', () => {
    const result = patchConversationClient(legacyPatchedResizeFixture());

    expect(result.status).toBe('upgraded');
    expect(result.source).toContain('(next.buttons & 1) === 0');
    expect(result.source).toContain('lostpointercapture');
    expect(result.source).toContain('"data-vectorai-dsh-workspace-patch": "rc.8-v5"');
    expect(result.source).toContain('[data-conversation-workspace-active]');
  });

  it('refuses an unknown marked patch instead of silently accepting it', () => {
    expect(() => patchConversationClient('data-vectorai-dsh-workspace-patch')).toThrow(
      'DSH_WORKSPACE_PATCH_UPGRADE_MISMATCH',
    );
  });

  it('is idempotent after the workspace marker exists', () => {
    const patched = patchConversationClient(rc8Fixture());

    expect(patchConversationClient(patched.source)).toEqual({
      status: 'already-patched',
      source: patched.source,
    });
  });

  it('refuses an unknown or partially matching DSH client', () => {
    expect(() => patchConversationClient('unknown')).toThrow(
      'DSH_WORKSPACE_PATCH_ANCHOR_MISMATCH',
    );
    expect(() => patchConversationClient(ROOT_STATE_ANCHOR)).toThrow(
      'DSH_WORKSPACE_PATCH_ANCHOR_MISMATCH',
    );
  });

  it('refuses ambiguous anchors instead of patching the wrong bundle', () => {
    expect(() => patchConversationClient(`${rc8Fixture()}\n${ROOT_RETURN_ANCHOR}`)).toThrow(
      'DSH_WORKSPACE_PATCH_ANCHOR_MISMATCH',
    );
  });
});

describe('patchWorkspaceRuntimeNewSession', () => {
  it('creates a fresh session when a blank session is occupied by a plugin workspace', async () => {
    const patchWorkspaceRuntimeNewSession = (
      dshPatch as unknown as {
        patchWorkspaceRuntimeNewSession(source: string): { status: string; source: string };
      }
    ).patchWorkspaceRuntimeNewSession;
    const result = patchWorkspaceRuntimeNewSession(workspaceRuntimeFixture());
    const moduleUrl = `data:text/javascript;base64,${Buffer.from(result.source).toString('base64')}`;
    const { WorkspaceRuntime } = await import(moduleUrl) as {
      WorkspaceRuntime: new (list: unknown, sessions: unknown) => { startSession(): void };
    };
    const opened: string[] = [];
    const created: string[] = [];
    const sessions = {
      list: { getSnapshot: () => ({ current: 'occupied', byId: { occupied: { blank: false } } }) },
      create: async ({ workspaceId }: { workspaceId: string }) => {
        created.push(workspaceId);
        return 'fresh';
      },
      open: (sessionId: string) => { opened.push(sessionId); },
      clear: () => undefined,
    };
    const list = { getSnapshot: () => ({
      items: [{ workspaceId: 'workspace', sessionIds: ['occupied'] }],
      recentWorkspaceId: 'workspace',
    }) };
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { querySelector: () => ({}) },
    });
    try {
      new WorkspaceRuntime(list, sessions).startSession();
      await Promise.resolve();
      await Promise.resolve();
    } finally {
      Object.defineProperty(globalThis, 'document', { configurable: true, value: previousDocument });
    }

    expect(result.status).toBe('patched');
    expect(created).toEqual(['workspace']);
    expect(opened).toEqual(['fresh']);
  });

  it('creates a fresh session for an explicit new-session action even without an active plugin', async () => {
    const patchWorkspaceRuntimeNewSession = (
      dshPatch as unknown as {
        patchWorkspaceRuntimeNewSession(source: string): { source: string };
      }
    ).patchWorkspaceRuntimeNewSession;
    const result = patchWorkspaceRuntimeNewSession(workspaceRuntimeFixture());
    const moduleUrl = `data:text/javascript;base64,${Buffer.from(result.source).toString('base64')}`;
    const { WorkspaceRuntime } = await import(`${moduleUrl}#inactive`) as {
      WorkspaceRuntime: new (list: unknown, sessions: unknown) => { startSession(): void };
    };
    const opened: string[] = [];
    const created: string[] = [];
    const sessions = {
      list: { getSnapshot: () => ({ current: 'blank', byId: { blank: { blank: true } } }) },
      create: async ({ workspaceId }: { workspaceId: string }) => {
        created.push(workspaceId);
        return 'fresh';
      },
      open: (sessionId: string) => { opened.push(sessionId); },
      clear: () => undefined,
    };
    const list = { getSnapshot: () => ({
      items: [{ workspaceId: 'workspace', sessionIds: ['blank'] }],
      recentWorkspaceId: 'workspace',
    }) };
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { querySelector: () => null },
    });
    try {
      new WorkspaceRuntime(list, sessions).startSession();
      await Promise.resolve();
      await Promise.resolve();
    } finally {
      Object.defineProperty(globalThis, 'document', { configurable: true, value: previousDocument });
    }

    expect(created).toEqual(['workspace']);
    expect(opened).toEqual(['fresh']);
  });
});

describe('DSH workspace patch filesystem boundary', () => {
  it('patches both the conversation layout and the agent-loop argument parser', async () => {
    const fixture = await createInstallationFixture('0.1.0-rc.8');
    try {
      const applyDshCompatibilityPatches = (
        dshPatch as unknown as {
          applyDshCompatibilityPatches(dshBin: string): Promise<{
            conversation: { status: string };
            agentLoop: { status: string };
          }>;
        }
      ).applyDshCompatibilityPatches;

      await expect(applyDshCompatibilityPatches(fixture.dshBin)).resolves.toMatchObject({
        conversation: { status: 'patched' },
        agentLoop: { status: 'patched' },
      });

      const patchedLoopSource = await readFile(fixture.agentLoopPath, 'utf8');
      const patchedLoopUrl = `data:text/javascript;base64,${Buffer.from(patchedLoopSource).toString('base64')}`;
      const loop = await import(patchedLoopUrl) as { parseArguments(raw: string): unknown };
      expect(loop.parseArguments('{"parts":[{"partKey":"arm"}}'))
        .toEqual({ parts: [{ partKey: 'arm' }] });
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it('resolves the conversation package from the real dsh executable', async () => {
    const fixture = await createInstallationFixture('0.1.0-rc.8');
    try {
      expect(await realpath(resolveConversationPackageFromDshBin(fixture.dshBin))).toBe(
        await realpath(fixture.conversationDirectory),
      );
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it('backs up and atomically patches rc.8 only once', async () => {
    const fixture = await createInstallationFixture('0.1.0-rc.8');
    try {
      await expect(applyConversationWorkspacePatch(fixture.conversationDirectory))
        .resolves.toMatchObject({ status: 'patched' });
      await expect(applyConversationWorkspacePatch(fixture.conversationDirectory))
        .resolves.toMatchObject({ status: 'already-patched' });

      expect(await readFile(`${fixture.clientPath}.vectorai-workspace.bak`, 'utf8'))
        .toBe(rc8Fixture());
      expect(await readFile(fixture.clientPath, 'utf8'))
        .toContain('data-vectorai-dsh-workspace-patch');
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it('refuses a different DSH package version without creating a backup', async () => {
    const fixture = await createInstallationFixture('0.1.0-rc.9');
    try {
      await expect(applyConversationWorkspacePatch(fixture.conversationDirectory))
        .rejects.toThrow('DSH_WORKSPACE_UNSUPPORTED_VERSION');
      await expect(readFile(`${fixture.clientPath}.vectorai-workspace.bak`, 'utf8'))
        .rejects.toMatchObject({ code: 'ENOENT' });
      expect(await readFile(fixture.clientPath, 'utf8')).toBe(rc8Fixture());
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });
});

async function createInstallationFixture(version: string) {
  const root = await mkdtemp(join(tmpdir(), 'vectorai-dsh-workspace-'));
  const nodeModules = join(root, 'node_modules');
  const conversationDirectory = join(
    nodeModules,
    '@deepseek-ai',
    'dsh-client-ui-conversation',
  );
  const clientPath = join(conversationDirectory, 'lib', 'client.js');
  const agentLoopDirectory = join(nodeModules, '@deepseek-ai', 'dsh-agent-loop');
  const agentLoopPath = join(agentLoopDirectory, 'lib', 'index.js');
  const runtimeDirectory = join(nodeModules, '@deepseek-ai', 'dsh-client-runtime');
  const runtimePath = join(runtimeDirectory, 'lib', 'client.js');
  const dshScript = join(nodeModules, '@deepseek-ai', 'dsh', 'lib', 'bin.js');
  const dshBin = join(nodeModules, '.bin', 'dsh');
  await mkdir(dirname(clientPath), { recursive: true });
  await mkdir(dirname(dshScript), { recursive: true });
  await mkdir(dirname(agentLoopPath), { recursive: true });
  await mkdir(dirname(runtimePath), { recursive: true });
  await mkdir(dirname(dshBin), { recursive: true });
  await writeFile(
    join(conversationDirectory, 'package.json'),
    JSON.stringify({ name: '@deepseek-ai/dsh-client-ui-conversation', version }),
  );
  await writeFile(clientPath, rc8Fixture());
  await writeFile(
    join(agentLoopDirectory, 'package.json'),
    JSON.stringify({ name: '@deepseek-ai/dsh-agent-loop', version, type: 'module' }),
  );
  await writeFile(agentLoopPath, agentLoopFixture());
  await writeFile(
    join(runtimeDirectory, 'package.json'),
    JSON.stringify({ name: '@deepseek-ai/dsh-client-runtime', version }),
  );
  await writeFile(runtimePath, workspaceRuntimeFixture());
  await writeFile(dshScript, '#!/usr/bin/env node\n');
  await symlink('../@deepseek-ai/dsh/lib/bin.js', dshBin);
  return { root, conversationDirectory, clientPath, agentLoopPath, runtimePath, dshBin };
}
