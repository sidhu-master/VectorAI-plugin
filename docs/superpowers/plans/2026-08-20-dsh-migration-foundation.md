# DSH Migration Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the Apache-2.0 pnpm workspace foundation and extract the canonical Drawing Document model into the first host-independent `@vectorai/drawing-core` package without breaking existing imports.

**Architecture:** The first migration batch moves only the dependency-leaf `document/types.ts` and `document/create.ts` into `packages/drawing-core`. The old `src/drawing/document/*` paths become compatibility re-exports, so the existing application remains unchanged while the new package becomes the canonical owner. A package-local architecture test prevents DSH, React, Express, Node runtime, or legacy application imports from entering production core files.

**Tech Stack:** TypeScript 5.8, pnpm workspace, Vitest 3, Apache-2.0

**Spec:** `docs/dsh-plugin-migration.md`

## Global Constraints

- Work only on `codex/dsh-plugin-migration`, never on `main`.
- VectorAI must not add a new HTTP server or cloud dependency.
- `packages/drawing-core/src` production files must not import React, Express, Node built-ins, `@deepseek-ai/*`, `api/`, `src/components`, `src/hooks`, or `src/services`.
- Existing callers through `src/drawing/document/*` must continue to compile and pass their existing tests.
- New production behavior follows RED → GREEN → REFACTOR; licensing and workspace metadata are verified structurally.
- Do not change HyperFrames projects.

---

### Task 1: Apache-2.0 and workspace metadata

**Files:**
- Create: `LICENSE`
- Create: `NOTICE`
- Create: `pnpm-workspace.yaml`
- Modify: `package.json`
- Create: `packages/drawing-core/package.json`
- Create: `packages/drawing-core/tsconfig.json`

**Interfaces:**
- Consumes: the root pnpm installation and existing `tsconfig.json`.
- Produces: workspace package name `@vectorai/drawing-core` and SPDX license identifier `Apache-2.0`.

- [ ] **Step 1: Add the license files**

Copy the unmodified official Apache License 2.0 text from `https://www.apache.org/licenses/LICENSE-2.0.txt` into root `LICENSE`. Add this root `NOTICE`:

```text
VectorAI
Copyright 2026 VectorAI contributors

This product includes software developed by the VectorAI contributors.
```

- [ ] **Step 2: Add workspace discovery**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

Change the root package name from `trae-project` to `vectorai`, keep it private, and add:

```json
"license": "Apache-2.0"
```

- [ ] **Step 3: Add the drawing-core package metadata**

Create `packages/drawing-core/package.json`:

```json
{
  "name": "@vectorai/drawing-core",
  "version": "0.1.0-alpha.0",
  "description": "Host-independent canonical drawing document and transaction core for VectorAI",
  "type": "module",
  "license": "Apache-2.0",
  "sideEffects": false,
  "exports": {
    ".": "./src/index.ts",
    "./document": "./src/document/index.ts"
  },
  "types": "./src/index.ts",
  "scripts": {
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run src"
  }
}
```

Create `packages/drawing-core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": false,
    "tsBuildInfoFile": "../../node_modules/.tmp/drawing-core.tsbuildinfo"
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Verify metadata**

Run:

```bash
pnpm list -r --depth -1
pnpm --filter @vectorai/drawing-core exec tsc -p tsconfig.json --noEmit
```

Expected: pnpm lists both `vectorai` and `@vectorai/drawing-core`. The package check may report missing `src` until Task 2; package discovery itself must succeed.

- [ ] **Step 5: Commit**

```bash
git add LICENSE NOTICE pnpm-workspace.yaml package.json packages/drawing-core/package.json packages/drawing-core/tsconfig.json
git commit -m "chore: establish Apache workspace foundation"
```

---

### Task 2: Extract the Drawing Document leaf module with TDD

**Files:**
- Create: `packages/drawing-core/src/document/document.test.ts`
- Create: `packages/drawing-core/src/dependency-boundary.test.ts`
- Move: `src/drawing/document/types.ts` → `packages/drawing-core/src/document/types.ts`
- Move: `src/drawing/document/create.ts` → `packages/drawing-core/src/document/create.ts`
- Create: `packages/drawing-core/src/document/index.ts`
- Create: `packages/drawing-core/src/index.ts`
- Recreate compatibility wrapper: `src/drawing/document/types.ts`
- Recreate compatibility wrapper: `src/drawing/document/create.ts`

**Interfaces:**
- Consumes: existing `DrawingDocument`, branded IDs, `IdFactory`, `randomIdFactory`, and `createEmptyDrawing` behavior.
- Produces: `@vectorai/drawing-core` root exports and `@vectorai/drawing-core/document` exports for the document leaf module.

- [ ] **Step 1: Write the failing behavior test**

Create `packages/drawing-core/src/document/document.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { createEmptyDrawing } from './create';

describe('@vectorai/drawing-core document', () => {
  it('creates a deterministic empty VectorAI Drawing document', () => {
    const document = createEmptyDrawing({
      unit: 'cm',
      idFactory: { next: () => 'drawing_package' },
      now: () => 42,
    });

    expect(document).toEqual({
      protocol: 'VectorAI-Drawing',
      schemaVersion: '1.0',
      id: 'drawing_package',
      metadata: { createdAt: 42, updatedAt: 42 },
      unitSystem: { length: 'cm', angle: 'deg' },
      coordinateFrames: [{
        id: 'frame_document',
        kind: 'document',
        transform: [1, 0, 0, 1, 0, 0],
      }],
      geometry: [],
      annotations: [],
      relations: [],
      features: [],
    });
  });
});
```

- [ ] **Step 2: Write the failing package boundary test**

Create `packages/drawing-core/src/dependency-boundary.test.ts`. It must recursively read non-test `.ts` files under its own `src`, assert that `document/create.ts` and `document/types.ts` exist, parse static and dynamic import specifiers, and expect no specifier matching:

```ts
const forbidden = [
  /^node:/,
  /^(?:react|react-dom|express)(?:\/|$)/,
  /^@deepseek-ai\//,
  /(?:^|\/)api(?:\/|$)/,
  /(?:^|\/)src\/(?:components|hooks|services)(?:\/|$)/,
];
```

The failure before extraction must be an assertion that the two required production files are absent, not a syntax/configuration error.

- [ ] **Step 3: Run RED**

Run:

```bash
pnpm vitest run packages/drawing-core/src/document/document.test.ts packages/drawing-core/src/dependency-boundary.test.ts
```

Expected: FAIL because `./create` and the required package production files do not exist.

- [ ] **Step 4: Move the canonical source and add exports**

Move the two existing source files unchanged into the package. Add `packages/drawing-core/src/document/index.ts`:

```ts
export { createEmptyDrawing, randomIdFactory } from './create';
export type { IdFactory } from './create';
export type * from './types';
```

Add `packages/drawing-core/src/index.ts`:

```ts
export * from './document';
```

Recreate `src/drawing/document/create.ts` as:

```ts
export { createEmptyDrawing, randomIdFactory } from '../../../packages/drawing-core/src/document/create';
export type { IdFactory } from '../../../packages/drawing-core/src/document/create';
```

Recreate `src/drawing/document/types.ts` as:

```ts
export type * from '../../../packages/drawing-core/src/document/types';
```

- [ ] **Step 5: Run GREEN**

Run:

```bash
pnpm vitest run packages/drawing-core/src/document/document.test.ts packages/drawing-core/src/dependency-boundary.test.ts src/drawing/tests/document.test.ts
pnpm --filter @vectorai/drawing-core check
```

Expected: all three test files pass and the package type-check exits 0.

- [ ] **Step 6: Commit**

```bash
git add packages/drawing-core/src src/drawing/document
git commit -m "refactor: extract drawing document core package"
```

---

### Task 3: Validate legacy compatibility and the migration gate

**Files:**
- Modify: `docs/dsh-plugin-migration.md`
- Modify: `docs/superpowers/plans/2026-08-20-dsh-migration-foundation.md`

**Interfaces:**
- Consumes: the new package exports and legacy compatibility wrappers.
- Produces: verified migration status and a clean starting point for extracting Command/Patch/Transaction next.

- [ ] **Step 1: Run focused Drawing Core regression**

Run:

```bash
pnpm vitest run src/drawing/tests packages/drawing-core/src
```

Expected: every Drawing Core and package test passes.

- [ ] **Step 2: Run repository checks**

Run:

```bash
pnpm test
pnpm check
pnpm lint
```

Expected: tests and TypeScript pass. Lint may retain only the three baseline findings recorded in `docs/dsh-plugin-migration.md`; no new finding may originate under `packages/drawing-core`.

- [ ] **Step 3: Update migration status**

Add an implementation status section to `docs/dsh-plugin-migration.md` recording:

```markdown
### 3.3 实施进度

- Phase 0（进行中）：Apache-2.0 与 pnpm workspace 已建立。
- Phase 1（进行中）：Drawing Document 叶子模块已迁入 `@vectorai/drawing-core`；旧路径为兼容转发层。
- 下一提取单元：Command → Patch → Validation → Transaction。
```

Mark completed checkboxes in this plan based only on commands actually run.

- [ ] **Step 4: Verify the final diff**

Run:

```bash
git diff --check
git status --short --branch
git diff --stat HEAD
```

Expected: no whitespace errors; only the intended documentation status change remains after the two implementation commits.

- [ ] **Step 5: Commit the status update**

```bash
git add docs/dsh-plugin-migration.md docs/superpowers/plans/2026-08-20-dsh-migration-foundation.md
git commit -m "docs: record drawing core migration start"
```
