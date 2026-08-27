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
const LEGACY_PATCH_MARKER = `"${PATCH_MARKER}": "rc.8"`;
const V2_PATCH_MARKER = `"${PATCH_MARKER}": "rc.8-v2"`;
const V3_PATCH_MARKER = `"${PATCH_MARKER}": "rc.8-v3"`;
const V4_PATCH_MARKER = `"${PATCH_MARKER}": "rc.8-v4"`;
const V5_PATCH_MARKER = `"${PATCH_MARKER}": "rc.8-v5"`;
const CURRENT_PATCH_MARKER = `"${PATCH_MARKER}": "rc.8-v6"`;
const LEGACY_WORKSPACE_SELECTOR = '[data-conversation-workspace-pane]:not(:empty)';
const CURRENT_WORKSPACE_SELECTOR = '[data-conversation-workspace-pane] [data-conversation-workspace-active]';
const LEGACY_WORKSPACE_GATE = 'const workspacePane = phase === "active" ? renderSlot("conversation.workspace", {}) : null;';
const V4_WORKSPACE_GATE = 'const workspacePane = renderSlot("conversation.workspace", {});';
const CURRENT_WORKSPACE_GATE = 'const workspacePane = sessionId === void 0 ? null : renderSlot("conversation.workspace", {});';
const LEGACY_WORKSPACE_PANE = `\t\t\t\t\t"data-conversation-workspace-pane": "",
\t\t\t\t\tchildren: workspacePane`;
const CURRENT_WORKSPACE_PANE = `\t\t\t\t\t"data-conversation-workspace-pane": "",
\t\t\t\t\tkey: sessionId ?? "new-session",
\t\t\t\t\tchildren: workspacePane`;
const AGENT_LOOP_ARGUMENT_REPAIR_MARKER = 'function repairToolArgumentsJson(raw)';
const LEGACY_WORKSPACE_SESSION_BOUNDARY = `const occupiedBlankSession = current !== void 0
  && this.sessions.list.getSnapshot().byId[current]?.blank === true
  && typeof document !== "undefined"
  && document.querySelector("[data-conversation-workspace-active]") !== null;`;
const WORKSPACE_SESSION_BOUNDARY = `const occupiedWorkspaceSession = current !== void 0
  && typeof document !== "undefined"
  && document.querySelector("[data-conversation-workspace-active]") !== null;`;
const CURRENT_WORKSPACE_SESSION_BOUNDARY = 'const createFreshSession = current !== void 0;';
const WORKSPACE_START_SESSION_PATTERN = /this\.connectWorkspace\(target\)\.then\(\(sessionId\) => \{\s*this\.sessions\.open\(sessionId\);\s*\}, \(reason\) => \{\s*console\.warn\("new session failed:", reason\);\s*\}\);/g;
const WORKSPACE_START_SESSION_REPLACEMENT = `${CURRENT_WORKSPACE_SESSION_BOUNDARY}
const nextSession = createFreshSession
  ? this.sessions.create({ workspaceId: target })
  : this.connectWorkspace(target);
nextSession.then((sessionId) => {
  this.sessions.open(sessionId);
}, (reason) => {
  console.warn("new session failed:", reason);
});`;
const AGENT_LOOP_PARSE_ARGUMENTS_PATTERN = /function parseArguments\(raw\) \{\s*try \{\s*return raw \? JSON\.parse\(raw\) : \{\};\s*\} catch \{\s*return raw;\s*\}\s*\}/g;
const AGENT_LOOP_PARSE_ARGUMENTS_REPLACEMENT = `function parseArguments(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return repairToolArgumentsJson(raw) ?? raw;
  }
}
function repairToolArgumentsJson(raw) {
  if (typeof raw !== "string" || raw.length === 0) return;
  const stack = [];
  let repaired = "";
  let inString = false;
  let escaped = false;
  const openingFor = { "]": "[", "}": "{" };
  const closingFor = { "[": "]", "{": "}" };
  for (const character of raw) {
    if (inString) {
      repaired += character;
      if (escaped) escaped = false;
      else if (character === "\\\\") escaped = true;
      else if (character === "\\\"") inString = false;
      continue;
    }
    if (character === "\\\"") {
      inString = true;
      repaired += character;
      continue;
    }
    if (character === "[" || character === "{") {
      stack.push(character);
      repaired += character;
      continue;
    }
    if (character === "]" || character === "}") {
      const expectedOpening = openingFor[character];
      const ancestor = stack.lastIndexOf(expectedOpening);
      if (ancestor < 0) return;
      while (stack.length - 1 > ancestor) repaired += closingFor[stack.pop()];
      stack.pop();
      repaired += character;
      continue;
    }
    repaired += character;
  }
  if (inString) return;
  while (stack.length > 0) repaired += closingFor[stack.pop()];
  try {
    return JSON.parse(repaired);
  } catch {
    return;
  }
}`;

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
[data-conversation-workspace-layout]:has(> [data-conversation-workspace-pane] [data-conversation-workspace-active]) {
  flex-direction: row;
  overflow: hidden;
}
[data-conversation-workspace-layout]:has(> [data-conversation-workspace-pane] [data-conversation-workspace-active]) > [data-conversation-workspace-pane] {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
[data-conversation-workspace-layout]:has(> [data-conversation-workspace-pane] [data-conversation-workspace-active]) > [data-conversation-workspace-resizer] {
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
[data-conversation-workspace-layout]:has(> [data-conversation-workspace-pane] [data-conversation-workspace-active]) > [data-conversation-workspace-resizer]:hover,
[data-conversation-workspace-layout]:has(> [data-conversation-workspace-pane] [data-conversation-workspace-active]) > [data-conversation-workspace-resizer]:focus-visible {
  background: var(--dsw-alias-state-business-primary);
  outline: none;
}
[data-conversation-workspace-layout]:has(> [data-conversation-workspace-pane] [data-conversation-workspace-active]) > [data-conversation-chat-pane] {
  display: flex;
  flex: 0 0 var(--dsh-conversation-chat-width, 440px);
  width: var(--dsh-conversation-chat-width, 440px);
  min-width: 360px;
  max-width: 640px;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}`;

const V5_RESPONSIVE_WORKSPACE_CSS = `
@media (max-width: 1100px) {
  [data-conversation-workspace-layout]:has(> [data-conversation-workspace-pane] [data-conversation-workspace-active]) {
    flex-direction: column;
    overflow: hidden;
  }
  [data-conversation-workspace-layout]:has(> [data-conversation-workspace-pane] [data-conversation-workspace-active]) > [data-conversation-workspace-pane] {
    min-width: 0;
    min-height: 320px;
    flex: 1 1 55%;
  }
  [data-conversation-workspace-layout]:has(> [data-conversation-workspace-pane] [data-conversation-workspace-active]) > [data-conversation-workspace-resizer] {
    display: none;
  }
  [data-conversation-workspace-layout]:has(> [data-conversation-workspace-pane] [data-conversation-workspace-active]) > [data-conversation-chat-pane] {
    width: 100%;
    min-width: 0;
    max-width: none;
    min-height: 360px;
    flex: 1 1 45%;
    border-top: 1px solid var(--dsw-alias-border-l2);
  }
}`;

const LEGACY_RESIZE_HANDLER = `\t\t\tconst resizeWorkspaceChat = (0, react.useCallback)((event) => {
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
\t\t\t}, [workspaceChatWidth]);`;

const ROBUST_RESIZE_HANDLER = `\t\t\tconst resizeWorkspaceChat = (0, react.useCallback)((event) => {
\t\t\t\tevent.preventDefault();
\t\t\t\tconst handle = event.currentTarget;
\t\t\t\tconst pointerId = event.pointerId;
\t\t\t\tconst startX = event.clientX;
\t\t\t\tconst startWidth = workspaceChatWidth;
\t\t\t\tlet finished = false;
\t\t\t\tlet move;
\t\t\t\tconst finish = () => {
\t\t\t\t\tif (finished) return;
\t\t\t\t\tfinished = true;
\t\t\t\t\thandle.removeEventListener("pointermove", move);
\t\t\t\t\thandle.removeEventListener("pointerup", finish);
\t\t\t\t\thandle.removeEventListener("pointercancel", finish);
\t\t\t\t\thandle.removeEventListener("lostpointercapture", finish);
\t\t\t\t\twindow.removeEventListener("blur", finish);
\t\t\t\t\tif (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
\t\t\t\t};
\t\t\t\tmove = (next) => {
\t\t\t\t\tif ((next.buttons & 1) === 0) {
\t\t\t\t\t\tfinish();
\t\t\t\t\t\treturn;
\t\t\t\t\t}
\t\t\t\t\tsetWorkspaceChatWidth(Math.min(640, Math.max(360, startWidth - (next.clientX - startX))));
\t\t\t\t};
\t\t\t\thandle.setPointerCapture(pointerId);
\t\t\t\thandle.addEventListener("pointermove", move);
\t\t\t\thandle.addEventListener("pointerup", finish, { once: true });
\t\t\t\thandle.addEventListener("pointercancel", finish, { once: true });
\t\t\t\thandle.addEventListener("lostpointercapture", finish, { once: true });
\t\t\t\twindow.addEventListener("blur", finish, { once: true });
\t\t\t}, [workspaceChatWidth]);`;

const ROOT_STATE_REPLACEMENT = `${ROOT_STATE_ANCHOR}
\t\t\tconst [workspaceChatWidth, setWorkspaceChatWidth] = (0, react.useState)(440);
${ROBUST_RESIZE_HANDLER}
\t\t\tconst resizeWorkspaceChatByKey = (0, react.useCallback)((event) => {
\t\t\t\tif (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
\t\t\t\tevent.preventDefault();
\t\t\t\tconst delta = event.key === "ArrowLeft" ? 20 : -20;
\t\t\t\tsetWorkspaceChatWidth((width) => Math.min(640, Math.max(360, width + delta)));
\t\t\t}, []);
\t\t\tconst workspaceLayoutStyles = ${JSON.stringify(WORKSPACE_CSS)};`;

const ROOT_RETURN_REPLACEMENT = `
\t\t\t${CURRENT_WORKSPACE_GATE}
\t\t\treturn (0, react_jsx_runtime.jsxs)("div", {
\t\t\t\tclassName: ConversationRoot_module_css_default.root,
\t\t\t\tstyle: { "--dsh-conversation-chat-width": String(workspaceChatWidth) + "px" },
\t\t\t\t"data-phase": phase,
\t\t\t\t"data-conversation-workspace-layout": "",
\t\t\t\t"${PATCH_MARKER}": "rc.8-v6",
\t\t\t\tchildren: [(0, react_jsx_runtime.jsx)("style", { children: workspaceLayoutStyles }), (0, react_jsx_runtime.jsx)("div", {
\t\t\t\t\t"data-conversation-workspace-pane": "",
\t\t\t\t\tkey: sessionId ?? "new-session",
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
  if (source.includes(PATCH_MARKER)) {
    if (
      source.includes(CURRENT_PATCH_MARKER)
      && source.includes(ROBUST_RESIZE_HANDLER)
      && source.includes(CURRENT_WORKSPACE_SELECTOR)
      && source.includes(CURRENT_WORKSPACE_GATE)
      && source.includes(CURRENT_WORKSPACE_PANE)
    ) {
      return { status: 'already-patched', source };
    }
    if (
      source.includes(CURRENT_PATCH_MARKER)
      && source.includes(ROBUST_RESIZE_HANDLER)
      && source.includes(CURRENT_WORKSPACE_SELECTOR)
      && source.includes(CURRENT_WORKSPACE_GATE)
      && source.includes(LEGACY_WORKSPACE_PANE)
    ) {
      return {
        status: 'upgraded',
        source: replaceExactlyOnce(source, LEGACY_WORKSPACE_PANE, CURRENT_WORKSPACE_PANE),
      };
    }
    if (
      source.includes(V5_PATCH_MARKER)
      && source.includes(ROBUST_RESIZE_HANDLER)
      && source.includes(CURRENT_WORKSPACE_SELECTOR)
      && source.includes(CURRENT_WORKSPACE_GATE)
      && source.includes(CURRENT_WORKSPACE_PANE)
    ) {
      let upgraded = replaceExactlyOnce(source, 'min-width: 520px;', 'min-width: 0;');
      upgraded = replaceExactlyOnce(
        upgraded,
        JSON.stringify(V5_RESPONSIVE_WORKSPACE_CSS).slice(1, -1),
        '',
      );
      upgraded = replaceExactlyOnce(upgraded, V5_PATCH_MARKER, CURRENT_PATCH_MARKER);
      return { status: 'upgraded', source: upgraded };
    }
    if (
      source.includes(V4_PATCH_MARKER)
      && source.includes(ROBUST_RESIZE_HANDLER)
      && source.includes(CURRENT_WORKSPACE_SELECTOR)
      && source.includes(V4_WORKSPACE_GATE)
    ) {
      let upgraded = replaceExactlyOnce(source, V4_WORKSPACE_GATE, CURRENT_WORKSPACE_GATE);
      upgraded = upgradeWorkspacePaneKey(upgraded);
      upgraded = replaceExactlyOnce(upgraded, V4_PATCH_MARKER, CURRENT_PATCH_MARKER);
      return { status: 'upgraded', source: upgraded };
    }
    if (
      source.includes(V3_PATCH_MARKER)
      && source.includes(ROBUST_RESIZE_HANDLER)
      && source.includes(CURRENT_WORKSPACE_SELECTOR)
      && source.includes(LEGACY_WORKSPACE_GATE)
    ) {
      let upgraded = replaceExactlyOnce(source, LEGACY_WORKSPACE_GATE, CURRENT_WORKSPACE_GATE);
      upgraded = upgradeWorkspacePaneKey(upgraded);
      upgraded = replaceExactlyOnce(upgraded, V3_PATCH_MARKER, CURRENT_PATCH_MARKER);
      return { status: 'upgraded', source: upgraded };
    }
    if (
      source.includes(V2_PATCH_MARKER)
      && source.includes(ROBUST_RESIZE_HANDLER)
      && source.includes(LEGACY_WORKSPACE_SELECTOR)
      && source.includes(LEGACY_WORKSPACE_GATE)
    ) {
      let upgraded = source.replaceAll(LEGACY_WORKSPACE_SELECTOR, CURRENT_WORKSPACE_SELECTOR);
      upgraded = replaceExactlyOnce(upgraded, LEGACY_WORKSPACE_GATE, CURRENT_WORKSPACE_GATE);
      upgraded = upgradeWorkspacePaneKey(upgraded);
      upgraded = replaceExactlyOnce(upgraded, V2_PATCH_MARKER, CURRENT_PATCH_MARKER);
      return { status: 'upgraded', source: upgraded };
    }
    if (source.includes(LEGACY_PATCH_MARKER) && source.includes(LEGACY_RESIZE_HANDLER)) {
      let upgraded = replaceExactlyOnce(source, LEGACY_RESIZE_HANDLER, ROBUST_RESIZE_HANDLER);
      upgraded = upgraded.replaceAll(LEGACY_WORKSPACE_SELECTOR, CURRENT_WORKSPACE_SELECTOR);
      if (upgraded.includes(LEGACY_WORKSPACE_GATE)) {
        upgraded = replaceExactlyOnce(upgraded, LEGACY_WORKSPACE_GATE, CURRENT_WORKSPACE_GATE);
      }
      upgraded = upgradeWorkspacePaneKey(upgraded);
      upgraded = replaceExactlyOnce(upgraded, LEGACY_PATCH_MARKER, CURRENT_PATCH_MARKER);
      return { status: 'upgraded', source: upgraded };
    }
    throw new Error('DSH_WORKSPACE_PATCH_UPGRADE_MISMATCH');
  }
  let patched = replaceExactlyOnce(source, ROOT_STATE_ANCHOR, ROOT_STATE_REPLACEMENT);
  patched = replaceExactlyOnce(patched, ROOT_RETURN_ANCHOR, ROOT_RETURN_REPLACEMENT);
  patched = replaceExactlyOnce(patched, ROOT_CHILD_ANCHOR, ROOT_CHILD_REPLACEMENT);
  return { status: 'patched', source: patched };
}

export function patchAgentLoopToolArgumentsParser(source) {
  if (source.includes(AGENT_LOOP_ARGUMENT_REPAIR_MARKER)) {
    return { status: 'already-patched', source };
  }
  const matches = source.match(AGENT_LOOP_PARSE_ARGUMENTS_PATTERN) ?? [];
  if (matches.length !== 1) throw new Error('DSH_AGENT_LOOP_ARGUMENT_PATCH_ANCHOR_MISMATCH');
  return {
    status: 'patched',
    source: source.replace(AGENT_LOOP_PARSE_ARGUMENTS_PATTERN, AGENT_LOOP_PARSE_ARGUMENTS_REPLACEMENT),
  };
}

export function patchWorkspaceRuntimeNewSession(source) {
  if (source.includes(CURRENT_WORKSPACE_SESSION_BOUNDARY)) {
    return { status: 'already-patched', source };
  }
  if (source.includes(WORKSPACE_SESSION_BOUNDARY)) {
    return {
      status: 'upgraded',
      source: source
        .replace(WORKSPACE_SESSION_BOUNDARY, CURRENT_WORKSPACE_SESSION_BOUNDARY)
        .replace('const nextSession = occupiedWorkspaceSession', 'const nextSession = createFreshSession'),
    };
  }
  if (source.includes(LEGACY_WORKSPACE_SESSION_BOUNDARY)) {
    return {
      status: 'upgraded',
      source: source
        .replace(LEGACY_WORKSPACE_SESSION_BOUNDARY, CURRENT_WORKSPACE_SESSION_BOUNDARY)
        .replace('const nextSession = occupiedBlankSession', 'const nextSession = createFreshSession'),
    };
  }
  const matches = source.match(WORKSPACE_START_SESSION_PATTERN) ?? [];
  if (matches.length !== 1) throw new Error('DSH_WORKSPACE_SESSION_PATCH_ANCHOR_MISMATCH');
  return {
    status: 'patched',
    source: source.replace(WORKSPACE_START_SESSION_PATTERN, WORKSPACE_START_SESSION_REPLACEMENT),
  };
}

export function resolveConversationPackageFromDshBin(dshBin) {
  return resolveDshPackageFromBin(
    dshBin,
    'dsh-client-ui-conversation',
    'DSH_WORKSPACE_CONVERSATION_PACKAGE_NOT_FOUND',
  );
}

export function resolveAgentLoopPackageFromDshBin(dshBin) {
  return resolveDshPackageFromBin(
    dshBin,
    'dsh-agent-loop',
    'DSH_AGENT_LOOP_PACKAGE_NOT_FOUND',
  );
}

export function resolveClientRuntimePackageFromDshBin(dshBin) {
  return resolveDshPackageFromBin(
    dshBin,
    'dsh-client-runtime',
    'DSH_CLIENT_RUNTIME_PACKAGE_NOT_FOUND',
  );
}

function resolveDshPackageFromBin(dshBin, packageName, notFoundCode) {
  let cursor = dirname(realpathSync(resolve(dshBin)));
  while (true) {
    const candidate = join(cursor, '@deepseek-ai', packageName);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  throw new Error(notFoundCode);
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

export async function applyAgentLoopToolArgumentsPatch(agentLoopDirectory) {
  const manifestPath = join(agentLoopDirectory, 'package.json');
  const loopPath = join(agentLoopDirectory, 'lib', 'index.js');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.version !== SUPPORTED_VERSION) {
    throw new Error(
      `DSH_AGENT_LOOP_UNSUPPORTED_VERSION:${String(manifest.version)} (expected ${SUPPORTED_VERSION})`,
    );
  }

  const source = await readFile(loopPath, 'utf8');
  const result = patchAgentLoopToolArgumentsParser(source);
  if (result.status === 'already-patched') {
    return { status: result.status, loopPath };
  }

  const backupPath = `${loopPath}.vectorai-tool-arguments.bak`;
  try {
    await copyFile(loopPath, backupPath, fsConstants.COPYFILE_EXCL);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
  }

  const temporaryPath = `${loopPath}.${process.pid}.${randomUUID()}.tmp`;
  const current = await stat(loopPath);
  try {
    await writeFile(temporaryPath, result.source, { mode: current.mode });
    await rename(temporaryPath, loopPath);
  } finally {
    await unlink(temporaryPath).catch((error) => {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    });
  }
  return { status: result.status, loopPath, backupPath };
}

export async function applyWorkspaceRuntimeNewSessionPatch(runtimeDirectory) {
  const manifestPath = join(runtimeDirectory, 'package.json');
  const clientPath = join(runtimeDirectory, 'lib', 'client.js');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.version !== SUPPORTED_VERSION) {
    throw new Error(
      `DSH_CLIENT_RUNTIME_UNSUPPORTED_VERSION:${String(manifest.version)} (expected ${SUPPORTED_VERSION})`,
    );
  }

  const source = await readFile(clientPath, 'utf8');
  const result = patchWorkspaceRuntimeNewSession(source);
  if (result.status === 'already-patched') {
    return { status: result.status, clientPath };
  }

  const backupPath = `${clientPath}.vectorai-workspace-session.bak`;
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

export async function applyDshCompatibilityPatches(dshBin) {
  const conversationDirectory = resolveConversationPackageFromDshBin(dshBin);
  const agentLoopDirectory = resolveAgentLoopPackageFromDshBin(dshBin);
  const runtimeDirectory = resolveClientRuntimePackageFromDshBin(dshBin);
  return {
    conversation: await applyConversationWorkspacePatch(conversationDirectory),
    agentLoop: await applyAgentLoopToolArgumentsPatch(agentLoopDirectory),
    runtime: await applyWorkspaceRuntimeNewSessionPatch(runtimeDirectory),
  };
}

function replaceExactlyOnce(source, anchor, replacement) {
  const first = source.indexOf(anchor);
  if (first < 0 || source.indexOf(anchor, first + anchor.length) >= 0) {
    throw new Error('DSH_WORKSPACE_PATCH_ANCHOR_MISMATCH');
  }
  return `${source.slice(0, first)}${replacement}${source.slice(first + anchor.length)}`;
}

function upgradeWorkspacePaneKey(source) {
  if (source.includes(CURRENT_WORKSPACE_PANE)) return source;
  return replaceExactlyOnce(source, LEGACY_WORKSPACE_PANE, CURRENT_WORKSPACE_PANE);
}

async function main() {
  const flagIndex = process.argv.indexOf('--dsh-bin');
  const dshBin = flagIndex >= 0 ? process.argv[flagIndex + 1] : process.env.DSH_BIN;
  if (typeof dshBin !== 'string' || dshBin.length === 0) {
    throw new Error('DSH_WORKSPACE_DSH_BIN_REQUIRED: pass --dsh-bin /absolute/path/to/dsh');
  }
  const result = await applyDshCompatibilityPatches(dshBin);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const entry = process.argv[1] === undefined ? '' : resolve(process.argv[1]);
if (entry === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
