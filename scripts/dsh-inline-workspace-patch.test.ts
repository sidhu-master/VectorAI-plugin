import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  applyConversationWorkspacePatch,
  patchConversationClient,
  resolveConversationPackageFromDshBin,
} from './dsh-inline-workspace-patch.mjs';

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

describe('patchConversationClient', () => {
  it('adds one generic workspace slot and split conversation shell', () => {
    const result = patchConversationClient(rc8Fixture());

    expect(result.status).toBe('patched');
    expect(result.source).toContain('"conversation.workspace"');
    expect(result.source).toContain('data-conversation-workspace-layout');
    expect(result.source).toContain('data-conversation-workspace-pane');
    expect(result.source).toContain('data-conversation-workspace-resizer');
    expect(result.source).toContain('data-conversation-chat-pane');
    expect(result.source).toContain('Math.min(640, Math.max(360');
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

describe('DSH workspace patch filesystem boundary', () => {
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
  const dshScript = join(nodeModules, '@deepseek-ai', 'dsh', 'lib', 'bin.js');
  const dshBin = join(nodeModules, '.bin', 'dsh');
  await mkdir(dirname(clientPath), { recursive: true });
  await mkdir(dirname(dshScript), { recursive: true });
  await mkdir(dirname(dshBin), { recursive: true });
  await writeFile(
    join(conversationDirectory, 'package.json'),
    JSON.stringify({ name: '@deepseek-ai/dsh-client-ui-conversation', version }),
  );
  await writeFile(clientPath, rc8Fixture());
  await writeFile(dshScript, '#!/usr/bin/env node\n');
  await symlink('../@deepseek-ai/dsh/lib/bin.js', dshBin);
  return { root, conversationDirectory, clientPath, dshBin };
}
