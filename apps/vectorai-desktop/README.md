# VectorAI Desktop

VectorAI Desktop packages the Electron shell and its audited DSH runtime as a native macOS or Windows installer. The application stores its writable DSH home and workspace under Electron's per-user application-data directory. The packaged runtime is read-only and does not depend on a system Node.js, Python, pnpm, or an existing `~/.dsh` directory.

## Local build

Build the DSH runtime for the current machine with a dedicated, low-budget test key:

```bash
VECTORAI_TEST_API_KEY='<temporary test key>' pnpm build:desktop-runtime
```

Then create the native installer:

```bash
pnpm pack:desktop
```

The installer is written to `dist/desktop-installers`. Packaging only creates a private test artifact; it does not publish DSH packages or create a public release.

The runtime must match the native machine target: `darwin-arm64`, `darwin-x64`, or `win32-x64`. The Windows installer is per-user and does not request administrator elevation. Closed-test macOS builds are unsigned and require macOS 13 or later.

## Verification

After packaging on a native runner, run `pnpm --filter @vectorai/desktop test:packaged`. This boots the packaged executable with an isolated home and restricted `PATH`, checks that its bundled DSH page is reachable and its default model is `维构 AI`, quits through the application lifecycle, confirms the DSH process is gone, and verifies that user session data survives relaunch.

Use [`scripts/desktop-clean-machine-checklist.md`](../../scripts/desktop-clean-machine-checklist.md) for the three installer acceptance runs. A package built with a placeholder key is suitable only for packaging verification. The real model-response and engineering drawing workflow rows require a dedicated temporary key and clean test machines.
