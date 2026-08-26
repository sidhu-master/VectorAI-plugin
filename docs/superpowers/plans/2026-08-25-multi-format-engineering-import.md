# Multi-format Engineering Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the active DSH session accept one DXF plus multiple local engineering documents through drag/drop or the annotation import panel, extract supported formats locally, and feed deterministic document evidence into smart partitioning.

**Architecture:** The annotation client owns file classification, transient pending-document state, capture-phase DSH drop interception, hashing, and binary request serialization. The annotation Host owns authoritative admission, deterministic local text extraction, and orchestration that finishes all document validation before mutating the drawing through `importDxf`.

**Tech Stack:** TypeScript, React 18, DSH Cordis slots/remotes, Zod, Vitest, Vite, the local Node entry of `officeparser`, existing VectorAI drawing and annotation packages.

**Spec:** `docs/superpowers/specs/2026-08-25-multi-format-engineering-import-design.md`

## Global Constraints

- No VectorAI cloud service, Express service, CDN worker, remote OCR, or machine-wide Office/LibreOffice dependency.
- Ordinary DSH images and unrelated files remain on the DSH attachment path.
- VectorAI intercepts only complete engineering import sets or supported document-only pending sets.
- One import contains exactly one DXF and at most 16 documents.
- DXF limit is 20 MiB; each document is 20 MiB; aggregate document bytes are 50 MiB.
- Extracted text is limited to 4 MiB per document and 8 MiB combined.
- DOC/XLS/PPT fail explicitly as legacy unsupported formats.
- All behavior is test-first; no accepted format may be listed without a parser-path test.

---

### Task 1: Binary multi-document wire contract

**Files:**
- Modify: `packages/plugin-space-contracts/src/index.ts`
- Modify: `packages/plugin-space-contracts/src/index.test.ts`
- Modify: `packages/plugin-dsh-annotation-client/src/partition-controller.ts`
- Modify: `packages/plugin-dsh-annotation-client/src/partition-controller.test.ts`

**Interfaces:**
- Produces `engineeringDocumentInputSchema`, `EngineeringDocumentInput`, and `PartitionImportRequest.engineeringDocuments`.
- Produces `PartitionController.actions.importFiles(dxf: File, engineeringDocuments?: readonly File[]): Promise<void>`.
- Keeps legacy `engineeringDocument?: { name: string; text: string }` readable during migration.

- [ ] **Step 1: Write failing contract tests**

```ts
it('accepts ordered immutable engineering document inputs', () => {
  const request = {
    dxf: { name: 'shaft.dxf', digest: `sha256:${'a'.repeat(64)}`, base64: 'WA==' },
    engineeringDocuments: [
      { name: 'limits.pdf', digest: `sha256:${'b'.repeat(64)}`, mediaType: 'application/pdf', base64: 'WA==' },
      { name: 'notes.txt', digest: `sha256:${'c'.repeat(64)}`, base64: 'WA==' },
    ],
  };
  expect(partitionImportRequestSchema.parse(request)).toEqual(request);
});

it('retains the legacy single text document input during migration', () => {
  const request = {
    dxf: { name: 'shaft.dxf', digest: `sha256:${'a'.repeat(64)}`, base64: 'WA==' },
    engineeringDocument: { name: 'notes.txt', text: '轴段' },
  };
  expect(partitionImportRequestSchema.parse(request)).toEqual(request);
});
```

- [ ] **Step 2: Run contract tests and confirm RED**

Run: `pnpm vitest run packages/plugin-space-contracts/src/index.test.ts`

Expected: the new `engineeringDocuments` property is rejected by the strict schema.

- [ ] **Step 3: Add the strict binary document schema**

Implement a 64-hex SHA-256 schema and:

```ts
export const engineeringDocumentInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  digest: sha256DigestSchema,
  mediaType: z.string().trim().min(1).max(127).optional(),
  base64: z.string(),
}).strict();

export const partitionImportRequestSchema = z.object({
  dxf: dxfBinaryInputSchema,
  engineeringDocuments: z.array(engineeringDocumentInputSchema).max(16).optional(),
  engineeringDocument: z.object({ name: z.string().min(1).max(255), text: z.string() }).strict().optional(),
}).strict();
```

- [ ] **Step 4: Write failing controller tests for multiple binary files and limits**

Test ordered serialization, MIME/name preservation, per-file limit, 50 MiB aggregate limit, and no remote call after admission failure.

- [ ] **Step 5: Run controller tests and confirm RED**

Run: `pnpm --filter @vectorai/plugin-dsh-annotation-client test -- src/partition-controller.test.ts`

Expected: `importFiles` accepts only one optional document and emits legacy text.

- [ ] **Step 6: Implement client hashing and serialization**

Read each accepted `File` once, compute SHA-256, and emit ordered base64 document objects. Keep all byte-limit constants in an exported `engineering-file-policy.ts` shared by classification and serialization.

- [ ] **Step 7: Run Task 1 tests and typecheck**

Run:

```bash
pnpm vitest run packages/plugin-space-contracts/src/index.test.ts
pnpm --filter @vectorai/plugin-dsh-annotation-client test -- src/partition-controller.test.ts
pnpm --filter @vectorai/plugin-dsh-annotation-client check
```

- [ ] **Step 8: Commit Task 1**

```bash
git add packages/plugin-space-contracts packages/plugin-dsh-annotation-client/src/partition-controller.ts packages/plugin-dsh-annotation-client/src/partition-controller.test.ts packages/plugin-dsh-annotation-client/src/engineering-file-policy.ts
git commit -m "feat: add multi-document partition import contract"
```

---

### Task 2: Local engineering document extractor

**Files:**
- Create: `packages/plugin-dsh-annotation-host/src/engineering-document-extractor.ts`
- Create: `packages/plugin-dsh-annotation-host/src/engineering-document-extractor.test.ts`
- Create: `packages/plugin-dsh-annotation-host/src/__fixtures__/engineering-documents.ts`
- Modify: `packages/plugin-dsh-annotation-host/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes `EngineeringDocumentInput`.
- Produces `extractEngineeringDocuments(inputs, options?): Promise<{ documents: ExtractedEngineeringDocument[]; combinedText?: string }>`.

- [ ] **Step 1: Add failing extractor tests**

Cover UTF-8/UTF-16 BOM text; TXT/MD/CSV/TSV/JSON/YAML/INI/XML/HTML/LOG routing; PDF/DOCX/XLSX/PPTX/ODT/ODS/ODP/RTF/EPUB routing with small real in-memory fixtures; stable file-order boundaries; digest mismatch; empty text; corrupt input; legacy DOC/XLS/PPT; per-file and combined text limits.

The primary success assertion is:

```ts
expect(result.combinedText).toBe([
  '===== ENGINEERING DOCUMENT: a.txt =====',
  '第一轴段',
  '===== END ENGINEERING DOCUMENT: a.txt =====',
  '===== ENGINEERING DOCUMENT: b.csv =====',
  'name,value\n直径,20',
  '===== END ENGINEERING DOCUMENT: b.csv =====',
].join('\n'));
```

- [ ] **Step 2: Run extractor tests and confirm RED**

Run: `pnpm --filter @vectorai/plugin-dsh-annotation-host test -- src/engineering-document-extractor.test.ts`

Expected: module does not exist.

- [ ] **Step 3: Add the local structured-document dependency**

Install a pinned `officeparser` version in the annotation Host. Use its Node entry only, disable OCR, pass explicit file type, and enforce an `AbortSignal` timeout. Do not use its browser CDN worker defaults.

- [ ] **Step 4: Implement authoritative extraction**

Implement:

```ts
export interface ExtractedEngineeringDocument {
  name: string;
  format: string;
  text: string;
  warnings: string[];
}

export async function extractEngineeringDocuments(
  inputs: readonly EngineeringDocumentInput[],
  options?: { signal?: AbortSignal; parseStructured?: StructuredDocumentParser },
): Promise<{ documents: ExtractedEngineeringDocument[]; combinedText?: string }>;
```

Verify base64 and digest before parser dispatch. Normalize CRLF/CR, strip trailing whitespace, reject binary-looking plain text and empty extraction, and enforce all limits on bytes rather than JavaScript character count.

- [ ] **Step 5: Run extractor tests and Host checks**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-annotation-host test -- src/engineering-document-extractor.test.ts
pnpm --filter @vectorai/plugin-dsh-annotation-host check
pnpm build:dsh-annotation
```

- [ ] **Step 6: Commit Task 2**

```bash
git add packages/plugin-dsh-annotation-host pnpm-lock.yaml
git commit -m "feat: extract engineering documents locally"
```

---

### Task 3: Admission-before-mutation partition orchestration

**Files:**
- Modify: `packages/plugin-dsh-annotation-host/src/partition-service.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/partition-service.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/service.ts`

**Interfaces:**
- Consumes Task 2 `extractEngineeringDocuments`.
- Preserves `PartitionWorkflowService.importAndAnalyze(agent, request, signal?)`.

- [ ] **Step 1: Write failing orchestration tests**

Prove document extraction finishes before `space.importDxf`, extraction failure leaves `importDxf` uncalled, ordered combined text reaches `analyzeShaftPartition`, legacy text input still works, and successful binary documents preserve filename boundaries.

- [ ] **Step 2: Run partition workflow tests and confirm RED**

Run: `pnpm --filter @vectorai/plugin-dsh-annotation-host test -- src/partition-service.test.ts`

Expected: current workflow imports DXF before reading one legacy text document.

- [ ] **Step 3: Inject and call the extractor before drawing mutation**

Extend the constructor with an optional extractor port for deterministic tests. Production defaults to Task 2. Build `engineeringText` from binary documents or the legacy text document, then call `space.importDxf`, snapshot, partition analysis, and optional semantic review in the existing order.

- [ ] **Step 4: Run Host regression tests**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-annotation-host test
pnpm --filter @vectorai/plugin-dsh-annotation-host check
```

- [ ] **Step 5: Commit Task 3**

```bash
git add packages/plugin-dsh-annotation-host/src/partition-service.ts packages/plugin-dsh-annotation-host/src/partition-service.test.ts packages/plugin-dsh-annotation-host/src/service.ts
git commit -m "feat: validate documents before DXF mutation"
```

---

### Task 4: Session-scoped engineering drop bridge

**Files:**
- Create: `packages/plugin-dsh-annotation-client/src/EngineeringDropBridge.tsx`
- Create: `packages/plugin-dsh-annotation-client/src/EngineeringDropBridge.test.tsx`
- Create: `packages/plugin-dsh-annotation-client/src/engineering-drop.ts`
- Create: `packages/plugin-dsh-annotation-client/src/engineering-drop.test.ts`
- Modify: `packages/plugin-dsh-annotation-client/src/client.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/client.test.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/client.css`
- Modify: `packages/plugin-dsh-annotation-client/package.json`

**Interfaces:**
- Consumes Task 1 `PartitionController.actions.importFiles`.
- Produces `classifyEngineeringDrop(files)` and the `vectorai-engineering-import-drop` `conversation.input.dock` contribution.

- [ ] **Step 1: Write failing pure classification tests**

Test `.DXF` with empty MIME, one DXF plus multiple supported documents, supported document-only pending state, multiple DXFs, legacy documents, unknown companions, duplicate filenames, images-only pass-through, and mixed image/engineering rejection.

- [ ] **Step 2: Run classification tests and confirm RED**

Run: `pnpm --filter @vectorai/plugin-dsh-annotation-client test -- src/engineering-drop.test.ts`

- [ ] **Step 3: Implement strict classification**

Return one of:

```ts
type EngineeringDropDecision =
  | { kind: 'pass' }
  | { kind: 'pending'; documents: File[] }
  | { kind: 'import'; dxf: File; documents: File[] }
  | { kind: 'reject'; code: EngineeringImportErrorCode; filenames: string[] };
```

- [ ] **Step 4: Write failing bridge and slot-lifecycle tests**

Use a fake event target to prove capture listeners stop DSH only for non-`pass` decisions, pending state is visible and clearable, a later DXF consumes pending files, import errors remain visible, and disposal removes listeners and releases pending files. Extend `client.test.tsx` to require the `conversation.input.dock` registration and disposal.

- [ ] **Step 5: Run bridge/client tests and confirm RED**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-annotation-client test -- src/EngineeringDropBridge.test.tsx
pnpm --filter @vectorai/plugin-dsh-annotation-client test -- src/client.test.tsx
```

- [ ] **Step 6: Implement the bridge and DSH slot registration**

Add direct dependencies on `@deepseek-ai/dsh-client-ui-conversation` and `@deepseek-ai/dsh-client-ui-slots`. Register one session-scoped dock entry through `slots.inject('conversation.input.dock', ...)`; inject the session's controller and `stateSource.refresh`. Install `dragenter`, `dragover`, and `drop` listeners in capture phase and render a compact Chinese progress/pending/error row only when state is non-idle.

- [ ] **Step 7: Run client tests, typecheck, and annotation bundle**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-annotation-client test
pnpm --filter @vectorai/plugin-dsh-annotation-client check
pnpm build:dsh-annotation
```

- [ ] **Step 8: Commit Task 4**

```bash
git add packages/plugin-dsh-annotation-client pnpm-lock.yaml
git commit -m "feat: route engineering file drops to annotation"
```

---

### Task 5: Multi-file annotation import panel

**Files:**
- Modify: `packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.test.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/client.css`

**Interfaces:**
- Consumes the shared Task 4 classification/admission policy and Task 1 controller API.

- [ ] **Step 1: Write failing workspace tests**

Assert the document input uses `multiple`, exposes the exact supported-format `accept` value, lists selected filenames, invokes `importFiles(dxf, documents)`, and renders Chinese messages for legacy/unsupported/size errors.

- [ ] **Step 2: Run workspace tests and confirm RED**

Run: `pnpm --filter @vectorai/plugin-dsh-annotation-client test -- src/AnnotationWorkspace.test.tsx`

- [ ] **Step 3: Implement the shared multi-file panel**

Replace the single `engineering` state with `File[]`, apply the same classifier before submit, and keep the existing explicit “导入并智能分区” action. Do not submit on file selection alone.

- [ ] **Step 4: Run annotation client regression tests**

Run:

```bash
pnpm --filter @vectorai/plugin-dsh-annotation-client test
pnpm --filter @vectorai/plugin-dsh-annotation-client check
```

- [ ] **Step 5: Commit Task 5**

```bash
git add packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.tsx packages/plugin-dsh-annotation-client/src/AnnotationWorkspace.test.tsx packages/plugin-dsh-annotation-client/src/client.css
git commit -m "feat: support multi-file annotation imports"
```

---

### Task 6: Real-sample E2E, documentation, and full verification

**Files:**
- Modify: `scripts/e2e-dxf-smart-partition.ts`
- Modify: `docs/prd.md`
- Modify: `docs/tech-architecture.md`
- Modify: `docs/development.md`

**Interfaces:**
- Verifies the complete tasks above using `/Users/sidhu/Downloads/初始图.dxf` and `/Users/sidhu/Downloads/样本图001# DXF工程数据文档.txt`.

- [ ] **Step 1: Extend E2E assertions**

Build the binary `engineeringDocuments` request from the real text file, assert document-sourced versus inferred boundaries remain distinguishable, verify editable draft state, and prove an unsupported/corrupt document fails before a drawing import.

- [ ] **Step 2: Run the focused real-sample E2E**

Run: `pnpm e2e:dxf-smart-partition`

Expected: PASS with all shaft segments present and provenance split between document and inferred evidence.

- [ ] **Step 3: Update product and technical documentation**

Document the exact support matrix, local-only extraction, pending-document behavior, limits, error semantics, and the fact that ordinary DSH attachments are unchanged.

- [ ] **Step 4: Run complete verification**

Run:

```bash
pnpm check
pnpm lint
pnpm test
pnpm build:dsh-space
pnpm build:dsh-annotation
pnpm e2e:drawing-surface
pnpm e2e:dxf-smart-partition
pnpm e2e:tolerance-data-foundation
git diff --check
```

- [ ] **Step 5: Inspect the built bundle for forbidden dependencies**

Run:

```bash
rg -n "https?://|cdn|express|VectorAI cloud" packages/plugin-dsh-annotation-host/lib packages/plugin-dsh-annotation-client/lib
```

Expected: no runtime CDN, cloud, or Express dependency. License/comment text matches are manually classified.

- [ ] **Step 6: Commit Task 6**

```bash
git add scripts/e2e-dxf-smart-partition.ts docs packages/plugin-dsh-annotation-host/lib packages/plugin-dsh-annotation-client/lib
git commit -m "test: verify multi-format engineering import"
```
