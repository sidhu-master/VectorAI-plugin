# Official DSH Plugin Packaging Design

## Goal

Distribute VectorAI as installable private npm packages that follow DeepSeek Harness `0.1.2-alpha.1`'s official Bundle/Profile contract. A recipient with registry access must be able to install the first layer, or the first and second layers in order, without cloning the VectorAI repository, modifying DSH source, or running a package build script.

## Official Contract

DSH defines a distributable plugin as an npm Bundle package. A Bundle declares `dsh.bundle.patch` in `package.json` and ships the referenced `cordis.patch.yml`. `dsh plugin --profile <profile> add ...` forwards package installation to pnpm and then adds every directly installed Bundle to the profile's ordered `dsh.profile.bundles` list. Users and installers do not edit the profile manifest directly.

The official distribution preference for a prebuilt plugin is npm or a `pnpm pack` tarball. Git-hosted installs are not the production path because they fetch sources, require a self-contained `prepare` build, and require the user to grant pnpm `allowBuilds` permission.

## Published Packages

The complete registry surface contains exactly two DSH dual-face Bundle packages:

- `@vectorai/plugin-dsh-space`: first-layer Bundle, Host entry, Client entry, and local vectorization worker.
- `@vectorai/plugin-dsh-annotation`: second-layer Bundle, Host entry, and Client entry.

The existing Host and Client source directories remain private development units, but are not published. The release build combines each layer into its Bundle directory:

- the package root export is the Host module;
- the `./typert` export is the Host protocol module;
- the `./client` export is the browser Client bundle;
- `dsh.client` on the same manifest declares the Client injection graph;
- `dsh.bundle.patch` on the same manifest declares the profile layer.

This is the official DSH dual-face package pattern: one package owns both the Loader-mounted Host face and the discovered `./client` browser face. Internal VectorAI drawing and annotation modules are bundled into the two artifacts by Vite/Rollup and are not separately published.

## Installation and Layer Order

The first layer installs independently:

```bash
dsh plugin --profile web add @vectorai/plugin-dsh-space
```

The complete product installs both Bundles as direct profile dependencies in the required order:

```bash
dsh plugin --profile web add \
  @vectorai/plugin-dsh-space \
  @vectorai/plugin-dsh-annotation
```

The annotation Bundle declares the space Bundle as a peer compatibility requirement, but does not rely on a transitive Bundle being activated. DSH only reconciles direct profile dependencies into the Bundle layer list, so documentation and release checks require both direct packages for the complete product. The first layer precedes the second layer and remains the Drawing authority and fallback UI.

## Package Contents

Both published packages use an explicit `files` allowlist and contain only:

- prebuilt `lib/*.js`;
- generated `lib/types/**/*.d.ts` when a public type surface is required;
- Client CSS already embedded into the generated Client bundle;
- `lib/vectorai_vectorizer.py` in the first-layer Host;
- package metadata, license, and required notices.

Each package also contains `cordis.patch.yml`, its concise install README, license, and package metadata.

Packages must not contain `src/`, test files, snapshots, source maps, repository documentation, local fixtures, Git metadata, or absolute machine paths. Type declarations point to generated `lib/types`, never `src`.

Compiled JavaScript and the packaged Python worker remain inspectable by authorized recipients. The repository and TypeScript source remain private. Apache-2.0 notices are preserved because the chosen license permits distribution without a source-publication obligation while granting recipients its normal redistribution rights.

## Dependency Policy

Published manifests contain no `workspace:*`, `link:`, `file:`, or absolute path specifiers.

- The annotation Bundle declares a compatible peer on the first-layer Bundle and its install documentation requires the first layer.
- The two dual-face bundles externalize only DSH-owned runtime APIs, React, Node built-ins, and intentionally native/runtime dependencies such as `sharp` and `officeparser`.
- Externalized DSH APIs use peer dependencies compatible with the supported DSH release line so the profile reuses DSH's runtime instances instead of installing conflicting copies.
- `sharp`, `officeparser`, and other package-owned runtime libraries remain normal dependencies of the package that imports them.
- Every other `@vectorai/*` import must be eliminated from emitted runtime JavaScript by bundling.

The initial release version remains `0.1.0-alpha.0`. Both published packages share one version and are released atomically.

## Registry and Access

Packages publish under the existing `@vectorai` scope with:

```json
{
  "publishConfig": {
    "access": "restricted"
  }
}
```

The repository remains private. An authorized user configures npm authentication for `@vectorai`, then runs the official DSH install command. Registry credentials are never stored in this repository, generated tarballs, DSH settings, or the Launcher.

## Build and Release Gates

A release preparation command performs the following without publishing:

1. builds both Host/Client pairs;
2. generates declaration files into `lib/types`;
3. creates package tarballs with `pnpm pack`;
4. inspects every tarball entry against the allowlist;
5. inspects packed `package.json` files for forbidden local dependency protocols;
6. scans packed text files for local absolute paths and source-map references;
7. installs the two Bundle tarballs into an isolated temporary DSH home through `dsh plugin --profile web add`;
8. verifies `dsh --profile web --dump-config` contains the first-layer rows before the second-layer rows.

Publishing is a separate explicit command. It publishes the first layer before the second layer and stops on the first failure. It never rewrites a user's active DSH profile.

## Compatibility

The package release records the supported DSH range and validates against the current official DSH tag before publication. The native Launcher updater remains separate: it updates DSH itself, while plugin package compatibility is enforced by package metadata and the release gate. No updater or package build edits DSH source or compiled DSH artifacts.

## Failure Handling

- Missing npm authorization fails before publication or installation with the registry's normal authentication error.
- A tarball containing source, tests, local paths, forbidden dependency protocols, or missing Bundle metadata fails the release gate.
- The annotation-only installation is documented as incomplete; the release gate verifies the complete install uses both direct Bundle dependencies.
- A DSH compatibility failure blocks publication rather than attempting to patch DSH.

## Non-goals

- Creating a custom VectorAI plugin marketplace.
- Modifying DSH's plugin CLI, profile manifest, source, or compiled output.
- Publishing the repository or TypeScript source.
- Embedding npm credentials in the macOS App.
- Automatically publishing a release from a developer workstation without an explicit command.
