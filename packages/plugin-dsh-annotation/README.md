# @vectorai/plugin-dsh-annotation

Apache-2.0 licensed Engineering Annotation plugin shell for DeepSeek Harness
`0.1.2-alpha.1`.

This second-layer bundle depends on `@vectorai/plugin-dsh-space`. The first
layer remains the only Drawing repository, canvas outlet, and commit authority.
The annotation Host owns the professional workflow projection, while the
annotation Client contributes a sticky session-scoped workspace through the
public Drawing Surface registry.

Install both Bundles as direct profile dependencies so DSH preserves first-layer then second-layer order:

```bash
dsh plugin --profile web add --ignore-workspace-root-check \
  @vectorai/plugin-dsh-space \
  @vectorai/plugin-dsh-annotation
```

For offline installation, replace both package names with their `.tgz` paths in the same order. Both packages are prebuilt and require no install-time build permission.

The plugin exposes intent-routed `drawing_partition_start`, read-only
`drawing_partition_status`, full-set `drawing_auto_annotate`, and single-purpose annotation tools. The automatic set currently runs opening-angle and diameter annotation before starting the editable axial dimension-chain preview. Single-purpose tools remain available when the user explicitly requests only one annotation type.
Document-only uploads remain ordinary DSH conversation attachments; they do not
claim the engineering workspace or start partitioning without an explicit user
request.
