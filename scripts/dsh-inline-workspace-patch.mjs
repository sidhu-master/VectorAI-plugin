// SPDX-License-Identifier: Apache-2.0

import { constants as fsConstants } from 'node:fs';
import {
  copyFile,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SUPPORTED_VERSION = '0.1.0-rc.8';
const PATCH_MARKER = 'data-vectorai-dsh-workspace-patch';

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

const WORKSPACE_CSS = `
[data-conversation-workspace-layout] {
  min-width: 0;
  height: 100%;
}
[data-conversation-workspace-pane] {
  display: none;
}
[data-conversation-workspace-resizer] {
  display: none;
}
[data-conversation-chat-pane] {
  display: contents;
}
[data-conversation-workspace-layout]:has(> [data-conversation-workspace-pane]:not(:empty)) {
  flex-direction: row;
  overflow: hidden;
}
[data-conversation-workspace-layout]:has(> [data-conversation-workspace-pane]:not(:empty)) > [data-conversation-workspace-pane] {
  display: flex;
  flex: 1 1 auto;
  min-width: 520px;
  min-height: 0;
  overflow: hidden;
}
[data-conversation-workspace-layout]:has(> [data-conversation-workspace-pane]:not(:empty)) > [data-conversation-workspace-resizer] {
  display: block;
  width: 7px;
  flex: 0 0 7px;
  cursor: col-resize;
  touch-action: none;
  background: var(--dsw-alias-border-l2);
  border-left: 3px solid var(--dsw-alias-bg-base);
  border-right: 3px solid var(--dsw-alias-bg-base);
  box-sizing: border-box;
  z-index: 12;
}
[data-conversation-workspace-layout]:has(> [data-conversation-workspace-pane]:not(:empty)) > [data-conversation-workspace-resizer]:hover,
[data-conversation-workspace-layout]:has(> [data-conversation-workspace-pane]:not(:empty)) > [data-conversation-workspace-resizer]:focus-visible {
  background: var(--dsw-alias-state-business-primary);
  outline: none;
}
[data-conversation-workspace-layout]:has(> [data-conversation-workspace-pane]:not(:empty)) > [data-conversation-chat-pane] {
  display: flex;
  flex: 0 0 var(--dsh-conversation-chat-width, 440px);
  width: var(--dsh-conversation-chat-width, 440px);
  min-width: 360px;
  max-width: 640px;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}
@media (max-width: 1100px) {
  [data-conversation-workspace-layout]:has(> [data-conversation-workspace-pane]:not(:empty)) {
    flex-direction: column;
    overflow: hidden;
  }
  [data-conversation-workspace-layout]:has(> [data-conversation-workspace-pane]:not(:empty)) > [data-conversation-workspace-pane] {
    min-width: 0;
    min-height: 320px;
    flex: 1 1 55%;
  }
  [data-conversation-workspace-layout]:has(> [data-conversation-workspace-pane]:not(:empty)) > [data-conversation-workspace-resizer] {
    display: none;
  }
  [data-conversation-workspace-layout]:has(> [data-conversation-workspace-pane]:not(:empty)) > [data-conversation-chat-pane] {
    width: 100%;
    min-width: 0;
    max-width: none;
    min-height: 360px;
    flex: 1 1 45%;
    border-top: 1px solid var(--dsw-alias-border-l2);
  }
}`;

const ROOT_STATE_REPLACEMENT = `${ROOT_STATE_ANCHOR}
\t\t\tconst [workspaceChatWidth, setWorkspaceChatWidth] = (0, react.useState)(440);
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
\t\t\tconst resizeWorkspaceChatByKey = (0, react.useCallback)((event) => {
\t\t\t\tif (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
\t\t\t\tevent.preventDefault();
\t\t\t\tconst delta = event.key === "ArrowLeft" ? 20 : -20;
\t\t\t\tsetWorkspaceChatWidth((width) => Math.min(640, Math.max(360, width + delta)));
\t\t\t}, []);
\t\t\tconst workspaceLayoutStyles = ${JSON.stringify(WORKSPACE_CSS)};`;

const ROOT_RETURN_REPLACEMENT = `
\t\t\tconst workspacePane = phase === "active" ? renderSlot("conversation.workspace", {}) : null;
\t\t\treturn (0, react_jsx_runtime.jsxs)("div", {
\t\t\t\tclassName: ConversationRoot_module_css_default.root,
\t\t\t\tstyle: { "--dsh-conversation-chat-width": String(workspaceChatWidth) + "px" },
\t\t\t\t"data-phase": phase,
\t\t\t\t"data-conversation-workspace-layout": "",
\t\t\t\t"${PATCH_MARKER}": "rc.8",
\t\t\t\tchildren: [(0, react_jsx_runtime.jsx)("style", { children: workspaceLayoutStyles }), (0, react_jsx_runtime.jsx)("div", {
\t\t\t\t\t"data-conversation-workspace-pane": "",
\t\t\t\t\tchildren: workspacePane
\t\t\t\t}), (0, react_jsx_runtime.jsx)("div", {
\t\t\t\t\t"data-conversation-workspace-resizer": "",
\t\t\t\t\trole: "separator",
\t\t\t\t\ttabIndex: 0,
\t\t\t\t\t"aria-label": "Resize conversation",
\t\t\t\t\t"aria-orientation": "vertical",
\t\t\t\t\t"aria-valuemin": 360,
\t\t\t\t\t"aria-valuemax": 640,
\t\t\t\t\t"aria-valuenow": workspaceChatWidth,
\t\t\t\t\tonPointerDown: resizeWorkspaceChat,
\t\t\t\t\tonKeyDown: resizeWorkspaceChatByKey
\t\t\t\t}), (0, react_jsx_runtime.jsxs)("div", {
\t\t\t\t\t"data-conversation-chat-pane": "",
\t\t\t\t\tchildren: [renderSlot("conversation.session.header", {}), (0, react_jsx_runtime.jsxs)("div", {
\t\t\t\t\t\tclassName: ConversationRoot_module_css_default.scrollBody,
\t\t\t\t\t\t"data-conversation-scroll": "",
\t\t\t\t\t\tchildren: [renderSlot("conversation.session", {}), composerSeat]
\t\t\t\t\t})]
\t\t\t\t})]
\t\t\t});`;

const ROOT_CHILD_REPLACEMENT = `
\t\t\t\tchildren: {
\t\t\t\t\t"conversation.session": {
\t\t\t\t\t\tkind: "single",
\t\t\t\t\t\tscope: "session"
\t\t\t\t\t},
\t\t\t\t\t"conversation.workspace": {
\t\t\t\t\t\tkind: "single",
\t\t\t\t\t\tscope: "session"
\t\t\t\t\t},
\t\t\t\t\t"conversation.session.header": {`;

export function patchConversationClient(source) {
  if (source.includes(PATCH_MARKER)) return { status: 'already-patched', source };
  let patched = replaceExactlyOnce(source, ROOT_STATE_ANCHOR, ROOT_STATE_REPLACEMENT);
  patched = replaceExactlyOnce(patched, ROOT_RETURN_ANCHOR, ROOT_RETURN_REPLACEMENT);
  patched = replaceExactlyOnce(patched, ROOT_CHILD_ANCHOR, ROOT_CHILD_REPLACEMENT);
  return { status: 'patched', source: patched };
}

export function resolveConversationPackageFromDshBin(dshBin) {
  let cursor = dirname(realpathSync(resolve(dshBin)));
  while (true) {
    const candidate = join(cursor, '@deepseek-ai', 'dsh-client-ui-conversation');
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  throw new Error('DSH_WORKSPACE_CONVERSATION_PACKAGE_NOT_FOUND');
}

export async function applyConversationWorkspacePatch(conversationDirectory) {
  const manifestPath = join(conversationDirectory, 'package.json');
  const clientPath = join(conversationDirectory, 'lib', 'client.js');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.version !== SUPPORTED_VERSION) {
    throw new Error(
      `DSH_WORKSPACE_UNSUPPORTED_VERSION:${String(manifest.version)} (expected ${SUPPORTED_VERSION})`,
    );
  }

  const source = await readFile(clientPath, 'utf8');
  const result = patchConversationClient(source);
  if (result.status === 'already-patched') {
    return { status: result.status, clientPath };
  }

  const backupPath = `${clientPath}.vectorai-workspace.bak`;
  try {
    await copyFile(clientPath, backupPath, fsConstants.COPYFILE_EXCL);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
  }

  const temporaryPath = `${clientPath}.${process.pid}.${randomUUID()}.tmp`;
  const current = await stat(clientPath);
  try {
    await writeFile(temporaryPath, result.source, { mode: current.mode });
    await rename(temporaryPath, clientPath);
  } finally {
    await unlink(temporaryPath).catch((error) => {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    });
  }
  return { status: result.status, clientPath, backupPath };
}

function replaceExactlyOnce(source, anchor, replacement) {
  const first = source.indexOf(anchor);
  if (first < 0 || source.indexOf(anchor, first + anchor.length) >= 0) {
    throw new Error('DSH_WORKSPACE_PATCH_ANCHOR_MISMATCH');
  }
  return `${source.slice(0, first)}${replacement}${source.slice(first + anchor.length)}`;
}

async function main() {
  const flagIndex = process.argv.indexOf('--dsh-bin');
  const dshBin = flagIndex >= 0 ? process.argv[flagIndex + 1] : process.env.DSH_BIN;
  if (typeof dshBin !== 'string' || dshBin.length === 0) {
    throw new Error('DSH_WORKSPACE_DSH_BIN_REQUIRED: pass --dsh-bin /absolute/path/to/dsh');
  }
  const conversationDirectory = resolveConversationPackageFromDshBin(dshBin);
  const result = await applyConversationWorkspacePatch(conversationDirectory);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const entry = process.argv[1] === undefined ? '' : resolve(process.argv[1]);
if (entry === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
