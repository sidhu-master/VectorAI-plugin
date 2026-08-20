# @vectorai/plugin-dsh-space

Apache-2.0 licensed VectorAI 2D Space and Canvas bundle for DeepSeek Harness `0.1.0-rc.8`.

From the VectorAI repository root, build and install the local development bundle:

```bash
pnpm build:dsh-space
dsh plugin --profile web add --ignore-workspace-root-check \
  ./packages/plugin-dsh-space \
  ./packages/plugin-dsh-space-host \
  ./packages/plugin-dsh-space-client
```

The three local paths are required during workspace development because pnpm
does not promote the bundle's `workspace:*` dependencies into the DSH profile.
Published packages will resolve those dependencies normally.

The bundle adds the `drawing_import` and `drawing_summarize` tools plus a session-scoped “图纸” conversation view. Slice 1 accepts the latest DSH image attachment and displays its raster with a clearly marked provisional boundary. It does not add an HTTP or Express service.
