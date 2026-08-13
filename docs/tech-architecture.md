# VectorAI 技术架构：模型主导的二维空间 Agent

> 状态：当前权威技术文档
>
> 更新日期：2026-08-13
>
> 主设计：[`模型主导的二维空间 Agent 与 Human Decision Gate`](./superpowers/specs/2026-08-12-model-led-drawing-agent-and-human-decision-gate-design.md)
>
> 二维世界模型：[`二维世界模型与空间动作编译器`](./superpowers/specs/2026-08-13-2d-world-model-and-spatial-action-compiler-design.md)
>
> 基础内核：[`图纸即代码系统架构`](./superpowers/specs/2026-08-08-drawing-as-code-system-architecture-design.md)

## 1. 架构目标

VectorAI 建立 AI 视觉语义与真实二维空间之间的可操作映射，让模型像编辑代码一样读取、修改、验证和维护图纸。

核心分工是：

- 模型负责需要视觉与智力的决策：理解语义对象、选择 Grounding 候选、设计目标、选择空间动作、观察 Preview 和修正。
- Drawing Core 负责唯一真相：协议、坐标、事务、revision、Patch、回滚和持久化。
- 2D World Model 负责派生现实：坐标框架、交点、原子边、半边、面、来源参数区间、语义支持映射和可查询局部 Slice。
- Spatial Action Compiler 负责把模型的语义目标、保持接口和动作选择编译成精确 Drawing Commands。
- Tool Gateway 负责执行能力：渲染、空间查询、拓扑、CV、拟合、重绘、矢量化和诊断。
- Model Provider Adapter 负责把统一内部动作映射到供应商支持的 Function Calling、JSON Schema 或 JSON Mode。
- Human Interaction Service 负责需要用户权限、事实或价值判断的暂停与恢复。

系统不再用低层 Harness 预先固定模型只能修改的选区或编辑方法。任何查询或感知结果都是证据，只有 Drawing Transaction 能改变正式状态。

## 2. 三种真相

| 类型 | 载体 | 职责 |
|---|---|---|
| 来源真相 | Source Artifact：DXF、PDF、图片及内容哈希 | 证明数据来源 |
| 编辑真相 | Canonical Drawing IR：`VectorAI-Drawing` v1.0 | 正式查询、修改、验证和版本化 |
| 派生表示 | SVG、PNG、Mask、DXF、PDF | 显示、模型观察和交付 |

派生表示不能直接覆盖 Drawing IR。图片、Mask、模型回复和工具结果都是 revision-bound Evidence，不是第四份图纸状态。

## 3. 总体架构

```mermaid
flowchart LR
    SRC["DXF / PDF / Image"] --> INGEST["Importer / Perception"]
    INGEST --> CORE["Canonical Drawing IR"]

    USER["目标 / 追加反馈"] --> RUNTIME["Agent Runtime"]
    CORE --> WMC["2D World Model Compiler"]
    FRAME["Coordinate Frame Graph"] --> WMC
    WMC --> WORLD["Revision-bound World Model"]
    CORE --> TOOLS["Drawing Tool Gateway"]
    RENDER --> GROUND["Grounding + Pick/Coverage Map"]
    WORLD --> GROUND
    GROUND --> RUNTIME
    WORLD --> RUNTIME
    RUNTIME <--> PROVIDER["Model Provider Adapter"]
    PROVIDER <--> MODEL["Replaceable Spatial Model"]
    MODEL <--> TOOLS
    MODEL --> ACTION["Spatial Action IR"]
    WORLD --> PROPOSAL["Action Proposals / Feasibility"]
    PROPOSAL --> MODEL
    ACTION --> COMPILER["Spatial Action Compiler"]

    TOOLS --> RENDER["Shared Render / Observation"]
    TOOLS --> QUERY["IR / Geometry / Topology Query"]
    TOOLS --> CV["CV / Fit / Vectorize"]
    TOOLS --> REDRAW["Local Redraw"]
    COMPILER --> TX["Transaction Preview"]
    TOOLS --> TX

    TX --> HARD["Hard Validator"]
    TX --> DIAG["Diagnostic Evaluators"]
    HARD --> MODEL
    DIAG --> MODEL

    MODEL -->|"need permission / fact / choice"| HUMAN["Human Decision Gate"]
    HUMAN --> MODEL
    MODEL -->|"commit preview"| COMMIT["Atomic Commit + Inverse Patch"]
    COMMIT --> REPO["Local Repository"]
    REPO --> AUDIT["Audit / Replay / Regression"]
    COMMIT --> CORE
```

依赖规则：

- `src/drawing/` 不依赖 AI、React、Express、网络或文件系统。
- 前端与后端共用 SceneCompiler 和 Drawing IR 类型，不维护第二套几何解释。
- Importer、CV、模型和生成服务只产生 Evidence、Tool Result 或 Drawing Commands。
- Tool Gateway 不保存独立 Drawing Document，所有调用显式绑定 drawing ID 与 revision。
- 所有写入最终汇入 Drawing Application 的事务路径。
- 模型选择语义候选、稳定空间引用、设计目标和空间动作；程序将选择解析为精确 SourceSpan、原子边、接口、约束解与 Drawing Commands。
- 二维世界模型只按 revision 从 Drawing IR 派生，不保存可独立写入的第二份图纸状态。
- 语义对象和 Drawing 图元是多对多关系；区域相交、Mask 相交或几何 incidence 均不自动构成共同修改授权。

## 4. Canonical Drawing IR

```text
DrawingDocument
├── geometry      Point / Line / Ray / XLine / Circle / Arc / Ellipse / Polyline / Spline
├── annotations   Text / Dimension
├── relations     topology / constraint / association / semantic
├── features      CompoundPath 与持久语义 Feature
├── coordinateFrames / unitSystem
└── metadata
```

关键约束：

- 模型拥有四个 plane 的完整合法编辑能力。
- 坐标变化可以保留稳定 ID；类型变化或自由重建可以 delete + create。
- Lineage 记录来源关系，不强求旧节点与新节点一对一或同类型。
- `source → page → view → document` 仿射变换完整保存。
- 拓扑关系来自共享端点、显式关系或带证据的容差连接；视觉交叉不自动等于连接。
- candidate 节点保留置信度和 Evidence，UI 统一标红。

## 5. 来源重建与自适应矢量化

### 5.1 导入策略

- DXF：确定性读取原生对象；暂不编辑的层、块和填充可作为 opaque records 保留。
- PDF：优先提取矢量路径和文字；不可靠页面转入栅格感知。
- 图片：页级分析 → 清洁线稿 → 骨架/轮廓链 → 解析图元与 Polyline/Spline 兜底 → Drawing Transaction。

### 5.2 增量重建

每条来源链在进入事务前完成拟合：候选有效时生成 Line、Circle、Arc、Ellipse；候选无效时保留 Polyline/Spline。多 piece 链生成多个节点，并以 CompoundPath 和 lineage 保存逻辑整体。

链按最终节点数装入小批次。每批独立 Preview、校验、Commit、检查点和审计，因此复杂图纸能逐步显示、暂停和恢复。自动尺寸标注在几何重建后批量生成，不影响几何事务策略。

### 5.3 尺度无关算法

使用全图对角线 `D`、稳健线宽 `W` 与当前链弧长 `L` 生成无量纲阈值。分段由父子拟合误差、最短相对跨度和复杂度惩罚共同决定。算法记录实际尺度、候选点、拟合误差和接受理由，不使用样例坐标或固定像素特例。

来源重建的确定性算法不限制后续 Agent。模型可以通过工具重新拆分、合并、拟合或重建导入结果。

## 6. Agent Runtime

### 6.1 EditEpisode

每个任务建立 EditEpisode：

- 原始目标与追加指令。
- 当前 drawing/revision、工具证据和 Preview。
- 模型动作、诊断、Human Decision 和 Commit 历史。
- 预算、暂停点、恢复状态和最终结果。

### 6.2 模型动作

```ts
type DrawingAgentAction =
  | { type: 'tool'; toolCallId: string; tool: DrawingToolName; input: unknown }
  | { type: 'request-human-decision'; request: HumanDecisionDraft }
  | { type: 'commit'; previewHandle: string; summary: string; confidence?: number }
  | { type: 'finish'; summary: string };
```

模型每轮选择一个动作。Runtime 验证动作协议、执行工具、记录 receipt，并把结构化输出送回模型。固定 Workflow DAG 可以作为展示摘要，但不能限制下一工具或修改方式。

### 6.3 服务预算

Runtime 只施加通用资源限制：

- 单次图像像素和响应大小。
- 工具、模型与 Episode 总超时。
- 只读工具并发与写事务串行。
- 重复候选检测和最大无进展轮数。

预算不包含人体、建筑、动作、左右、图元类别或测试图规则。

### 6.4 模型选择策略

- 空间理解、工具规划、Drawing IR 事务生成和最终视觉验收从第一轮起使用可配置的高级空间模型。
- 调用超时或传输失败时，重试同一高级模型，不降级到轻量模型；单次调用默认上限 120 秒，Episode 默认上限 15 分钟。
- 快速前置检查由确定性的 Schema、revision、引用、数值和几何诊断完成，不让轻量模型对空间候选作权威判断。
- 模型仍是可替换边界；服务配置通过 `COMPANY_AI_SPATIAL_MODEL` 选择实现，任务 UI 不显示供应商或模型名称，审计内部保留实际配置。

### 6.5 上下文工作集协议

模型不再在每一轮重复接收整图节点清单、全部历史工具输出和多张互相竞争的截图。每个 revision 建立三层上下文：

1. **Global Drawing Map**：单位、整图 bounds、四个 plane 的计数、几何类型计数、多尺度重叠区域统计和拓扑组件摘要。区域是检索范围，不是互斥切块，也不拥有图元。
2. **Local Working Set**：本轮目标、显式 relation/feature 邻接和空间邻域中的精确 Drawing IR 节点。每个节点标明 `target | relation | neighbor`；相交或邻近只提供上下文，不构成共同修改授权。
3. **Evidence Ledger**：revision-bound 工具 receipt、诊断、用户决定和未被 Working Set 覆盖的精确节点事实。重复 `render_drawing` media、`views` 与 `vectorDigest` 不进入文本上下文。

既有节点在模型上下文中使用 `g1`、`g2` 等 revision-bound 短别名。模型可以直接用别名查询、更新或删除；Runtime 只在工具协议中的节点/图元/关系/Feature ID 字段里解析别名，不改写 source ID、crop handle、preview handle 或用户正文。revision 改变后，别名和旧节点事实全部失效并重建。

空间索引采用重叠式多尺度区域树。跨区域 Line、Circle、Arc、Polyline 或 Spline 始终保留为同一个完整节点，可以被多个区域查询命中；系统不会为了上下文分区而切碎图元。

### 6.6 二维世界模型与局部 Slice

每个 revision 从 Drawing IR 派生三张互相映射的只读图：

1. **Authoring Graph**：几何、标注、关系、Feature、约束和 lineage 的正式图视图。
2. **Planar Arrangement Graph**：解析交点、原子边、半边、面和 `source node + parameter range` 历史映射。
3. **Semantic Grounding Graph**：当前 Episode 的语义对象候选、视觉证据、支持集、排除项和接口。

模型只读取与当前决策相关的 `WorldModelSlice`：Semantic Entity candidates、局部 Arrangement、相关关系/约束、Evidence Delta 和 continuation。事实包中的 Anchor、Interface、Path、Measurement 继续保留，但它们变成 World Model 的查询投影，而不是与拓扑平行的另一套核心状态。

一个语义对象可覆盖多个节点和局部 SourceSpan，一个节点也可以同时支持多个语义对象。Arrangement 中的分析切分不会自动改写 Drawing IR；只有事务真正编辑局部参数区间时才物化必要切分。几何相交 `incidence` 和设计连接 `connected` 分开保存，路径工具不会默认穿越所有视觉交叉点。

所有 Slice 绑定 drawing、revision、frame、compiler version 和 input digest。模型协议不接受无空间标签的裸坐标；视觉提示使用 `observationId + normalized point` 或候选 ID，Runtime 确定性解析坐标和 SourceSpan，Prompt 不展示仿射公式或要求模型处理 Y 轴翻转。

### 6.7 无坐标优先 Grounding

SceneCompiler 为同一 revision 和视口产生正常 Observation 与隐藏 Pick Map。Pick Map 提供最上层像素命中，CoverageIndex 使用向量空间索引返回同一区域内全部 Node、SourceSpan/HalfEdge 候选、层叠顺序、距离和覆盖比例。

Grounding Service 根据用户表达、Observation、Pick/Coverage 结果和 World Model 生成有限 `SemanticEntityHypothesis`。模型选择、合并或排除候选，并观察后端生成的真实 Overlay，不再默认手绘完整目标轮廓和锚点。已有向量图纸优先走这一确定性链；Source 栅格、现有 IR 中不存在的新对象或自由重绘时，才调用 SAM 2 或等价的 `RasterGroundingProvider`。

Mask 只提供像素证据和生成输入，必须映射回 World Model 支持集；Mask/包围盒相交不能直接成为删除或修改列表。

### 6.8 单视觉工作集与 Source 按需读取

单次模型动作至多携带一个视觉坐标系：`preview > target-detail > user-viewport > overview`。新的相关图像替换旧图，不累计发送。

- 带附件任务首次用 Source 图建立语境，成功后不在每轮重复传输。
- 模型可调用 `create_observation_region` 与 `inspect_source_crop` 请求重叠局部区域；crop 以 media handle 存储，Runtime 在下一轮读取并作为唯一图像交给模型。
- 同一 crop 成功消费一次；传输失败重试时仍保留，避免无状态模型丢失视觉输入。
- Source、Drawing observation 和 Preview 均带明确坐标契约；模型只选择绑定 Observation 的归一化引用，程序负责解析为 Drawing 世界坐标。

### 6.9 模型调用可观测性

每次空间模型调用产生审计安全的 `model_call` 事件：transport、角色、attempt、revision、序列化请求字节数、图像数量/解码字节/像素数、HTTP 状态、TTFB、总耗时、provider request/completion ID、finish reason，以及 input/output/cached/reasoning tokens（供应商提供时）。

HTTP 200 但正文为空不再统一报成“网络失败”。例如 `finish_reason=length` 且 reasoning tokens 用尽会标记为 `MODEL_EMPTY_CONTENT`，从而区分传输、排队、响应格式和推理预算问题。审计不保存密钥、base64 图片或隐藏思维链。

只需要当前 revision 的 Application 读取使用按 drawing ID 定位的 `getCurrentCheckpoint` 快路径；`summarize/query/inspect/render/observe`、当前 Preview/Execute 前检查以及测量/拓扑只读工具不加载完整 Commit 列表，也不预加载本地其他图纸。只有显式 `open`、旧 revision 所有权判断、Commit 审计保存和回放读取本图历史。新写入快照带 SHA-256 内容摘要：校验通过后可以跳过每次全量事务回放；无摘要的旧快照仍首次完整回放，下次写入自动升级。MVP 仍使用单文件快照；长期的 checkpoint + append-only Commit log 属于后续存储演进，不影响当前 Drawing IR/事务协议。

### 6.10 上下文预算基线

上下文预算是可回归的协议，而不是对某张图的手工裁剪。`pnpm benchmark:agent-context` 读取本地最大 Drawing 快照，但不调用外部模型，它构造真实工具目录、工作集、观察图和序列化请求，输出冷读、空间索引、渲染、Prompt、Schema 和图像指标。

2026-08-13 基线：16.7 MB 快照、3,133 条 Commit、96 个四平面节点；冷读当前 checkpoint 57.8 ms，空间索引 11.2 ms，观察渲染 29.6 ms。单轮 Drawing 上下文 29.0 KB，只包含 21 个工作集节点和 1 张 1,048,576 像素观察图。21 个工具的 strict response schema 仍有另外 30.6 KB 固定开销。

下一阶段门禁：Dynamic Context 不超过 16 KB；Active Tool Schema 不超过 8 KB 且默认不超过 4 个完整契约；System Prompt、Dynamic Context 与 Active Tool Schema 总文本不超过 32 KB。完整工具契约由模型通过紧凑 Capability Catalog 按需加载，不能通过删除目标精确事实或限制模型可用工具来达成预算。

### 6.11 Model Provider Adapter

Runtime 使用统一内部动作，不直接假设供应商支持 OpenAI strict JSON Schema。每个 endpoint/model 配置并审计以下能力：vision、native tools、strict JSON Schema、JSON Object、最大输出 tokens 与 thinking 参数。

传输按能力选择：

1. Native Function Calling，只发送当前 Active Tool Contracts。
2. 小型顶层动作 JSON Schema，不嵌入全部工具输入分支。
3. JSON Object + 本地严格校验。

供应商明确拒绝某种协议时立即使用已配置的兼容策略，不重复三次相同 400。输入上下文、输出预算和 reasoning budget 分别记录；`finish_reason=length` 不归类为普通网络失败。

## 7. Drawing Tool Gateway

所有工具版本化并返回统一 receipt：tool call ID、输入摘要、revision before/after、结果句柄、受影响节点、状态、耗时和可重试建议。

模型常驻上下文只读取工具名、版本、访问属性和一句话能力摘要。完整输入契约通过 Runtime 内建的顶层动作 `load-tool-contracts` 按模型选择进入 Active Tool Contracts；该固定小协议不依赖待加载工具契约，且任何工具都可加载，因此不构成固定 Workflow。

### 7.1 观察与查询工具

- `render_drawing`
- `ground_semantic_entities`
- `refine_semantic_entity`
- `inspect_world_slice`
- `query_nodes`
- `inspect_nodes`
- `measure_geometry`

渲染支持 overview、viewport、focus、before、preview 和 diff，并保存 world/image 坐标映射。前端画布与后端模型观察使用同一 SceneCompiler。Grounding 工具返回多个语义候选、多对多支持映射、排除项和 Overlay handle，不返回唯一写授权。

### 7.2 拓扑与路径工具

- `build_world_slice`
- `trace_paths`
- `find_interfaces`
- `inspect_fragment`
- `materialize_split`

World Model 按 `revision + frame + compiler version + input digest` 缓存；复杂图纸按重叠 Slice 和相关组件惰性编译。拓扑工具返回 SourceSpan、HalfEdge、Face、路径、接口、局部间隙、参数范围和不确定性，不生成 `authorizationId`，也不决定最终哪些内容可写。

模型可以反复调用工具：从视觉种子追踪路径、发现断裂、扩大查询、提供第二接口、选择另一候选或放弃拓扑并重绘。

### 7.3 CV、拟合与生成工具

- `inspect_source_overview`
- `create_observation_region`
- `inspect_source_crop`
- `extract_cv_evidence`
- `read_cv_evidence`
- `fit_geometry`
- `redraw_region`
- `vectorize_image`
- `recompute_annotations`

`redraw_region` 只接收模型给出的编辑意图、Drawing IR 世界坐标轮廓和可选关注节点。服务端用统一 SceneCompiler 渲染无标注的当前图纸，生成像素 Mask、保护 Mask 和 image/world 反变换，再调用可替换的生图模型。Mask 仅指导图像生成与候选矢量化，不是 Drawing Transaction 写权限；模型仍可在看到候选后决定实际删除、更新和新增哪些 IR 节点。

生成失败作为工具错误返回模型，不自动回退旋转、缩放或其他几何模板。

### 7.4 事务与评估工具

- `propose_spatial_actions`
- `compile_spatial_action`
- `preview_transaction`
- `evaluate_preview`
- `commit_preview`

`propose_spatial_actions` 返回 transform、deform、solve、replace、redraw 或 hybrid 候选的目标支持集、必要切分、固定接口、影响范围、可行性和代价。模型可以选择候选、组合能力或绕过候选直接调用 `preview_transaction`。

`compile_spatial_action` 把模型选择的目标、设计目标、保持接口与方法编译为 Drawing Commands、lineage、pre/postconditions 和 Preview recipe。Preview handle 绑定 base revision、Commands digest、resulting document、Patch、inverse Patch、诊断和过期条件。Commit 只能引用仍有效的 Preview。

## 8. Drawing Transaction 与 Lineage

模型默认先表达 `SpatialActionProgram`，其中包含 target refs、设计目标、保持 refs/interfaces/constraints、倾向方法和 Evidence。`SpatialActionCompiler` 使用可替换后端把它降低为 Drawing Commands：

- rigid transform
- parametric split
- constraint solve
- replacement
- redraw
- hybrid
- raw transaction

该层类似编译器而不是权限系统：它负责精确坐标、必要切分、约束解和影响分析，但模型仍可组合能力或直接给出合法底层事务。

现有 Drawing Commands 继续作为唯一修改语言：

```text
geometry.create / update / delete
annotation.create / update / delete
relation.create / update / delete
feature.create / update / delete
history.revert
```

扩展事务 metadata：

```ts
interface DrawingTransactionMetadata {
  episodeId: string;
  summary: string;
  confidence?: number;
  lineage?: DrawingLineageRecord[];
  decisionGrantRefs?: string[];
  diagnosticAcknowledgements?: string[];
}
```

`DrawingLineageRecord` 支持 `preserve | transform | split | merge | replace | redraw`，保存 source IDs、result IDs、可选参数范围和 Evidence refs。

事务在临时 DrawingDocument 上执行。Commit 使用 compare-and-swap revision 并原子保存 Patch 与 inverse Patch。失败不改变正式状态；Undo 恢复四个 plane 和本次事务解除的约束。

## 9. Validation 与 Diagnostic 分离

### 9.1 Hard Validator

只拒绝：

- Drawing IR Schema、数值和基本几何非法。
- 节点、关系、标注或 Feature 引用不存在。
- Command precondition/postcondition 失败。
- base revision 或 Preview handle 过期。
- Human Interaction Policy 要求的 Permission Grant 缺失或不匹配。

### 9.2 Diagnostic Evaluators

返回结构化 warning 或 decision-required：

- 新增/消失端点、闭合度和拓扑连接变化。
- 局部间隙、分支、相交和尺寸变化。
- 约束影响与标注冲突。
- before/preview/diff 视觉目标达成度。
- 区域外差异、样式、尺度和伪影。

Diagnostic 不修改候选，不强制缩小选区、不强制切换编辑方式。模型根据结果继续修正、解释接受或请求用户决定。

## 10. 标注、约束与 Interaction Policy

### 10.1 标注

标注永远不参与编辑模式路由。几何变化后，模型可调用工具重算、重关联、标记 conflict 或删除重建标注。引用悬空属于 IR error；尺寸变化或布局不佳属于 diagnostic。

### 10.2 约束

约束是 Drawing IR 语义而不是编辑锁：

- 模型读取约束并判断保持、重新满足、更新或解除。
- constraint `violated/unsolved` 返回影响报告，不强制 geometric-edit。
- 删除、放宽或改变已有用户约束含义需要候选级 Permission Grant。

### 10.3 用户锁定与外部副作用

用户锁定内容、约束解除、覆盖导出文件或未来其他敏感动作均由通用 Interaction Policy 判定是否需要 Human Decision。Policy 只判断是否缺少权限，不替模型判断几何方案。

## 11. Human Decision Gate

### 11.1 请求类型

- `grant-permission`
- `choose-option`
- `confirm-intent`
- `provide-context`
- `accept-risk`

请求包含 Episode、revision、候选与事务摘要、问题、理由、选项、推荐项、影响资源和可选 Preview。

### 11.2 Permission Grant

授权绑定：

- request ID 与 Episode。
- 当前 revision。
- transaction digest。
- 精确 action 和 resource IDs。
- `allow` 或 `deny`。
- `candidate` scope。

任一绑定变化后 Grant 失效。MVP 不提供永久允许。

### 11.3 状态与恢复

新增 `waiting_for_user` run 状态。请求产生后在安全点暂停，保存 Episode、Preview 和证据；用户选择、拒绝或补充指令后继续同一上下文。用户主动追加指令与决策响应统一记录为 Human Interaction Event，但保持不同事件类型。

以下情况不得弹窗：普通断线、方向错误、样式漂移、拟合失败、可撤销的常规修改、自动标注重算或模型能通过工具消除的歧义。

## 12. Preview、提交与反馈 Loop

```text
模型调用 preview_transaction
→ Hard Validator
→ Diagnostic Evaluators
→ 后端统一渲染 before/preview/diff
→ UI 显示当前 Preview 与真实工具 Overlay
→ 模型读取全部事实
→ 修正 / 请求用户决定 / commit_preview
```

模型默认自动提交自己认可的候选。仍有 warning 时可以：

- 继续修正。
- 请求用户接受风险。
- 以 candidate 状态提交并标红。

同一失败候选连续重复时，Runtime 返回 digest 相同和诊断未改善的事实，模型必须换工具、换策略、升级模型或结束，不能静默重复。

## 13. UI 与实时事件

- 任务状态贴近输入框，只显示最新真实动作。
- 运行时发送按钮切换为暂停；用户可以追加新指令。
- 画布显示语义候选、Pick/Coverage 解析结果、SourceSpan/HalfEdge 描边、保持接口、排除结构、Mask、动作影响和当前 Preview。
- Overlay 只表示模型观察/考虑过程，不表示硬写授权。
- `waiting_for_user` 显示紧凑 Decision Card：问题、影响、选项、推荐和 Preview 入口。
- UI 不显示模型名称或隐藏推理；只显示动作摘要、工具结果和修改理由。
- 活跃任务最长约 25 秒产生真实进度或 heartbeat；30 秒不是正确性的硬超时。

UI 事件来自真实后端动作，例如 `grounding.candidates-created`、`grounding.supports-resolved`、`world-model.slice-expanded`、`action.proposals-created`、`action.compile-started`、`action.preview-ready` 和 `verification.completed`，不能由固定阶段列表伪造。

## 14. 审计、回放与上下文管理

Run Manifest 记录 Drawing/revision、Goal、Source hash、模型角色、Prompt hash、工具版本、运行配置和时间。

Episode Event Log 记录：

- 用户目标、追加指令和 Human Decision。
- 模型结构化动作与协议修复。
- 工具调用、输入摘要、结果 handle 和 receipt。
- Observation、Pick/Coverage 查询、坐标变换、拓扑/CV/矢量化证据。
- Semantic Entity candidates、支持/排除映射、World Model Slice 和 SourceSpan/HalfEdge 引用。
- Action Proposals、Spatial Action Program、Commands、lineage、Preview、diagnostics 和 commit decision。
- Permission Grant、Patch、inverse Patch 和进度耗时。

不保存 API Key、Authorization、媒体 base64 或隐藏思维链。

两种回放：

- 确定性事务回放：不调用模型，从起始 revision 得到相同 Drawing Document。
- Agent 回归回放：复用历史 Observation 与工具输出评估新模型的工具选择、事务和最终结果。

## 15. 本地持久化

MVP 本地仓库分离保存：

- Source Artifact 与 metadata。
- Drawing snapshot、Commit 和当前 revision。
- Observation/Evidence 与媒体 handle。
- EditEpisode、Tool Receipt、Human Interaction 和 Audit Event。
- Preview、Permission Grant 与 Export Fidelity Report。

核心 revision 与 Commit 使用临时文件和原子替换持久化。媒体正文不嵌入审计 JSON。

## 16. 模块目录与目标边界

- `src/drawing/`：Drawing IR、Command、Transaction、Patch、Validation、Repository、SceneCompiler。
- `src/contracts/drawing-agent.ts`：模型动作、工具 receipt、运行状态和 Human Decision 公共协议。
- `api/services/drawing-agent/`：模型 Loop、Episode、重试、状态与工具调度。
- `api/services/model-provider/`：供应商能力配置、协议适配、结构化输出与 token/thinking 策略。
- `api/services/drawing-tools/`：新的模型工具 Gateway 与版本化注册表。
- `api/services/drawing-world-model/`：Frame Graph、Arrangement、SourceSpan/HalfEdge/Face、WorldModelSlice、空间索引和增量失效；只从 Drawing IR 派生。
- `api/services/drawing-grounding/`：Pick Map、CoverageIndex、Semantic Entity candidates、支持映射、Raster Grounding Provider 和 Overlay。
- `api/services/drawing-spatial-actions/`：Action Proposal、Spatial Action IR、Compiler backends、必要切分、约束求解和 lineage。
- `api/services/drawing-spatial/`：迁移期保留的几何采样、变换、拟合、路径、接口和拆分算法；实现逐步下沉到 World Model Kernel 或 Action Compiler，不拥有写授权。
- `api/services/drawing-generation/`：局部生成工具。
- `api/services/drawing-vectorization/`：矢量化与解析图元提升工具。
- `api/services/drawing-vision/`、`drawing-render/`：共享渲染、Observation 和 Diff。
- `api/services/human-interaction/`：Decision Request、Response、Grant、暂停与恢复。
- `api/services/drawing-audit/`、`drawing-episode/`：审计、回放和上下文摘要。

## 17. 架构迁移

### 17.1 保留

- Drawing Core、Application、Repository、SceneCompiler、Patch 和 inverse Patch。
- 自适应矢量化、现有 topology/采样算法、局部拆分、几何拟合和生成服务；作为新 Kernel/Compiler 的初始实现复用。
- EditEpisode、审计、真实进度、暂停和恢复基础设施。

### 17.2 改造成工具或诊断

- `GeometryTopologyGraph` → `WorldModelCompiler + ArrangementGraph`，补齐交点、SourceSpan、HalfEdge、Face 和 curve history。
- `SemanticRegion` → `SemanticEntityHypothesis`，从单个模型轮廓改为多候选、多对多支持和显式排除项。
- Grounding Renderer → 正常 Observation + Pick Map + CoverageIndex + 候选 Overlay。
- `TopologyPartResolver` → `trace_paths/find_interfaces` 的候选查询，不收敛成唯一授权。
- `split-materializer` → `materialize_split`。
- `spatial-edit-compiler` → `SpatialActionCompiler` 多后端。
- `spatial-validator` → Hard Validator 扩展 + Diagnostic Evaluators。
- `Strategy Router` → 删除强制路由，只保留模型工具能力描述。

### 17.3 删除旧主链责任

- 删除 Deterministic Spatial Authorization 作为编辑前置条件。
- 删除 accepted SpatialSelection 才能设计的条件。
- 删除模型必须手绘完整轮廓和稀疏锚点才能进入编辑的条件。
- 删除区域/Mask/包围盒相交自动进入目标集的逻辑。
- 删除端点采样图作为最终二维拓扑真相的假设。
- 删除 Dimension/constraint 强制 geometric-edit。
- 删除 generation failure 自动回退 geometric transform。
- 删除 locality/protected/boundary/dangling 一概阻断事务的耦合。
- 删除固定 workflow DAG 限制下一工具。

MVP 不保留双主链或长期 Feature Flag。生产 `api/app.ts` 只装配 `ModelLedDrawingAgentRuntime`；旧 Runtime 源码仅供尚未迁移的历史回归测试引用，不再拥有生产入口。

## 18. 测试与发布门禁

### 18.1 核心测试

- 解析曲线交点、SourceSpan、HalfEdge、Face 和原始图元历史映射。
- incidence 与 connected 分离，路径不会默认穿越视觉交叉点。
- Arrangement 分析切分不修改 Drawing IR，物化切分只出现在事务中。
- Coordinate Frame/Observation 引用可以确定性解析。
- 四个 plane 同事务原子修改与 inverse Patch。
- replace/redraw 的 lineage。
- revision/Preview/Grant 过期。
- Hard Validator 与 Diagnostic 分级边界。
- Human Decision 请求、授权、拒绝与恢复。

### 18.2 Agent 集成测试

- 多候选 Grounding 能选择、合并和排除重叠结构，不要求模型输出精确轮廓坐标。
- Semantic Entity 与 Node/SourceSpan 支持多对多映射。
- Action Proposal 不限制模型；模型可选择候选、组合能力或直接 Preview Raw Transaction。
- Canvas 展示真实 Grounding、Action 和 Preview Event。
- 模型可自由组合查询、拓扑、渲染、重绘、矢量化和事务工具。
- 自动标注不改变编辑方法。
- 约束解除进入等待；同意后提交，拒绝后重规划。
- 用户追加指令继续同一 Episode。
- 重复无改善候选能触发换策略而非相同重试。
- 模型上下文不包含仿射公式或无空间标签的裸坐标；视觉引用可以确定性解析到世界坐标。
- Capability Catalog 保持完整能力可发现性，但每轮只加载少量 Active Tool Contracts。
- Native Tools、strict JSON Schema 和 JSON Object 供应商均投影为相同内部动作并通过本地校验。

### 18.3 真实流程基准

- `test1`：复杂来源逐步重建和自由编辑。
- `test2`：多接口语义部件可完整重建，不修改无关结构，不使用对象/动作特例。
- 工程图：精确约束影响、Human Decision 和事务回放。
- 重叠路径、自由形新增、大图分步工具调用与模型升级。

评分分开记录 Grounding Precision/Recall、Support Mapping Precision/Recall、Action Compilation Validity、Preservation Fidelity、Goal Satisfaction 和 Loop Convergence，不能用单一“成功/失败”掩盖错误层级。

发布前必须使用真实浏览器、真实 Drawing IR 与配置模型跑通，不以 Mock 通过代替端到端效果。
