# DSH Two-Command Plugin Installation Design

## Goal

Make a VectorAI release compatible with the exact tested DSH runtime while preserving the user contract that installation consists of exactly two ordered Bundle commands: Space first, Annotation second. The Bundles must use current DSH extension and service contracts without modifying DSH source or relying on user-created source links.

The immediate work prepares the repository for the current upstream gap: DSH `0.1.3-alpha.1` exists as a source tag, while several runtime packages used by third-party Bundles are not yet available from npm. The repository must report that gap explicitly and refuse an unusable release. It must not hide the gap by shipping old DSH implementations or by adding undocumented installation steps.

## Existing Promises to Preserve

- Users install only `@newwe/vectorai-plugin-dsh-space` and then `@newwe/vectorai-plugin-dsh-annotation`.
- Platform vectorizer packages are internal optional dependencies of Space; users never install them directly and never install Python.
- The annotation Bundle continues to depend on the Space Bundle and reuse its single Drawing repository and workspace authority.
- Drawing import, editing, partitioning, automatic annotation, persistence, export, and session restoration keep their current behavior.
- DSH owns the Agent, LLM, Session, attachment, Typert Remote, Cordis, question, and client-slot lifecycles.
- VectorAI does not patch DSH source or generated DSH runtime output.
- Only the explicit release workflow may publish packages.

## Approved Change

### 1. Classify DSH package edges by runtime use

Each public Bundle will distinguish three kinds of DSH package edge:

1. **Shared identity:** `@deepseek-ai/cordis` remains a required peer dependency so the Host and every plugin use one Cordis context.
2. **Runtime imports owned by the Bundle:** DSH packages that appear as runtime imports in a built Host Bundle become exact normal dependencies, matching the dependency model used by DSH's own Bundles.
3. **Host-provided contracts:** packages used only as erased TypeScript types or as services/client rows injected by DSH remain exact optional peers. They are not installed merely to satisfy type imports.

For the current build outputs, the runtime dependency sets are:

- Space: `@deepseek-ai/dsh-llm`, `@deepseek-ai/dsh-tools`, `@deepseek-ai/dsh-typert-protocol`.
- Annotation: `@deepseek-ai/dsh-session`, `@deepseek-ai/dsh-tools`, `@deepseek-ai/dsh-typert-protocol`.

The dependency inventory lives in `release/dsh-plugins.json` beside the authoritative DSH version. Package manifests are release outputs of that inventory rather than a second manually maintained version map.

### 2. Keep development usable while upstream npm is incomplete

Ordinary workspace development continues to use the separately recorded registry SDK baseline until exact DSH packages are published. The exact source-built DSH runtime remains the compatibility authority and is checked by the source-runtime checker and live recognition probe.

The missing registry packages are not treated as optional capability. A release-readiness preflight queries every required DSH runtime and build package at the exact configured DSH version. If any package is unavailable, it fails before publishing any VectorAI runtime or Bundle and prints the missing package names.

There is no fallback to an older DSH API, vendored DSH implementation, system Python, manual profile link, or Launcher-only dependency injection.

### 3. Materialize release dependencies only in the release preparation path

Release version preparation writes the exact normal DSH runtime dependencies into the two public Bundle manifests and removes those names from their peer dependency metadata. It also updates private build-input packages to the exact registry SDK version once that version is available.

This materialization occurs only through the repository's existing release workflow. It does not make ordinary development installation depend on unpublished npm packages, and it never publishes an individual package manually.

The packed-manifest audit rejects:

- a runtime import whose package is absent from normal dependencies;
- a declared DSH runtime dependency that is not imported by the corresponding built Host Bundle;
- a DSH dependency whose version differs from the authoritative runtime version;
- a runtime dependency duplicated as an optional peer;
- a non-peer or optional Cordis dependency;
- local `file:`, `link:`, `workspace:`, or absolute-path dependency specifications.

### 4. Verify dependency identity and composition

After dependency materialization, an isolated profile acceptance boots the exact tested DSH runtime and installs only the two local Bundle tarballs in order. No preliminary package additions or profile edits are allowed.

The acceptance verifies:

- both Bundle patches load;
- one Cordis context owns the Space and Annotation services;
- Typert Remote calls cross Host and Client successfully;
- the DSH Agent/LLM/Session/Subagent versions match the configured runtime;
- Space selects and executes the current platform vectorizer package;
- a production-shaped drawing completes import and automatic annotation;
- persisted state reopens in the same session.

Runtime observations use versions, resolved package identities, service availability, and digests only. They do not record prompts, credentials, uploaded content, or user session data.

### 5. Put the acceptance before Bundle publication

The release sequence becomes:

1. Require a clean worktree and validate the requested release version.
2. Verify all exact DSH registry dependencies are available.
3. Prepare and audit all five platform vectorizer artifacts and both Bundle tarballs.
4. Publish the five platform runtimes and wait for npm integrity metadata.
5. Install the two unpublished local Bundle tarballs into a fresh exact-DSH profile using only the two Bundle commands; their platform runtime resolves from the packages published in step 4.
6. Publish Space, wait for integrity, then publish Annotation and wait for integrity.
7. Repeat the fresh-profile two-command test against the public package versions and write the release receipt.

If step 5 fails, no Bundle has been published. Already published immutable platform runtime packages may remain unused; the receipt records them so a retry uses the same version and never republishes them.

## Alternatives Rejected

### Bundle DSH internals into VectorAI

This would work around missing npm packages but could create duplicate Cordis, Typert, Session, or tool identities and would make VectorAI responsible for shipping pieces of DSH. It conflicts with the goal of following upstream interfaces.

### Add source links in the Launcher

This makes the VectorAI Launcher work but leaves ordinary DSH plugin installation broken and introduces an undocumented third installation mechanism. The Launcher may install the exact DSH runtime, but it must not repair an invalid Bundle dependency graph.

### Keep every DSH edge as an optional peer

Publication alone does not guarantee that optional peers are installed or resolvable from an external Bundle. The current isolated-profile result already demonstrates this failure mode.

## Testing Strategy

Implementation follows test-first development:

1. Manifest tests fail until the authoritative runtime-dependency inventory exists.
2. Dependency classifier tests fail on missing, extra, duplicated, or wrong-version runtime dependencies.
3. Registry preflight tests cover complete availability, one missing package, network failure, and no publication side effects.
4. Release-order tests prove preflight occurs before all publication and local two-command acceptance occurs after runtimes but before Bundles.
5. Existing full tests, TypeScript checks, both Bundle builds, freshness checks, source-runtime validation, Launcher tests, deterministic annotation E2Es, CAD export, and the real vectorizer integration remain green.
6. The final real acceptance uses a fresh ignored `DSH_HOME` and exactly two Bundle installation commands.

## Completion Boundary

The repository adaptation is complete when the dependency inventory, release materialization, audits, and pre-publication acceptance ordering are implemented and tested. While upstream packages remain absent, the real registry preflight is expected to stop with a precise upstream-unavailable result; this is correct behavior, not a successful install.

The full product promise is complete only after the required upstream packages exist and the fresh-profile two-command acceptance passes without manual links. Publication remains a separate action requiring an explicit user request.
