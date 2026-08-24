# Repository Baseline Cleanup

## Status

Approved in conversation on 2026-08-24. This specification defines the destructive but Git-recoverable cleanup that precedes the extensible 2D Space implementation.

## Purpose

VectorAI is now a plugin-first local product. The active product line consists of the host-neutral Drawing packages, the DSH 2D Space and Engineering Annotation plugins, a macOS DSH launcher, and a thin static website used to preview the shared drawing workspace.

The repository still carries the previous Express/Vercel application, an earlier browser Agent runtime, two superseded Drawing cores, duplicated UI, 82 historical design and plan documents, and 169 tests for those retired paths. All 224 current test files pass, so failure is not a useful deletion criterion. Code and tests must leave together according to product reachability.

This cleanup establishes one small baseline before the next platform expansion. Git history is the archive; the working tree does not retain `legacy/` or `archive/` copies.

## Goals

1. Remove the Express, Vercel, cloud-gateway, and old browser Agent product line completely.
2. Remove superseded Drawing, Spatial Model, UI, script, dependency, and test implementations with their owners.
3. Retain a service-free static website for local visual development of the shared Drawing Workspace.
4. Make `packages/` the only implementation source for Drawing and plugin capabilities.
5. Reduce documentation to a small, explicit set of current sources of truth.
6. Preserve the latest uncommitted plugin, Viewer, Launcher, and DSH adapter work in a safety commit before deletion.
7. Leave a buildable, tested plugin-first repository with no production `/api` dependency.

## Non-goals

This cleanup does not implement the extensible Surface Registry, controlled Canvas primitives, staged extension Preview protocol, or production Engineering Annotation UI. Those changes are specified separately in `docs/specs/extensible-2d-space-surface.md` after the current design document is moved to the canonical documentation layout.

It does not preserve a runnable version of the retired Express website, old Agent loop, Spatial Model v0.x, or Python/OpenCV service pipeline in the working tree.

It does not delete HyperFrames, video assets, posters, or other user-owned media work that is unrelated to the plugin migration.

## Evidence from the audit

At design time the repository contains:

- 46 historical implementation plans;
- 36 historical design specifications, including the newly approved Surface design;
- 23,243 lines of Markdown under `docs/`;
- 114 tests under `api/`;
- 55 tests under the old `src/` application;
- 52 tests under current packages;
- 224 passing test files and 1,381 passing tests in the root Vitest run;
- approximately 67,301 TypeScript lines under `api/`;
- approximately 21,952 TypeScript/TSX lines under `src/`;
- approximately 28,088 TypeScript/TSX lines under `packages/`.

The root TypeScript configuration still includes `api`, and the root `dev` script still launches Vite and Express together. The current website mounts the shared Viewer but also imports `AIDialog`, the old Zustand application Store, Agent and Drawing HTTP clients, and the old Drawing compatibility layer. These paths must be removed or replaced as one change; deleting their tests alone is forbidden.

## Target repository baseline

Product code after cleanup is organized as:

```text
apps/
  dsh-launcher-macos/       native launcher

packages/
  drawing-core/
  drawing-edit-core/
  drawing-edit-protocol/
  drawing-spatial/
  drawing-workspace/
  drawing-viewer-react/
  engineering-annotation/
  plugin-space-contracts/
  plugin-dsh-space-host/
  plugin-dsh-space-client/
  plugin-dsh-space/
  plugin-dsh-annotation/

src/                        thin static preview website only
scripts/                    current DSH build, verification, and E2E only
docs/                       canonical current documentation
```

No active product code imports from a retired path. The website depends only on public package exports and its browser-local Adapter.

## Safety checkpoint

The working tree contains uncommitted changes from the recent Launcher, Motion Rig, Viewer, Drawing protocol, and DSH migration work. Before any tracked deletion:

1. inspect the exact diff and untracked paths;
2. run the current root test suite, package type checks, DSH build, and Launcher tests as applicable;
3. stage only current product changes under `apps/dsh-launcher-macos`, `packages`, and current DSH scripts;
4. exclude `video-assets`, HyperFrames material, posters, generated user media, and unrelated local files;
5. create a named safety commit and record its commit ID in the cleanup handoff.

The safety commit is not a squash or reformat. It records the current recoverable state before deletion.

## Retired implementation

### Server and Agent backend

Delete the complete `api/` tree, including:

- Express and Vercel entrypoints;
- HTTP routes and compatibility endpoints;
- old Drawing Application and file repositories;
- old Agent state machines, model adapters, context ledgers, and audit stores;
- old Drawing perception, CV, feedback, generation, grounding, annotation, partition, and tool services;
- old DXF coordinators and server-side source stores;
- all API tests and fixtures owned only by that tree.

Nothing under `packages/` imports from `api/`, so current plugin packages remain dependency-inward.

### Superseded website implementation

Delete the old website-owned capability layers:

- `src/core/` Spatial Model, Patch, Harness, compiler, history, and runtime;
- `src/drawing/` compatibility Drawing implementation;
- old Agent, partition, spatial-region, and Drawing application contracts;
- HTTP Agent and Drawing clients;
- the monolithic application Zustand Store and drawing-store compatibility helpers;
- `AIDialog`, Human Decision, task presentation, partition UI, and associated components;
- old Canvas, Object List, parameter editor, status bar, renderer, and geometry utilities already replaced by `drawing-viewer-react`;
- all tests whose production owner is deleted.

Do not keep forwarding re-exports from `src/drawing` to `packages/drawing-core`. Production website code imports public workspace packages directly.

### Retired scripts

Delete scripts that import the old `api/`, `src/core`, `src/drawing`, old Agent contracts, old Python vectorization path, or retired website clients. This includes old benchmarks, test2 server flows, visual-edit flows, CV/vectorization probes, and their package scripts.

Retain current scripts that build or verify the DSH packages, patch the current DSH workspace adapter, exercise Host-owned Semantic Edit, exercise Motion Rig, or check current Remote parity.

### Dependencies and configuration

Remove dependencies used only by the retired product line, including Express, CORS, dotenv, Vercel Node types/runtime, nodemon, OpenCV.js, and dual-process development tooling. Remove other dependencies only after repository-wide import checks prove they have no remaining owner.

Update:

- `package.json` scripts and dependencies;
- `pnpm-lock.yaml`;
- root TypeScript includes and type packages;
- Vite configuration, removing `/api` proxying;
- ESLint and other configuration paths;
- dead path aliases and generated build assumptions.

The root `dev` command runs only the static website. DSH Host/Client builds retain explicit commands.

## Static preview website

The retained website is a local visual development host, not a second Agent product.

It contains:

- Vite and React entrypoints;
- one Drawing Workspace page;
- shared `DrawingWorkspace` rendering from `@vectorai/drawing-viewer-react`;
- one browser-local implementation of `DrawingWorkspacePort`;
- minimal styling and loading/error presentation;
- focused Adapter and mount tests.

It does not contain:

- chat;
- Agent tools or prompts;
- import heuristics;
- automatic vectorization or annotation;
- HTTP clients;
- `/api` requests;
- server startup;
- a duplicate Canvas or Drawing model.

### Browser-local authority

The browser Adapter owns a local preview-host repository with:

- a canonical `DrawingDocument` from `drawing-core`;
- an integer workspace revision;
- revision-aware command application;
- local Undo and Redo snapshots or compensating records;
- browser persistence with an in-memory fallback when storage is unavailable;
- complete `DrawingWorkspaceSnapshot` replacement after a successful commit;
- a subscription source for mounted workspace refresh.

The Adapter rejects stale revisions and invalid commands. It does not bypass `DrawingWorkspacePort` by mutating Viewer state.

The initial empty Drawing and any sample Drawing are local static data. The preview website does not attempt model-driven image vectorization.

## Test baseline

Tests are retained by current production ownership, not age.

### Retain

- all current package tests for Drawing Core, spatial/edit protocols, Workspace, Viewer, DSH Host/Client, contracts, and Engineering Annotation boundaries;
- DSH Remote parity and current layout compatibility tests;
- macOS Launcher tests;
- current Host-owned Semantic Edit and Motion Rig E2E scripts;
- new browser Adapter and static mount tests.

### Delete

- all tests under deleted `api/` paths;
- all tests for deleted website Store, clients, contracts, Agent UI, old Canvas, old Drawing, and old Spatial Core;
- legacy integration and benchmark scripts whose runtime owner is deleted;
- duplicate tests that protect behavior already owned by current packages and have no remaining production module.

No test file may remain if its only purpose is to test deleted code. No production module may remain without the tests needed for its current public contract.

### Default test command

The root test command runs only the active package, static website, and current verification tests. Slow explicit DSH/Launcher/E2E tiers remain separately named when they cannot be part of the fast default suite.

## Documentation baseline

After consolidation the canonical documentation set is:

```text
README.md
docs/
  README.md
  prd.md
  tech-architecture.md
  development.md
  specs/
    extensible-2d-space-surface.md
    repository-baseline-cleanup.md
```

### Deletions

- delete all 46 historical implementation plans;
- delete every historical design specification except the active Surface design and this cleanup specification;
- delete `docs/dsh-plugin-migration.md` after merging current facts;
- delete `docs/agent-execution-flow.md` after merging current flows;
- delete the three `docs/architecture/*` documents after consolidation;
- replace `docs/dsh-local-development.md` with `docs/development.md`;
- remove every link to a deleted document.

### Canonical responsibilities

`README.md` answers what the project is, how to run the common commands, which packages matter, and where the canonical documents live.

`docs/README.md` is the documentation index and declares each document's authority.

`docs/prd.md` describes product goals, the two-layer plugin model, user flows, supported scope, non-goals, and acceptance. It contains no implementation chronology.

`docs/tech-architecture.md` describes the current and target architecture, package dependencies, repository authority, 2D space and surface boundaries, DSH routing, transactions, model interaction, local persistence, security, errors, and testing. Every planned capability is labeled planned until exported and tested.

`docs/development.md` describes environment setup, builds, tests, DSH installation, Launcher behavior, local debugging, compatibility patching, and release verification.

`docs/specs/` holds only active, unfinished change specifications. When a change is complete, stable decisions move into PRD or technical architecture and the completed spec is removed. Git retains its history.

Code, public package exports, and passing contract tests are the final implementation evidence when prose becomes stale.

## Execution order

1. create and verify the current-state safety commit;
2. add the browser-local workspace Adapter under test;
3. replace the website shell with the thin preview host;
4. remove the old website modules and their tests;
5. remove `api/` and its tests;
6. remove retired scripts, dependencies, proxy, and configuration;
7. update lockfile and canonical commands;
8. consolidate and rewrite documentation;
9. run all verification tiers;
10. commit the work in reviewable, purpose-specific commits.

The browser Adapter is established before old website authority is deleted so the static site never depends on a half-removed Store.

## Commit structure

The intended commits are:

1. current plugin migration safety checkpoint;
2. service-free static website Adapter and shell;
3. retired server, browser Agent, duplicated Drawing code, tests, and scripts removal;
4. dependency, configuration, command, and lockfile cleanup;
5. canonical documentation consolidation.

The exact split may combine adjacent mechanical changes when one cannot build independently, but the safety checkpoint remains separate and no commit includes unrelated media assets.

## Verification

### Structural checks

- no production import references `api/`, retired `src/core`, retired `src/drawing`, old Agent clients, or old HTTP contracts;
- no Express, Vercel handler, CORS, or Vite `/api` proxy remains;
- no default script starts a server process;
- no deleted document link remains;
- package dependency-boundary tests still pass;
- only the agreed canonical documents remain.

### Automated checks

- root fast test suite;
- package TypeScript checks;
- static website type check and production build;
- DSH Space Host, Client, and Annotation build;
- DSH Remote parity and current adapter patch tests;
- Host-owned Semantic Edit E2E;
- Motion Rig E2E;
- macOS Launcher tests;
- documentation link validation.

### Runtime checks

- static website opens without an Express process;
- browser network inspection shows no `/api` request;
- local Drawing survives reload when storage is available;
- selection, pan, zoom, property editing, Undo, and Redo work through the shared Viewer;
- DSH starts with the built plugin artifacts and current drawing workspace remains available.

## Acceptance criteria

The cleanup is complete when:

- the repository's active product code is limited to current packages, the Launcher, the static preview site, and current build/E2E scripts;
- old Express/API, browser Agent, old Drawing, old Spatial Core, duplicated UI, and their tests are absent;
- the static site is service-free and uses only public Drawing package boundaries;
- default development and test commands do not reference retired code;
- PRD, technical architecture, development guide, README, and documentation index agree;
- the approved Surface specification is preserved under the canonical `docs/specs` path;
- all structural, automated, and runtime checks pass;
- unrelated HyperFrames and media assets remain untouched;
- Git history contains both the pre-cleanup safety checkpoint and reviewable cleanup commits.

## Recovery

No backup directory is created. Any removed implementation, test, or document is recovered from the safety checkpoint or earlier Git history using an explicit path and commit. Recovery must not use a broad destructive reset over the current working tree.
