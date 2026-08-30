# Self-contained Vectorizer Runtime and DSH Release Design

## Goal

Make the two public VectorAI DSH plugins installable on a fresh supported
computer without using the system Python installation, while turning package
and release work into a repeatable, audited workflow.

Users continue to install only these two DSH bundles:

```sh
dsh plugin --profile web add @newwe/vectorai-plugin-dsh-space
dsh plugin --profile web add @newwe/vectorai-plugin-dsh-annotation
```

The commands must be run separately so the first-layer bundle is recorded
before the second-layer bundle in the DSH profile.

## Supported platforms

The release matrix is:

- macOS arm64
- macOS x64
- Linux arm64
- Linux x64
- Windows x64

An unsupported `process.platform` and `process.arch` pair fails with a stable
`VECTORAI_VECTORIZER_PLATFORM_UNSUPPORTED` diagnostic. It never falls back to
the user's `python`, `python3`, pip environment, or virtual environment.

## Package architecture

The public DSH surface remains two Bundle packages. The space Bundle declares
exact-version optional dependencies on platform runtime packages:

- `@newwe/vectorai-vectorizer-darwin-arm64`
- `@newwe/vectorai-vectorizer-darwin-x64`
- `@newwe/vectorai-vectorizer-linux-arm64`
- `@newwe/vectorai-vectorizer-linux-x64`
- `@newwe/vectorai-vectorizer-win32-x64`

These packages are implementation dependencies, not DSH Bundles. They do not
declare `dsh.bundle`, do not enter `dsh.profile.bundles`, and are never named in
the user's install instructions. Their `os` and `cpu` manifest fields let the
package manager install only the matching runtime.

Each runtime package contains a PyInstaller one-directory application. The
application includes its own CPython interpreter and pinned copies of NumPy,
OpenCV Headless, and scikit-image. One-directory output is preferred over
one-file output because it avoids extraction into a temporary directory on
every invocation and produces clearer integrity and startup failures.

Every runtime package also contains `runtime.json` with:

- the DSH plugin release version;
- platform and architecture;
- Python version;
- locked Python dependency versions;
- vectorization pipeline version;
- executable relative path;
- SHA-256 digest of the packaged runtime tree manifest.

The runtime package version and both Bundle versions advance together. Bundle
manifests use exact versions for runtime optional dependencies and for the
annotation Bundle's peer dependency on the space Bundle.

## Runtime resolution

The space Host maps `process.platform` and `process.arch` to one runtime package
name. It resolves that package with Node package resolution, reads and validates
`runtime.json`, and launches the declared executable directly with no Python
arguments. The existing newline-delimited JSON protocol on stdin and stdout is
preserved, so vectorization behavior and cancellation semantics do not change.

Production code has no automatic system-Python fallback. Repository developers
may explicitly set `VECTORAI_VECTORIZER_RUNTIME` to an executable they built or
control. The override is opt-in, is never written to user configuration, and
must pass the same startup handshake as a packaged runtime.

The worker sends a startup response containing its protocol version, pipeline
version, Python version, and dependency versions. The Host rejects mismatched
protocol or pipeline versions before accepting image data. Missing, corrupt, or
incompatible runtimes produce stable diagnostics that identify the current
platform and expected package.

## Reproducible runtime build

Python dependencies move from version ranges to an exact lock file. The build
uses a fixed Python 3.12 patch release and a fixed PyInstaller release. CI creates
a clean virtual environment for each target, installs only the lock file, runs
the Python vectorizer tests, builds the one-directory executable, and runs a
protocol smoke test against a known image fixture.

macOS runners build arm64 and x64 separately; Linux runners build arm64 and x64
separately; Windows builds x64. Runtime artifacts are never cross-compiled. Each
job emits the runtime directory, `runtime.json`, a file digest manifest, and an
npm tarball. A release job refuses to continue unless all five target artifacts
have the same source commit, plugin version, protocol version, and pipeline
version.

## Packaging and release commands

The repository exposes three authoritative commands:

```sh
pnpm runtime:pack
pnpm pack:dsh-plugins
pnpm release:dsh-plugins -- --version <semver> --tag <dist-tag>
```

`runtime:pack` builds and verifies the current platform runtime for local
development. `pack:dsh-plugins` requires a verified matching runtime artifact,
builds the two precompiled DSH Bundles, audits their contents, and creates npm
tarballs without publishing. It never changes a version.

`release:dsh-plugins` is the only supported publication entry point. It:

1. requires a clean Git worktree and an authenticated npm account with write
   access to the `newwe` organization;
2. validates that the requested version is unused and updates every release
   manifest together;
3. builds or downloads all five verified runtime artifacts for the same commit;
4. publishes the five platform runtime packages first;
5. publishes `@newwe/vectorai-plugin-dsh-space` second;
6. publishes `@newwe/vectorai-plugin-dsh-annotation` last;
7. waits for npm publish-time scanning to make every package downloadable;
8. creates a fresh temporary DSH home, installs the two Bundle packages in two
   separate commands, and checks their profile order;
9. launches the installed packaged vectorizer against the golden smoke fixture;
10. writes a release receipt containing versions, tarball integrities, commit,
    npm tags, supported platforms, and verification results.

Publication stops at the first failure and never advances the Bundle packages
when any runtime package is unavailable. An already published npm version is
immutable; retrying resumes verification or publishes a new version rather than
overwriting it.

## Repository guidance

`docs/releasing-dsh-plugins.md` is the operator runbook. `AGENTS.md` receives a
short release rule directing future agents to that runbook whenever the user
asks to package, publish, release, or bump the DSH plugins. Scripts remain the
source of truth; the runbook documents commands and recovery, not hand-written
alternatives.

Release secrets are never read into logs, copied into artifacts, or committed.
Local publication uses the user's npm credential store. CI publication uses an
npm trusted publisher when configured, with a granular `NPM_TOKEN` as a
temporary fallback.

## Validation and acceptance criteria

- A clean supported machine with DSH installed needs only the two documented
  `dsh plugin add` commands.
- The installed profile lists the space Bundle before the annotation Bundle.
- Image vectorization succeeds when `python`, `python3`, and pip are absent from
  `PATH`.
- The worker reports the pinned embedded Python and dependency versions.
- The plugin never imports or executes a system Python interpreter.
- Package audits reject source maps, local paths, unexpected source files,
  mismatched versions, missing runtime metadata, and unlocked dependencies.
- DXF import and engineering annotation remain functional when the optional
  image-vectorization worker is not invoked.
- The release receipt is sufficient to reproduce what was published and to
  diagnose a partially completed npm release.

