# DSH 空间查询与 Preview 基线设计

> 状态：用户已确认
>
> 日期：2026-08-20

## 1. 目标

本阶段完成第一层二维空间插件中供 DSH、网站适配器和第二层自动标注插件共同依赖的两个基础能力：

1. 基于精确 Drawing revision 的有界空间查询，包括 `worldSlice`。
2. 不直接污染正式图纸的 Preview / Commit / Discard 生命周期。

第二层插件只能依赖本设计定义的公开契约，不能直接导入第一层仓库、画布状态、DSH Session 或内部查询实现。

## 2. 架构决策

采用 **Host 权威 Preview**：

- 正式 Drawing Document 仍是唯一持久化权威状态。
- Preview 由第一层 Host 基于正式 revision 创建并保存在当前会话内。
- Client 只渲染 Host 返回的正式快照和 Preview 差异，不拥有第二份可写图纸。
- Commit 只能提交当前、未过期的 Preview；Discard 只删除候选状态。
- Preview 不跨 DSH 重启恢复。正式 Commit 才写入本地 Drawing 存储。

不采用客户端权威 Preview，因为它会让聊天工具、画布和第二层插件看到不同状态。当前也不采用只保存命令并在每次读取时重放的事件式 Preview；第一版保存完整候选文档，优先保证本地行为确定、可检查，后续可以在不改变公开契约的情况下优化内部存储。

## 3. 包和依赖边界

新增纯 TypeScript 包 `@vectorai/drawing-spatial`：

- 输入只接受 `@vectorai/drawing-core` 的 Drawing Document 和公开查询参数。
- 不依赖 React、Cordis、DSH、Node 文件系统、Express 或 VectorAI 云端。
- 输出只包含 JSON-safe、受数量限制的世界切片。

公开协议继续放在 `@vectorai/plugin-space-contracts`。DSH Host 负责 Session 绑定、revision 校验、Preview 生命周期和工具注册。DSH Client 及网站 Adapter 只通过公开服务读取投影。

依赖方向固定为：

```text
drawing-core <- drawing-spatial <- plugin-dsh-space-host
drawing-workspace <- plugin-space-contracts <- host/client/第二层插件
```

`drawing-spatial` 不反向依赖插件契约，避免把 DSH 接入概念带入可复用二维内核。

## 4. 空间查询契约

### 4.1 DrawingRef

每次查询必须显式携带：

```ts
interface DrawingRef {
  drawingId: string;
  revision: number;
}
```

Host 必须同时校验 drawing id 和 revision。旧 revision 返回稳定的 `DRAWING_STALE`，不存在图纸返回 `DRAWING_REQUIRED`。

### 4.2 第一批 Query

公开 `DrawingQueryRequest` 使用可判别联合：

- `world-slice`：读取给定世界坐标 Bounds 中的 geometry、annotation、relation 和 feature 摘要。
- `node`：按 id 读取一个节点及其所在 plane。
- `neighbors`：读取通过 relation/feature 引用相邻的节点，第一版深度限制为 1。

`world-slice` 参数包括：

```ts
{
  kind: 'world-slice';
  ref: DrawingRef;
  bounds: Bounds2D;
  planes?: Array<'geometry' | 'annotation' | 'relation' | 'feature'>;
  limit?: number;
}
```

规则：

- Bounds 必须为有限数且 `min <= max`。
- 默认 `limit = 100`，硬上限 `200`。
- 几何和标注按其世界包围盒与查询范围相交返回。
- relation/feature 在自身引用的任一已命中节点出现时返回；显式只查 relation/feature 时则按其引用节点的包围盒判断。
- 输出含 `ref`、查询 Bounds、命中节点、每个 plane 的截断前计数和 `truncated`。
- 节点顺序必须确定：先按 plane，再按 document 原始顺序。相同输入产生相同输出。

`drawing_query` 是模型工具入口，Repository/Host service 是程序化入口；二者必须调用同一实现并返回同一 ref。

## 5. 写命令扩展

现有 `node.update`、`node.delete` 和 `annotation.move-text` 保留。新增：

```ts
{
  type: 'node.create';
  plane: 'geometry' | 'annotation' | 'relation' | 'feature';
  node: DrawingNode;
}
```

Host 必须拒绝重复 id、plane 与 node 类型不匹配、非法引用和 Schema 不合法的候选结果。该命令使第二层能够通过公开协议创建尺寸标注、引线、中心线、关系和语义 feature，而不是访问第一层内部数组。

## 6. Preview 契约与生命周期

### 6.1 创建

`drawing_preview_transaction` 输入精确 `ref`、非空 commands 和可选摘要。Repository 在正式 document 的 clone 上顺序预演全部命令，并在成功后创建：

```ts
interface DrawingPreview {
  handle: string;
  baseRef: DrawingRef;
  commands: DrawingWorkspaceCommand[];
  candidate: DrawingWorkspaceSnapshot;
  diff: {
    createdNodeIds: string[];
    updatedNodeIds: string[];
    deletedNodeIds: string[];
  };
  createdAt: number;
}
```

第一版每个 Session 只有一个当前 Preview。创建新 Preview 会替换旧 Preview，并产生新的不透明 handle。

### 6.2 提交

`drawing_commit_preview` 必须携带当前 handle。提交前再次校验：

- handle 是当前会话的当前 Preview；
- 正式 DrawingRef 与 `baseRef` 完全相同；
- 候选文档仍通过 Drawing schema 和引用完整性校验。

成功后候选文档成为正式文档，正式 revision 只增加 1，写入本地存储，并清除 Preview。不会把每条 command 变成多个 revision。

### 6.3 丢弃与失效

`drawing_discard_preview` 只接受当前 handle，成功后清除 Preview，不修改正式 revision。

以下事件会使 Preview 失效：

- 正式图纸通过现有直接 Commit 被人工编辑；
- 新附件导入并替换当前 Drawing；
- Session dispose 或 DSH 重启；
- Preview 被新的 Preview 替换。

稳定错误码包括：

- `DRAWING_REQUIRED`
- `DRAWING_STALE`
- `QUERY_LIMIT_EXCEEDED`
- `INVALID_QUERY_BOUNDS`
- `PREVIEW_NOT_FOUND`
- `PREVIEW_NOT_CURRENT`
- `PREVIEW_STALE`
- `NODE_ALREADY_EXISTS`
- `NODE_NOT_FOUND`
- `INVALID_COMMAND`
- `PRECONDITION_FAILED`

## 7. Client 和画布投影

Remote 继续把正式 `DrawingWorkspaceSnapshot` 作为权威快照，并增加独立的 Preview 读取结果；不把候选伪装成正式 snapshot。

共享 Workspace Store 保存：

- `snapshot`：正式图纸；
- `preview`：可选候选 snapshot、handle 和 diff；
- `displayDocument`：存在 Preview 时用于渲染 candidate，否则渲染正式 document。

画布差异规则：

- created：候选颜色和实线高亮；
- updated：候选结果高亮，正式版本以弱化 overlay 保留对比；
- deleted：只显示弱化/删除态的正式图元；
- 非差异节点正常显示。

对象选择和属性面板读取当前 `displayDocument`，但必须明确显示“候选 Preview”，防止用户误以为已提交。

## 8. 工具表面

本阶段注册：

- `drawing_query`
- `drawing_preview_transaction`
- `drawing_commit_preview`
- `drawing_discard_preview`

现有 `drawing_import` 和 `drawing_summarize` 保持兼容。`drawing_observe`、Undo/Redo、DXF/PDF 和导出属于后续子阶段，不阻塞本设计落地。

## 9. 验证与验收

必须覆盖：

- Contract codec 对多余字段严格拒绝。
- `drawing-spatial` 对每种主要 geometry/annotation 计算范围并稳定截断。
- Query 拒绝跨 drawing、旧 revision、非法 Bounds 和超硬上限请求。
- Preview 创建不改变正式 snapshot/revision。
- Commit Preview 原子增加一个 revision并持久化。
- Discard Preview 不改变正式状态。
- 正式直接 Commit、新导入和 Session dispose 会使旧 Preview 不可提交。
- `node.create` 支持 annotation/relation/feature，并拒绝重复 id 和悬空引用。
- DSH 工具、Remote 和画布使用同一 handle/ref，Preview 差异可见。
- 全仓测试、类型检查、构建和 DSH bundle 构建通过。

## 10. 非目标

- 本阶段不实现第二层自动标注策略。
- 不建立长期分支或通用版本 DAG。
- 不把 Preview 写进正式 Drawing 存储。
- 不加入 VectorAI 云端、Express 服务或服务端渲染。
- 不让第二层直接调用 React 组件或 Repository 私有方法。
