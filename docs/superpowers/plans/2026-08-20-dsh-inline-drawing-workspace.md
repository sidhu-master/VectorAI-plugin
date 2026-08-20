# DSH Inline Drawing Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the VectorAI drawing canvas and the native DSH conversation side by side in one session page, with a guarded rc.8 compatibility patch and no VectorAI server.

**Architecture:** Add a generic session-scoped `conversation.workspace` single slot to the installed DSH conversation shell through an idempotent, version-checked compatibility patch. Register the existing VectorAI client canvas in that slot and keep the complete DSH header, transcript, composer, approval, and queue tree in a resizable right-hand column.

**Tech Stack:** TypeScript, React 18, DSH/Cordis slots, Node.js ESM patch utility, Vitest, pnpm, CSS Pointer Events.

**Spec:** `docs/superpowers/specs/2026-08-20-dsh-inline-drawing-workspace-design.md`

## Global Constraints

- Target DSH version is exactly `0.1.0-rc.8`; an unknown package version must not be modified.
- The patch must be idempotent, anchor-checked, backed up, and atomically written.
- `conversation.workspace` is generic DSH UI vocabulary; DSH patch code must contain no VectorAI business logic.
- VectorAI registers one Drawing workspace instance per rendered session and must not register the old Drawing Tab.
- The DSH native ChatView, header, composer, approvals, queue, and tool details remain intact.
- Do not add Express, localhost endpoints, a VectorAI cloud dependency, or another Agent loop.
- Do not modify HyperFrames assets.

---

### Task 1: Guarded DSH rc.8 Workspace Patch Transformer

**Files:**
- Create: `scripts/dsh-inline-workspace-patch.mjs`
- Create: `scripts/dsh-inline-workspace-patch.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `patchConversationClient(source: string): { status: 'patched' | 'already-patched'; source: string }`
- Produces: `resolveConversationPackageFromDshBin(dshBin: string): string`
- CLI: `node scripts/dsh-inline-workspace-patch.mjs --dsh-bin /absolute/path/to/dsh`

- [ ] **Step 1: Write transformer failure and idempotence tests**

Create fixture text containing the exact rc.8 anchors for the ConversationRoot child declaration and JSX return. Assert:

```ts
expect(patchConversationClient(fixture).status).toBe('patched');
expect(patched.source).toContain('conversation.workspace');
expect(patched.source).toContain('data-conversation-workspace-pane');
expect(patchConversationClient(patched.source)).toEqual({
  status: 'already-patched',
  source: patched.source,
});
expect(() => patchConversationClient('unknown')).toThrow('DSH_WORKSPACE_PATCH_ANCHOR_MISMATCH');
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm vitest run scripts/dsh-inline-workspace-patch.test.ts`

Expected: FAIL because `scripts/dsh-inline-workspace-patch.mjs` does not exist.

- [ ] **Step 3: Implement exact-once source transformations**

Implement a pure replacement helper that requires each rc.8 anchor exactly once. Inject:

```js
"conversation.workspace": { kind: "single", scope: "session" }
```

and a ConversationRoot layout containing stable attributes:

```text
data-conversation-workspace-layout
data-conversation-workspace-pane
data-conversation-workspace-resizer
data-conversation-chat-pane
```

The right column width starts at `440`, clamps to `[360, 640]`, and updates through a pointer-captured separator.

- [ ] **Step 4: Implement guarded filesystem application**

Read `@deepseek-ai/dsh-client-ui-conversation/package.json`, require version `0.1.0-rc.8`, create `lib/client.js.vectorai-workspace.bak` before the first write, write a same-directory temporary file, then rename it over `lib/client.js`. Never rewrite an already-patched file.

- [ ] **Step 5: Run transformer tests and syntax checks**

Run:

```bash
pnpm vitest run scripts/dsh-inline-workspace-patch.test.ts
node --check scripts/dsh-inline-workspace-patch.mjs
```

Expected: PASS.

- [ ] **Step 6: Add a package script and commit**

Add:

```json
"patch:dsh-workspace": "node scripts/dsh-inline-workspace-patch.mjs"
```

Commit:

```bash
git add package.json scripts/dsh-inline-workspace-patch.mjs scripts/dsh-inline-workspace-patch.test.ts
git commit -m "build: add guarded DSH workspace patch"
```

---

### Task 2: VectorAI Workspace Slot Registration

**Files:**
- Create: `packages/plugin-dsh-space-client/src/workspace-slot.ts`
- Modify: `packages/plugin-dsh-space-client/src/client.tsx`
- Modify: `packages/plugin-dsh-space-client/src/client.test.ts`
- Modify: `packages/plugin-dsh-space-client/src/client.css`

**Interfaces:**
- Produces: SlotMap declaration for `conversation.workspace` with `kind: 'single'`, `scope: 'session'`.
- Consumes: the rc.8 DSH runtime declaration injected by Task 1.

- [ ] **Step 1: Change the lifecycle test expectation first**

Update the fake slot ledger to assert exactly one registration named `conversation.workspace`, and assert no registration named `conversation.view` or id `drawing` remains.

- [ ] **Step 2: Run the Client test and verify it fails**

Run: `pnpm vitest run packages/plugin-dsh-space-client/src/client.test.ts`

Expected: FAIL because the current plugin still injects and registers `conversation.view`.

- [ ] **Step 3: Declare and register the workspace slot**

Add the module augmentation in `workspace-slot.ts`, import it from `client.tsx`, and change:

```ts
slots.inject('conversation.view', () => slots.register({
  name: 'conversation.view', id: 'drawing', order: 20, label: () => '图纸', ...
}, DrawingConversationView));
```

to a `conversation.workspace` single registration with the same session-bound `workspacePort` and `releaseSources` injection.

- [ ] **Step 4: Add stable workspace sizing CSS**

Make `.vai-dsh-workspace-host` fill its parent with `width: 100%`, `height: 100%`, `min-width: 0`, and `min-height: 0`. Style only VectorAI classes; DSH split-shell styling is injected by Task 1 under stable data attributes.

- [ ] **Step 5: Run Client tests and type checks**

Run:

```bash
pnpm vitest run packages/plugin-dsh-space-client/src
pnpm --filter @vectorai/plugin-dsh-space-client check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/plugin-dsh-space-client
git commit -m "feat: embed drawing in DSH conversation workspace"
```

---

### Task 3: Local DSH.app Startup Integration

**Files:**
- Modify: `packages/plugin-dsh-space/README.md`
- Local integration target: `/Users/sidhu/Applications/DSH.app/Contents/Resources/start-dsh.sh`

**Interfaces:**
- Consumes: Task 1 CLI with an exact DSH executable path.
- Produces: every DSH.app launch verifies/applies the compatibility patch before `dsh web` starts.

- [ ] **Step 1: Document the startup hook**

Document the development command:

```bash
node /absolute/path/to/VectorAI/scripts/dsh-inline-workspace-patch.mjs --dsh-bin /absolute/path/to/dsh
```

and explain that it patches only rc.8, creates a sibling backup, and is not a VectorAI server.

- [ ] **Step 2: Update the local launcher with an exact patch hook**

Resolve the executable before building `CMD`:

```zsh
if command -v dsh >/dev/null 2>&1; then
  DSH_BIN="$(command -v dsh)"
else
  DSH_BIN="$(npx --yes --package=@deepseek-ai/dsh@next -c 'command -v dsh')"
fi
node "/Users/sidhu/AndroidStudioProjects/VectorAI/scripts/dsh-inline-workspace-patch.mjs" --dsh-bin "$DSH_BIN" || exit 1
```

Keep the existing no-terminal App lifecycle and `--no-open` detection unchanged.

- [ ] **Step 3: Apply the patch and inspect the target**

Run the patcher twice. Expected statuses: `patched`, then `already-patched`. Run `node --check` on the patched DSH `lib/client.js`.

- [ ] **Step 4: Build the VectorAI DSH bundle**

Run:

```bash
pnpm build:dsh-space
pnpm --filter @vectorai/plugin-dsh-space-client test
pnpm --filter @vectorai/plugin-dsh-space-client check
```

Expected: PASS.

- [ ] **Step 5: Commit repository-owned integration documentation**

```bash
git add packages/plugin-dsh-space/README.md
git commit -m "docs: describe DSH workspace compatibility hook"
```

---

### Task 4: Full Verification and Real DSH Smoke Test

**Files:**
- Modify if needed: `docs/dsh-plugin-migration.md`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified local DSH application at `http://127.0.0.1:3080`.

- [ ] **Step 1: Run repository gates**

Run:

```bash
pnpm test
pnpm check
pnpm build
pnpm build:dsh-space
pnpm lint
git diff --check
```

Expected: tests/check/build pass; lint has no new warnings or errors beyond previously recorded legacy Canvas Hook warnings.

- [ ] **Step 2: Restart only the known DSH application**

Stop the existing `/Users/sidhu/Applications/DSH.app` instance and its owned `dsh web` child, then open the same App. Do not kill unrelated Node or browser processes.

- [ ] **Step 3: Verify service and UI**

Verify HTTP 200 on `127.0.0.1:3080`, then inspect the existing page:

- left Session sidebar remains;
- VectorAI canvas and DSH Chat are visible simultaneously;
- composer is inside the Chat column;
- separator drag changes Chat width;
- canvas receives the remaining size and remains pannable/zoomable/selectable;
- current Drawing and Preview still load for the current session.

- [ ] **Step 4: Record migration progress and commit**

Update the migration status from “Drawing Tab” to “inline conversation workspace”, including the temporary rc.8 compatibility-patch boundary.

```bash
git add docs/dsh-plugin-migration.md
git commit -m "docs: record inline DSH drawing workspace"
```

- [ ] **Step 5: Confirm a clean working tree**

Run: `git status --short`

Expected: no output.
