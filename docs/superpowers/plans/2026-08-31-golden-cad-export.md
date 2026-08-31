# 黄金样本等价 CAD 导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simplified DXF annotation writer with a standards-profiled exporter whose CAD entity types, styles, colors, arrows, symbols, and paper layout match the golden sample contract.

**Architecture:** Keep engineering semantics independent from DXF presentation. `drawing-core` writes complete generic AC1027 primitives; the annotation host supplies a fixture-independent GB CAD profile, converts engineering annotations into golden-compatible entity kinds, and lays them out in model space. The golden target remains a test-only Oracle.

**Tech Stack:** TypeScript, Vitest, `@node-projects/acad-ts`, AC1027 ASCII DXF, ezdxf audit for local acceptance.

**Spec:** `docs/superpowers/specs/2026-08-31-golden-cad-export-design.md`

## Global Constraints

- CAD output is authoritative; DSH preview does not define DXF appearance.
- Production source must not read or reference `golden-shaft-001/target.dxf`.
- Do not hard-code sample coordinates or sample annotation values.
- Preserve original HATCH semantics and geometry.
- Missing tolerance values remain unresolved; never invent numeric values.
- Do not modify DSH source.

---

### Task 1: Executable golden CAD contract

**Files:**
- Create: `packages/plugin-dsh-annotation-host/src/cad-golden-contract.test.ts`
- Create: `packages/plugin-dsh-annotation-host/src/cad-test-inspector.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/golden-engineering-export.integration.test.ts`

**Interfaces:**
- Consumes: raw DXF strings and the test-only golden `target.dxf`.
- Produces: `inspectCadContract(dxf: string): CadContractSnapshot` with layer, style, dimension, block and entity facts.

- [ ] **Step 1: Write the failing contract test**

```ts
const golden = inspectCadContract(readFileSync(goldenPath, 'utf8'));
const actual = inspectCadContract(exportEngineeringDrawingDxf(document, plan));
expect(actual.layers['7标注层']).toEqual(golden.layers['7标注层']);
expect(actual.dimensionStyles.GB_LINEAR).toEqual(golden.dimensionStyles.GB_LINEAR);
expect(actual.dimensionPictures).toMatchObject({ hasMText: true, hasHatchArrowheads: true });
expect(actual.dimensionKinds).toEqual(golden.dimensionKinds);
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `pnpm vitest run packages/plugin-dsh-annotation-host/src/cad-golden-contract.test.ts --reporter=verbose`

Expected: FAIL showing current 2.5 mm DIMSTYLE values, missing HATCH/MTEXT dimension pictures, and diametric instead of linear diameter entities.

- [ ] **Step 3: Implement the test-only inspector**

Parse with `CadReader`, expose only stable CAD facts, and dispose the reader in `finally`. The inspector must not be exported by production package entrypoints.

- [ ] **Step 4: Re-run to retain the expected RED state**

Run the command from Step 2 and confirm failures are contract mismatches rather than parser errors.

### Task 2: GB CAD tables and reusable primitives

**Files:**
- Create: `packages/drawing-core/src/io/dxf-profile.ts`
- Modify: `packages/drawing-core/src/io/dxf.ts`
- Modify: `packages/drawing-core/src/io/dxf.test.ts`
- Modify: `packages/drawing-core/src/index.ts`

**Interfaces:**
- Consumes: `DxfExportProfile`, `DxfExportEntity[]`.
- Produces: AC1027 TABLES/BLOCKS containing exact layer, linetype, text-style and dimension-style records.

- [ ] **Step 1: Add failing profile tests**

```ts
expect(profile.layers.get('7标注层')).toEqual({ color: 4, lineType: 'Continuous', lineWeight: 18 });
expect(profile.dimensionStyles.get('GB_LINEAR')).toMatchObject({ textHeight: 3.5, arrowSize: 3.5, extension: 1, gap: 1.5, textColor: 3 });
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run packages/drawing-core/src/io/dxf.test.ts --reporter=verbose`

Expected: FAIL because lineweight, text styles and full DIMSTYLE fields are not represented.

- [ ] **Step 3: Add the profile types and writer support**

Define `DxfLayerStyle`, `DxfTextStyle`, `DxfDimensionStyle`, and `DxfExportProfile`. Write group codes 370 for layer lineweight and the golden DIMSTYLE fields 40/41/42/44/140/147/176/177/178/271/78. Add MTEXT and filled HATCH/SOLID-arrow primitives to `DxfBlockGraphic`.

- [ ] **Step 4: Implement `GB_SHAFT_CAD_PROFILE` outside drawing-core**

The generic writer accepts profiles; it does not know golden names. Task 3 supplies the concrete profile.

- [ ] **Step 5: Verify GREEN for drawing-core**

Run: `pnpm vitest run packages/drawing-core/src/io/dxf.test.ts --reporter=verbose`

Expected: PASS.

### Task 3: Golden-compatible engineering CAD projection

**Files:**
- Create: `packages/plugin-dsh-annotation-host/src/gb-cad-profile.ts`
- Create: `packages/plugin-dsh-annotation-host/src/cad-dimension-projector.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/engineering-dxf-export.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/engineering-dxf-export.test.ts`

**Interfaces:**
- Consumes: canonical annotations, `AxialDimensionScheme`, datum and GD&T intents.
- Produces: `projectEngineeringCadEntities(document, plan): DxfExportEntity[]` using `GB_SHAFT_CAD_PROFILE`.

- [ ] **Step 1: Write failing type-mapping tests**

```ts
expect(projectedDiameter.dimensionKind).toBe('linear');
expect(projectedDiameter.text).toBe('%%C<>');
expect(projectedDiameter.style).toBe('GB_LINEAR');
expect(projectedAngular.style).toBe('GB_ANGULAR');
expect(projectedRadius.style).toBe('GB_RADIAL');
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run packages/plugin-dsh-annotation-host/src/engineering-dxf-export.test.ts --reporter=verbose`

Expected: FAIL because diameter annotations are currently emitted as diametric DIMENSION entities and picture blocks lack golden arrows/MTEXT.

- [ ] **Step 3: Implement dimension projection and picture blocks**

Use linear DIMENSION plus `%%C` for shaft diameters, preserve angular/radial subclasses, and generate each dimension picture with MTEXT, extension lines, dimension line/arc and closed filled arrowhead HATCH primitives. Use 3.5 mm paper text and arrow dimensions from the profile.

- [ ] **Step 4: Implement standard symbol blocks**

Project datum markers, compound feature-control frames, unresolved values, and roughness data already present in the semantic plan into reusable block pictures on `8符号标注层`. Use orthogonal leaders and the profile's symbol/text styles; do not generate missing process values.

- [ ] **Step 5: Verify GREEN**

Run the command from Step 2.

Expected: PASS with exact entity-type and block-composition assertions.

### Task 4: CAD-only paper layout

**Files:**
- Create: `packages/plugin-dsh-annotation-host/src/cad-paper-layout.ts`
- Create: `packages/plugin-dsh-annotation-host/src/cad-paper-layout.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/engineering-dxf-export.ts`

**Interfaces:**
- Consumes: document bounds, axis, dimension chains, automatic annotations and user world-space overrides.
- Produces: `layoutCadAnnotations(input): CadAnnotationLayout` independent of viewport scale/zoom.

- [ ] **Step 1: Write failing layout tests**

```ts
expect(layout.axialChains.map((lane) => lane.offset)).toEqual([7, 14, 21]);
expect(layout.openingAngles.every((item) => item.side === 'outside-end')).toBe(true);
expect(layout.gdtFrames.every((item) => item.leaderSegments.every(isOrthogonal))).toBe(true);
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run packages/plugin-dsh-annotation-host/src/cad-paper-layout.test.ts --reporter=verbose`

Expected: FAIL because current layout derives oversized lanes from preview-oriented offsets.

- [ ] **Step 3: Implement deterministic model-space layout**

Use profile text height as the base unit, allocate compact lanes above the part by chain, place end angles outside axial ends, and run rectangle/segment collision checks for labels and frames. Apply persisted user positions last.

- [ ] **Step 4: Verify GREEN**

Run the command from Step 2.

Expected: PASS.

### Task 5: Full golden fixture and real CAD export verification

**Files:**
- Modify: `packages/plugin-dsh-annotation-host/src/golden-engineering-export.integration.test.ts`
- Create: `scripts/audit-golden-cad-export.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: initial fixture, engineering data, production annotation pipeline and golden target Oracle.
- Produces: generated DXF plus a machine-readable structural/style diff report.

- [ ] **Step 1: Extend the integration test**

Assert AC1027/INSUNITS, required layers, exact DIMSTYLE facts, matching dimension-kind distribution for generated semantic categories, MTEXT/HATCH arrow presence, preserved HATCH boundaries, and absence of sample identifiers in production source.

- [ ] **Step 2: Run full focused verification**

Run: `pnpm vitest run packages/drawing-core/src/io/dxf.test.ts packages/plugin-dsh-annotation-host/src/cad-golden-contract.test.ts packages/plugin-dsh-annotation-host/src/engineering-dxf-export.test.ts packages/plugin-dsh-annotation-host/src/cad-paper-layout.test.ts packages/plugin-dsh-annotation-host/src/golden-engineering-export.integration.test.ts --reporter=verbose`

Expected: all focused tests pass.

- [ ] **Step 3: Run repository and bundle checks**

Run: `pnpm check`

Run: `pnpm build:dsh-annotation`

Expected: both exit 0.

- [ ] **Step 4: Run dual parser audit on the real exported file**

Run `pnpm audit:golden-cad-export -- <exported.dxf>`. The script must parse with `acad-ts`, print the contract diff, and exit non-zero on any style/entity mismatch. On the development Mac, additionally run `ezdxf.audit()` and require 0 errors/0 fixes.

- [ ] **Step 5: Perform CAD visual acceptance**

Open the golden target and generated DXF in the same CAD application, run Zoom Extents, and compare color, arrow, text, extension-line, angle, radius, datum, GD&T and hatch rendering. Record screenshots in the task output; do not use the DSH canvas as evidence.
