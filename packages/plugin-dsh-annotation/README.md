# @vectorai/plugin-dsh-annotation

Apache-2.0 licensed Engineering Annotation plugin shell for DeepSeek Harness
`0.1.0-rc.8`.

This second-layer bundle depends on `@vectorai/plugin-dsh-space`. The first
layer remains the only Drawing repository, canvas outlet, and commit authority.
The annotation Host owns the professional workflow projection, while the
annotation Client contributes a sticky session-scoped workspace through the
public Drawing Surface registry.

From the VectorAI repository root, build and install both layers for local
development:

```bash
pnpm build:dsh-space
pnpm build:dsh-annotation
dsh plugin --profile web add --ignore-workspace-root-check \
  ./packages/plugin-dsh-space \
  ./packages/plugin-dsh-space-host \
  ./packages/plugin-dsh-space-client \
  ./packages/plugin-dsh-annotation \
  ./packages/plugin-dsh-annotation-host \
  ./packages/plugin-dsh-annotation-client
```

The plugin exposes intent-routed `drawing_partition_start`, read-only
`drawing_partition_status`, and post-confirmation `drawing_auto_annotate` tools.
Document-only uploads remain ordinary DSH conversation attachments; they do not
claim the engineering workspace or start partitioning without an explicit user
request.
