# Grounding 可视标注与多部件语义编辑设计

> 状态：聊天方案已确认，书面规格待审阅
>
> 日期：2026-08-21
>
> 目标分支：`codex/dsh-plugin-migration`
>
> 上位架构：`docs/superpowers/specs/2026-08-21-dsh-semantic-edit-auto-safe-design.md`

## 1. 决策摘要

本阶段补齐第一层 2D Space 的两项通用能力：

1. Grounding 一旦成功，画布立即以独立于用户 Selection 的临时 Overlay 高亮精确命中的图元、连接端点和部件名称。
2. 一个语义候选可以原子地包含多个独立 Grounding，每个部件拥有自己的空间变换，最终仍只生成一个 Preview、一次视觉复核和一个可撤销 Revision。

不采用以下方案：

- 不把 Grounding 写入正式 Drawing annotation，因为它是 revision-bound 的任务态证据，不应污染 Canonical Drawing。
- 不复用 `selectedIds`，因为用户选择和 AI 识别具有不同来源、生命周期和信任边界。
- 不连续提交“先左手、再右手”，因为中途失败会留下半完成姿态，且无法进行统一视觉验收。
- 不增加“双手交叉”“抬手”等领域 opcode；多部件能力只由通用 Grounding group、平移、旋转、枢轴和连接接口组成。

## 2. 成功标准

- `drawing_ground` 成功后，下一个 DSH Client 刷新周期即可在同页画布看到命中图元的轮廓、标签和接口标记。
- 同一任务可以维护多个具名部件，例如 `left-hand`、`right-hand`；同一 `partKey` 的新 Grounding 原子替换旧 Grounding。
- 模型可以用一个结构化工具调用为多个部件分别指定变换。
- Host 校验所有 Grounding 同属当前 Session、Task、Context basis 和 Drawing revision，且部件 target node 集不重叠。
- 所有部件的命令被编译为一个 deterministic forward/inverse transaction、一个 candidate/effect digest 和一个 Preview。
- 任一部件编译、连接、保护范围或硬校验失败时，不创建或替换 Preview，正式 Drawing 保持不变。
- Preview 继续走现有 deterministic diagnostics、视觉 reviewer、auto-safe/confirmation 和 Undo 链路。
- 单部件现有工具和第二层插件继续兼容。
- 第一层源码与测试中不得出现人体部位或具体动作的特判。

## 3. Grounding Overlay

### 3.1 Host-neutral 合约

在 `@vectorai/plugin-space-contracts` 增加 strict JSON codec：

```ts
interface DrawingGroundingOverlay {
  version: 1;
  drawingRef: DrawingWorkspaceRef;
  taskId: string;
  groups: DrawingGroundingOverlayGroup[];
}

interface DrawingGroundingOverlayGroup {
  groundingId: string;
  partKey: string;
  label: string;
  colorIndex: number;
  nodeIds: string[];
  interfaces: Array<{
    interfaceId: string;
    nodeId: string;
    endpoint: 'start' | 'end';
  }>;
}
```

数组顺序由 Host 按 Grounding 创建顺序固定；`nodeIds` 和 interfaces 在各组内使用稳定排序。`label` 只用于展示，不授予权限，也不参与节点解析。

### 3.2 生命周期

`SemanticEditService` 为每个 Session 保存一份内存态 Overlay：

- 普通 legacy Grounding 未提供 `partKey` 时，使用 Host 生成的单部件 key，并替换该任务的全部旧组。
- 提供 `partKey` 时，同 key 新结果替换旧组，不同 key 累积为多部件 Overlay。
- 新 direct-user EditTask 开始时清除旧任务 Overlay。
- Drawing revision、drawingId 或 active task 改变时 Overlay 失效。
- Discard、成功 Commit、Undo、Drawing replacement 或 Session dispose 后清除。
- 创建 Preview 后 Overlay 保留，并基于当前 display candidate 的相同 node id 渲染，使标签跟随候选位置；Preview 终结时清除。

Overlay 永不进入 Drawing snapshot、commit log、candidate digest、inverse transaction 或 Undo。

### 3.3 Client 投影与渲染

DSH Host Remote 新增只读 `getGroundingOverlay(sessionId)`。DSH Client 的 workspace port 增加 `loadGroundingOverlay`；现有 running-call refresh 与手动 refresh 同时读取 snapshot、Preview 和 Overlay。

共享 `drawing-workspace` store 新增 `groundingOverlay`。加载时必须验证 Overlay 的 drawingId/revision 与正式 snapshot 一致；stale Overlay 直接丢弃。画布渲染规则：

- 命中实体使用不改变原始 fill 的彩色外轮廓和轻微 glow。
- 每组在组合 bounds 上方显示 `label`；同色接口端点显示小圆标记。
- 多组颜色来自固定、色盲友好的有限 palette，按 `colorIndex` 取模。
- Overlay `pointer-events: none`，不能阻止拖动、框选和点击空白取消选择。
- Selection 仍使用现有蓝色样式；同时出现时 Selection 视觉优先。
- ObjectList 对命中节点显示同色标记，但不会把它们写入 `selectedIds`。

Web Adapter 使用相同 workspace contract 和 React 渲染，不需要 DSH 专属 UI 分叉。

## 4. 多部件 Grounding 与编辑协议

### 4.1 Grounding 输入

`drawing_ground` 增加两个可选但受限的展示字段：

```ts
{
  partKey?: string; // stable per task, 1..64 chars
  label?: string;   // user-facing, 1..80 chars
}
```

当任务需要多个独立运动部件时，工具结果明确引导模型为每个部件分别 Ground，并保留返回的 `groundingId`。Host 仍从 `targetNodeIds` 与拓扑推导真实 interfaces；`partKey`/`label` 不参与 Grounding 正确性。

### 4.2 新的模型可见工具

新增 `drawing_preview_multi_part_transform`：

```ts
interface MultiPartTransformRequest {
  taskId: string;
  parts: Array<{
    groundingId: string;
    translation: [number, number];
    rotationRadians?: number;
    pivot?: [number, number];
  }>;
  summary: string;
}
```

约束：

- `parts` 为 2..16 项，`groundingId` 不得重复。
- `rotationRadians` 与 `pivot` 必须同时提供或同时省略。
- 省略旋转时，Host 对支持的 carrier 使用现有 minimum-deformation connected transform；普通 path group 使用零旋转 rigid translation。
- 模型工具 schema 必须完整暴露上述嵌套字段、数量、有限数值和说明，不能再使用不透明的 `program: {}` 让模型猜协议。
- 现有 `drawing_preview_grounded_transform` 保持为单部件快捷工具。
- `drawing_preview_program` 同步暴露完整模型可见 schema；它仍用于 create/delete/set-endpoint 等高级操作，不作为普通 pose 的推荐入口。

### 4.3 Host-neutral 编译输入

`@vectorai/drawing-edit-core` 新增：

```ts
interface GroundedTransformPart {
  grounding: GroundedEditTarget;
  groundingId: string;
  translation: Vec2;
  rotationRadians?: number;
  pivot?: Vec2;
}

interface MultiPartSpatialCompilationInput {
  document: DrawingDocument;
  baseRef: DrawingRef;
  objective: string;
  summary: string;
  parts: GroundedTransformPart[];
  ports: EditCorePorts;
}
```

编译器按 request 顺序在 working document 上编译各部件，但在生成命令前先完成全局预检：

1. 每个 Grounding 的 target handle、source status 和 interface scope 有效。
2. target node 集两两不相交；重叠返回 `EDIT_PART_TARGET_OVERLAP`。
3. 一个 connector endpoint 不得被两个部件以不同结果写入；冲突返回 `EDIT_PART_INTERFACE_CONFLICT`。
4. 所有 Grounding 绑定同一 canonical baseRef；不自动 rebase。
5. 实际 effect 必须是所有部件声明 scope 的并集，且 protected scope 的 canonical semantic digest 不变。

每个部件复用现有 `connected_transform` / rigid transform strategy。合并后统一去重兼容的 update，生成 inverse，应用 hard validators，并计算：

- `candidateDigest`：完整 resulting semantic document、规范化 multi-part intent、forward/inverse 和 policy-relevant immutable metadata。
- `effectDigest`：全批次 actual effect。
- `semanticRiskKey`：base、result/effect、所有 grounding scope 与 authoritative objective。

操作和点数组保持语义顺序；只有 schema 声明为集合的 node/interface id 数组才排序去重。

## 5. Preview、策略与错误处理

多部件编译只产生一份 `PreviewState`。它携带所有 Grounding refs，而不是伪造一个组合 Grounding handle。Preview 的 `groundingIds` 使用 1..16 的有界数组；为兼容现有消费者，单部件 Preview 仍可通过现有 `groundingId` 分支解码。

状态规则：

- 任一 Grounding stale/foreign/missing：`EDIT_GROUNDING_STALE`，保持当前 Preview。
- target overlap 或 endpoint conflict：blocked，不可人工覆盖。
- source candidate/provisional、普通碰撞 warning 或 reviewer uncertainty：沿现有策略进入 confirmation_required。
- 硬引用、结构、保护范围或连接后置条件失败：blocked。
- 空总 diff：写入现有 no-effect receipt，不增加 revision。
- 成功 Commit 的 history 仍是一笔 forward/inverse transaction，Undo 一次恢复全部部件。

## 6. 模型路由边界

不修改 DSH 全局提示词。行为通过第一层工具自身的 description、strict parameter schema 和每一步 `drawingWorkflow.nextTools` 引导：

- 单部件普通 pose → `drawing_ground` → `drawing_preview_grounded_transform`。
- 多个独立运动部件 → 每部件一次 `drawing_ground(partKey,label)` → `drawing_preview_multi_part_transform`。
- 非 pose 高级空间操作 → `drawing_preview_program`。

其他插件不使用 Drawing 工具时不会被此流程影响。普通图片上传不会创建 Drawing、EditTask、Overlay 或打开 workspace。

## 7. 测试门禁

### 7.1 Protocol 与 Core

- strict codec 接受合法 Overlay、多部件 request/ref，拒绝 unknown fields、重复 grounding、NaN/Infinity、超限数组和 rotation/pivot 半缺失。
- 两个不相交部件产生一个 candidate，左右/相反方向变换均正确应用。
- target node 重叠、endpoint 双写冲突、不同 base revision、foreign task 和 protected scope 变化均 fail closed。
- 任一中间部件失败时正式 document 与旧 Preview 不变。
- forward 后 inverse 恢复 canonical semantic equality；命令顺序变化必须改变 candidate digest。
- 单部件现有 compiler golden 保持不变。

### 7.2 Host 与工具

- Grounding 的 legacy replace、具名累积、同 key replacement 和 lifecycle clear。
- Remote 只能读取当前 Session/Revision 的 Overlay。
- 多部件工具暴露完整嵌套 schema，模型无需猜 `program` envelope。
- 一个 multi-part request 只创建一个 Preview；evaluate/finalize/Undo 沿用同一 operation ledger。
- stale、overlap、compile error 不替换当前 Preview。

### 7.3 Workspace 与 React

- Store 原子读取并过滤 stale Overlay；refresh 后更新，snapshot revision 变化后清除。
- Canvas 渲染分组 outline、标签和 interface marker，且不会改变 Selection。
- Overlay 不拦截 mouse/wheel/blank-click；Selection 与 Preview diff 视觉仍正确。
- ObjectList 命中标记与 Canvas group color 一致。
- 无 Drawing/无 Grounding 时不产生 Overlay DOM，也不打开 workspace。

### 7.4 集成回归

- 使用通用几何 fixture：两个 carrier 连接各自 connector，执行相反方向 multi-part transform，观察 Overlay → 单一 Preview → visual evaluation → single commit → Undo。
- 用与上例不同的三部件 fixture 验证实现没有双手/人物专用分支。
- 运行 root `pnpm test && pnpm check && pnpm build:dsh-space`。
- 重新打包安装 DSH 插件后，在真实会话验证 Grounding 标注和多部件 Preview。

## 8. 完成定义

只有在以下条件全部满足时才声明完成：

- Grounding Overlay 在 DSH 与共享 Web viewer 中可见且生命周期正确。
- 多部件原子 Preview、视觉复核、Commit 和 Undo 全链路通过。
- 模型可见工具不再依赖不透明 JSON 猜测。
- 所有新增行为均有先失败后通过的自动化测试。
- 全量测试、类型检查、构建和真实 DSH smoke test 通过。
- 源码不存在具体动作或人体部位特判。
