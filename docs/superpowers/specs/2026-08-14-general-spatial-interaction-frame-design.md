# 通用二维语义定位与空间交互帧设计

## 目标

让模型对任意二维任务的“正在观察什么、选中了什么局部、哪些连接必须保留、准备怎样修改、候选结果是什么”都能精确映射到画布。实现不得依赖“手臂、头发、房间”等对象特例，也不得用包围盒相交代替语义选择。

## 已确认的产品原则

- Drawing IR 是唯一可写事实；视觉图、World Model、Grounding 和交互帧都是派生信息。
- 模型负责需要语义与视觉智力的选择；代码负责引用解析、坐标计算、几何编译、校验和审计。
- 简单任务允许直接生成 Preview，不增加强制 Grounding 模型轮次。
- 语义对象跨越图元或只占图元一部分时，使用 Node、SourceSpan、HalfEdge、Face 和 Interface 引用，不把矩形区域当成修改许可。
- 默认保持非目标内容、既有连接、轮廓连续性和原图样式；诊断提供事实，但普通警告不能替模型做决定。

## 方案比较

### 方案 A：继续使用整节点高亮

改动最小，但无法区分同一 Polyline/Spline 中的目标片段，也无法表达重叠区域中的排除项和接口。它不满足通用任务要求。

### 方案 B：后端投影统一空间交互帧（采用）

后端把 Grounding 和动作证据解析为有界的世界坐标 Stroke、Marker、Region 和 Motion Vector；前端只负责渲染。优点是语义证据、精确几何和 UI 使用同一事实来源，不会再次在浏览器猜测。现有 SVG 画布可直接承载，MVP 成本可控。

### 方案 C：增加 GPU Pick Map 与像素级 ID Buffer

它能进一步解决视觉像素到 SourceSpan/HalfEdge 的交互拾取，适合大型图纸和用户点选，但需要独立渲染通道和缓存策略。本阶段保留协议扩展位，不将其作为上线前置条件。

## 核心协议

`DrawingAgentCanvasOverlay` 增加 `spatial` 变体：

```ts
interface SpatialInteractionFrame {
  kind: 'spatial';
  phase: 'observing' | 'grounding' | 'planning' | 'previewing' | 'verifying';
  label?: string;
  strokes: Array<{
    id: string;
    ref?: string;
    nodeId?: string;
    role: 'target' | 'boundary' | 'interface' | 'context' | 'excluded' | 'before' | 'after';
    points: Vec2[];
    closed?: boolean;
    confidence?: number;
  }>;
  markers: Array<{
    id: string;
    ref?: string;
    role: 'seed' | 'interface' | 'anchor' | 'target' | 'warning';
    point: Vec2;
  }>;
  vectors: Array<{
    id: string;
    role: 'motion' | 'constraint';
    from: Vec2;
    to: Vec2;
  }>;
  truncated?: boolean;
}
```

交互帧是短生命周期证据，不是选择状态、写权限或 Drawing IR 节点。每个事件替换上一帧，避免累积历史导致画布混乱。

## 后端投影

新增纯函数投影器，接受 `WorldModelSlice`、Semantic Grounding 候选或 Drawing Preview 前后文档，生成统一交互帧。

引用解析规则：

- Node：投影该节点在当前 Slice 中的全部 SourceSpan。
- SourceSpan：直接使用其精确 samples。
- HalfEdge：使用对应 SourceSpan，并按方向正序或反序。
- Face：投影外环与洞的 HalfEdge；当前无 Face 时保持空结果，不伪造区域。
- Interface：优先使用 Vertex、Incidence 或 ConnectedEdge 的精确 point；没有单点事实时使用相关 Span 的首尾点。
- excludedSupports：使用同一引用解析器，但视觉角色固定为 `excluded`。

输出预算为最多 96 条 Stroke、96 个 Marker、96 个 Vector，每条 Stroke 最多 96 个采样点；超出时设置 `truncated=true`。预算只影响 UI 表达，不影响模型上下文、Grounding Ledger 或写入能力。

## 生产数据流

1. `ground_semantic_entities` 成功后，服务器根据选中候选的 supports、excludedSupports 和 interfaceRefs 生成 Grounding Frame。
2. `refine_semantic_entity` 生成更新后的 Frame，画布实时替换旧证据。
3. `propose_spatial_actions` 把 targetRefs、preserveRefs 和 interfaceRefs 投影为 Planning Frame。
4. `preview_transaction`、`preview_connected_transform` 和 `evaluate_preview` 根据前后 Drawing IR 生成 Preview/Verification Frame；不要求模型先调用 Grounding。
5. Model Loop Runtime 优先透传工具返回的精确 Frame；旧节点、路径和点 Overlay 仅作为兼容降级。
6. 提交、停止或任务结束时清除交互帧。

## 模型策略

系统提示只增加一条通用规则：当语义目标与图元边界不一致、存在重叠候选或需要保护接口时，先用 World Model 和 `ground_semantic_entities` 明确 supports、excludedSupports、interfaceRefs；不得通过区域相交自动授权全部图元。

工具目录始终允许模型按需建立 World Model Slice。知识已解析且目标明确时仍可走快速 Preview；复杂任务可以追加精确 Grounding，而不会被目录策略阻断。

## 视觉语言

- Target / After：单一冷青色，表示 AI 当前工作的主体。
- Boundary / Interface：克制的暖琥珀色，只表示连接和边界。
- Context / Before / Excluded：低饱和蓝灰，使用透明度和虚线区分。
- Warning：只在真实诊断时使用柔和橙红。
- SourceSpan 使用沿真实轮廓绘制的进入动画；Interface 使用双环脉冲；Motion Vector 使用短时流动虚线。
- 所有交互层 `pointer-events: none`，不污染用户选择，也不改变 Drawing IR。

## 性能与错误处理

- 投影是确定性本地计算，不新增模型调用或网络往返。
- 投影失败不得使 Agent 工具失败；运行时退回既有节点 Overlay，并记录可审计诊断。
- 不在 SSE 中发送完整 World Model，只发送有界交互帧。
- 大型图纸通过当前 Slice 与预算保持事件体积稳定。

## 验收标准

- 选中一个 Polyline/曲线局部 SourceSpan 时，只描边该局部，不高亮整节点。
- 重叠结构可同时显示目标支持与 excludedSupports，二者视觉明确且不会改变选择状态。
- interfaceRefs 显示在精确世界坐标点上。
- Preview 同时表达修改前、修改后与运动方向；任意图元类型使用同一协议。
- 简单直接 Preview 不需要额外 Grounding 调用。
- 后端单元测试、Runtime 集成测试、Canvas 静态渲染测试、TypeScript 构建与真实浏览器流程通过。

