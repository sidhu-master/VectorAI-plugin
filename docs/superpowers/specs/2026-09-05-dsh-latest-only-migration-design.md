# DSH Latest-Only Migration Design

## 1. Goal

Move VectorAI from DeepSeek Harness `0.1.2-alpha.5` to the latest official
upstream release, `dsh-v0.1.3-alpha.1` at commit
`d347e703725e7e2954a82b08cc00410c7f275c21`, and establish one repeatable
latest-only upgrade workflow for later DSH releases.

VectorAI accepts upstream breaking changes and migrates forward. It does not
keep compatibility branches, runtime fallbacks, or dual implementations for
older DSH versions. “Follow latest” means that every accepted upstream release
becomes a new exact, tested baseline; it does not mean that production silently
runs an unverified floating tag.

This migration builds and installs local artifacts only. It does not publish a
new VectorAI plugin release.

## 2. Reconstructed Product Contract

### 2.1 Behavior that must remain unchanged

- End users install exactly two ordered VectorAI DSH Bundles: Space first and
  Annotation second. DSH runtime packages remain internal implementation
  dependencies and are never presented as additional user installation steps.
- VectorAI integrates through official DSH extension points. The repository and
  Launcher do not patch DSH source code or generated runtime output.
- The current drawing workflow remains intact: open/import a drawing, display it
  in the Space surface, recognize or edit partitions, generate engineering
  annotations, drag supported annotations, set tolerances, persist the result,
  export DXF, and restore the session.
- Existing VectorAI drawing, partition, dimension-plan, annotation, and export
  schemas do not change merely because DSH changes its session persistence
  internals.
- Recognition still uses one host-owned `DshRecognitionModelAdapter`. Individual
  recognizers do not import DSH lifecycle APIs or branch on DSH versions.
- Model review remains bounded by local engineering rules. Upgrading DSH does not
  transfer coordinate generation, dimensional arithmetic, validation, grounding,
  persistence, or export authority to the model.
- No new progress pills, workflow badges, debug panels, or status summaries are
  introduced by the migration.
- User data is not deleted. Existing DSH session storage is backed up before the
  first v2 session migration, and the previous runtime remains available for
  rollback until the new end-to-end acceptance run succeeds.

### 2.2 Behavior intentionally changing

- The supported DSH runtime changes from exact `0.1.2-alpha.5` to exact
  `0.1.3-alpha.1`.
- The Space client adopts the new generic attachment draft API:
  `ConversationController.createDrafts()` and `inputActions.addAttachments()`
  replace image-only `createDraftImages()` and `addImages()` calls.
- DSH session lifecycle and persistence use upstream Session format v2 and the
  lifecycle-owned `SessionHandle` contract wherever VectorAI crosses those
  boundaries.
- Any VectorAI code that creates an agent loop adopts the asynchronous
  `agentLoop.create()` contract and session locking. Code that only consumes a
  DSH-owned loop remains unchanged after its contract is verified.
- Recognition fingerprints and runtime capability evidence are regenerated for
  the new exact DSH baseline. Evidence recorded against `0.1.2-alpha.5` is not
  treated as proof for `0.1.3-alpha.1`.
- Future upstream releases are handled by repeating the same discovery,
  migration, and acceptance workflow. Old-version branches are removed once the
  new baseline passes.

### 2.3 Explicit non-goals

- Publishing VectorAI packages.
- Supporting DSH `0.1.2-alpha.5` and `0.1.3-alpha.1` in the same build.
- Reimplementing DSH session migrations or attachment storage inside VectorAI.
- Automatically switching the user to an upstream tag that has not passed the
  VectorAI compatibility and product workflow gates.
- Refactoring engineering recognition algorithms unrelated to the DSH contract.

## 3. Upstream Facts and the Distribution Split

The current upstream release has two distinct distribution facts:

- GitHub publishes the official `dsh-v0.1.3-alpha.1` source tag and release.
- The required `@deepseek-ai/dsh-*` packages at `0.1.3-alpha.1` are not published
  to npm at the time of this design. The newest registry line available to the
  VectorAI workspace is `0.1.2-rc.1`.

The `0.1.2-alpha.5` to `0.1.2-rc.1` source comparison contains package metadata,
lockfile, and snapshot version changes but no relevant source implementation
change. The source release from `0.1.2-rc.1` to `0.1.3-alpha.1` contains the real
breaking API changes.

VectorAI must model these facts honestly instead of assigning one misleading
version string to two delivery channels:

- **Runtime baseline:** the exact GitHub tag and commit actually built and run.
- **Registry SDK baseline:** the exact npm version used only to satisfy ordinary
  workspace installation and unchanged build-time type imports while upstream
  npm publication lags.

The runtime baseline is authoritative. A build against the registry SDK alone
is insufficient evidence of compatibility. The migration therefore adds an
exact latest-source compatibility gate and a real runtime probe. When npm
publishes the matching release, the registry SDK coordinate advances to the
same version and the temporary skew disappears without changing application
logic.

## 4. One Version Manifest

`release/dsh-plugins.json` remains the single maintained source of DSH release
coordinates. Its DSH section is expanded to hold:

```json
{
  "dsh": {
    "version": "0.1.3-alpha.1",
    "tag": "dsh-v0.1.3-alpha.1",
    "commit": "d347e703725e7e2954a82b08cc00410c7f275c21",
    "registrySdkVersion": "0.1.2-rc.1",
    "profile": "web"
  }
}
```

These are not competing compatibility declarations. `version`, `tag`, and
`commit` identify one runtime artifact. `registrySdkVersion` records the
temporary upstream publication lag and is permitted to differ only while the
matching npm package is demonstrably unavailable.

A repository script reads this manifest and synchronizes or validates every
generated consumer:

- Launcher bootstrap/update constants;
- the exact DSH source installer and target runtime directory;
- public Bundle peer constraints;
- build-time DSH package dependencies;
- recognition runtime compatibility checks and probe expectations;
- release-manifest tests and maintained documentation.

No handwritten version literal in production code is authoritative. A drift
test fails with the exact stale path and expected value. Historical specs and
plans may retain their historical versions and are excluded from active drift
validation.

## 5. Dependency and Module-Identity Policy

The final Space and Annotation Bundle builds already externalize every
`@deepseek-ai/*` import. This invariant is preserved and asserted on the built
artifacts. The bundles must consume DSH packages from the running installation,
not carry a private runtime copy.

Public Bundle manifests declare the exact runtime baseline as optional peers.
They are optional for package installation because the host provides them, not
optional at runtime: startup capability validation still fails closed when any
required package, version, event, slot, or method is absent. Marking the host
peers optional also prevents pnpm from attempting to download an upstream
`0.1.3-alpha.1` package that does not yet exist on npm.

Internal VectorAI host/client source packages may use the registry SDK baseline
for unchanged compile-time imports. Changed DSH APIs are isolated behind narrow
VectorAI-owned bridge interfaces and verified against the source baseline. They
must not be accessed through `any`, unchecked property lookups, or a fallback to
the old API.

The compatibility workspace created by the upgrade tooling uses an isolated DSH
source checkout and temporary package/path mappings. It never writes absolute
`link:` or `file:` paths into committed manifests or the release lockfile.

## 6. Migration Boundaries

### 6.1 Space client attachments

All prompt image insertion flows move atomically to the generic file API. The
migration preserves:

- insertion order;
- draft ownership by the active session;
- image preview URLs and metadata;
- multi-image insertion;
- error handling when draft creation or insertion fails;
- no duplicate prompt submission.

There is no compatibility branch that calls the old methods when the new methods
are missing. Missing new methods means the runtime is incompatible.

### 6.2 Session lifecycle

The migration traces every VectorAI use of `SessionId`, session services,
conversation state, and agent-loop creation. VectorAI state keyed by DSH session
ID remains session-scoped, but ownership and disposal follow DSH's v2 lifecycle.

The first launch against a real copy of the user's DSH home performs the official
upstream migration only after a timestamped backup. VectorAI does not rewrite DSH
JSONL or SQLite data itself. A failed migration does not overwrite the backup or
delete the old runtime.

### 6.3 Recognition adapter and subagents

The adapter is re-probed for:

- `agent/request` and `llm/stream` observation ordering;
- immutable provider-neutral request capture;
- asynchronous child creation and publication;
- child session and run correlation;
- `agentOptions`, `outputSchema`, depth limit, tool filter, and persona support;
- subagent start/end lifecycle pairing;
- steering behavior introduced by the new subagent message delivery path;
- cancellation, manual pause, timeout, and disposal.

The adapter records the new exact runtime version in evaluation fingerprints.
Unmatched requests, missing events, or ambiguous child correlation continue to
fail explicitly rather than being assigned by timing.

### 6.4 Launcher

The Launcher builds the exact official tag and verifies its commit and package
version before accepting the runtime directory. It keeps versioned runtime
directories so rollback is recoverable, but starts only the manifest-selected
runtime after acceptance.

The updater may discover a newer official prerelease and report it, but it must
not activate a runtime newer than the repository's tested manifest baseline.
Adopting a later release is a repository migration, not a blind client update.

## 7. Repeatable Upgrade Workflow

Each later DSH upgrade follows one workflow:

1. Query the official upstream release/tag and resolve the immutable commit.
2. Compare release notes, public package exports, changed APIs, session format,
   plugin/profile loading, and client UI contracts against the current baseline.
3. Record the new runtime and available registry SDK coordinates in the one
   manifest.
4. Fetch the upstream source into an ignored, content-addressed cache and verify
   the tag/commit before executing it.
5. Build DSH from source in isolation using its declared package manager version.
6. Run the source-compatibility type/contract gate for all DSH imports used by
   VectorAI.
7. Implement only the required forward migration, deleting replaced old API
   paths.
8. Build Space and Annotation locally using the repository workflows.
9. Create a fresh DSH home/profile, install the two local Bundles in order, and
   run the product acceptance workflow.
10. Run the session-migration rehearsal on a copy of existing user state.
11. Switch the Launcher baseline only after every required gate passes.

If any gate fails, VectorAI remains on the previous accepted runtime while the
code migration continues. This is rollback safety, not runtime compatibility:
one checkout and one released VectorAI build still target exactly one DSH
baseline.

## 8. Verification and Acceptance

### 8.1 Static and contract gates

- The runtime tag resolves to the manifest commit and reports version
  `0.1.3-alpha.1`.
- No active source, script, package manifest, or Launcher constant retains
  `0.1.2-alpha.5` outside historical documentation and migration fixtures.
- Built Bundle JavaScript contains unresolved host imports but no bundled DSH
  implementation.
- The changed conversation attachment bridge compiles against the latest source
  contract and has no old-method fallback.
- The recognition probe passes with exact agent, LLM, session, and subagent
  packages from the built latest runtime.
- Session lifecycle ownership and cleanup tests pass under v2.

### 8.2 Real product vertical slice

Using a fresh isolated DSH home and production-shaped drawing data:

1. Start the exact new runtime through the Launcher path.
2. Install/link Space, then Annotation, and verify both layers load without DSH
   source patches or duplicate module instances.
3. Open a session and insert a DXF plus supporting document/image attachments.
4. Confirm that attachments appear in the active prompt and survive draft
   editing.
5. Run the real partition-first agent flow, answer the AI confirmation once, and
   verify the drawing reaches confirmed partition state.
6. Complete the remaining annotation flow, including dimension chains, diameter
   and opening-angle labels, datums, GD&T, tolerances, and roughness.
7. Drag representative supported annotations and verify no snap-back or stale
   state.
8. Save, export DXF, reopen the session, and verify persisted drawing and
   annotation state.
9. Run the host-owned recognition contract cases and confirm their normalized
   final domain outputs remain unchanged except for the new DSH fingerprint.

The migration is not complete when only the DSH process starts or TypeScript
compiles. It is complete only after this vertical slice succeeds in the built
plugins and the resulting drawing is inspected.

## 9. Failure and Rollback Rules

- Never modify the user's only DSH home while testing. Rehearse against a copied
  home first.
- Keep the previous versioned DSH runtime directory until the new vertical slice
  and session restoration pass.
- On session migration failure, stop the new runtime, retain diagnostics, and
  restore the copied or backed-up home. Do not hand-edit upstream session data.
- On API or capability mismatch, fail with a concrete compatibility diagnostic.
  Do not call an old DSH API, bypass request observation, or silently disable the
  affected VectorAI workflow.
- Do not publish packages as part of this migration. Publication requires a
  separate explicit user request and the repository release workflow.

## 10. Decision Summary

VectorAI will follow DSH upstream with explicit, exact migrations rather than a
long-lived compatibility layer. The official source tag is the runtime truth;
the npm coordinate is tracked separately only because upstream publication is
currently behind. One manifest, one DSH boundary, an isolated source contract
gate, and one real end-to-end drawing workflow prevent the repository, Launcher,
and running plugin from claiming different versions.
