# VectorAI 产品需求文档

> 产品阶段：MVP
>
> 更新日期：2026-08-13
>
> 当前方向：模型主导的 AI 二维空间交互引擎

## 1. 产品愿景

VectorAI 要成为 AI 与二维世界之间的连接引擎，让 AI 像理解、维护和修改代码一样理解、维护和修改真实二维图纸。

用户可以提供自然语言、图片、PDF 或 CAD 数据。系统把图纸转换为统一 Drawing IR，并从中派生可查询的二维世界模型；模型结合视觉语义、真实向量数据、平面拓扑和空间动作工具自主观察、规划、修改和校验。最终结果不是不可编辑图片，而是可修改、可撤销、可审计、可回放的二维图纸事务。

模型应拥有 Drawing IR 的完整控制能力。系统不预先限制模型只能修改哪个选区、哪类图元或必须使用哪种算法；Harness 的职责是提供可靠工具、原子事务、版本控制、用户决策、审计和回滚。

## 2. MVP 目标

首版需要跑通三条通用能力：

1. **来源重建**：把二维图片、栅格 PDF 或结构化 CAD 转成可编辑 Drawing IR，并在画布上逐步显示结果。
2. **模型主导编辑**：用户描述想要的结果，模型自主使用视觉与空间工具，对 Drawing IR 进行多轮增量修改。
3. **视觉反馈 Loop**：模型持续观察 before、Preview 与 diff，发现问题后自主更换工具或重建局部，直到提交、请求用户决策或明确失败。

`test1`、`test2` 与后续工程图集合是回归样例，不是产品规则来源。生产代码和提示词不得针对样例坐标、对象类别、动作或语言关键词添加专用逻辑。

## 3. 核心产品原则

### 3.1 Drawing IR 是唯一编辑真相

- 前端、后端、模型工具和导出读取同一 Drawing IR。
- SVG、PNG、Mask、生成图和 DXF 是派生表示或证据，不能直接覆盖正式状态。
- AI 与用户的正式修改必须经过 Drawing Command → Preview → Commit。
- Commit 保存正向与逆向 Patch，用于 Undo、Redo、审计和回放。
- 模型可以在一个事务中新增、更新、删除或重建 `geometry`、`annotation`、`relation` 和 `feature`。

### 3.2 模型负责智能，Harness 负责执行基础设施

模型负责：

- 理解用户意图和视觉语义。
- 选择、合并或排除 Semantic Entity candidates。
- 选择目标节点、SourceSpan、HalfEdge、Face、接口或路径。
- 选择下一项空间、视觉、CV 或事务工具。
- 决定修改范围、设计结果和编辑方式。
- 解释验证结果并继续修正。
- 决定提交、请求用户决策或结束。

Harness 负责：

- Drawing IR 协议、坐标转换、渲染和工具执行。
- 从 Drawing IR 派生 Arrangement、SourceSpan、HalfEdge、Face、坐标框架和 WorldModelSlice。
- 确定性计算端点、交点、最近点、距离、角度、接口、路径、闭合度、约束解和局部坐标框架。
- 将模型选择的视觉/空间引用解析成精确世界坐标、节点和参数范围，并编译为空间动作事务。
- 按供应商能力适配 Function Calling、JSON Schema 或 JSON Mode，并统一做本地严格校验。
- revision、原子事务、Patch、回滚和持久化。
- 服务预算、实时进度、暂停和恢复。
- 用户决策状态、审计、回放和回归。

视觉包络、Mask、拓扑路径、候选节点和验证结果都是模型证据，不是不可推翻的写授权。

模型不应重复承担计算机可以快速、精确完成的二维数学。系统默认让模型做“识别语义对象、选择候选、设计、选择动作和验收”，让程序做“坐标、平面拓扑、来源区间、约束求解、动作编译、执行和校验”。二维世界模型与空间动作编译器是跨模型复用、可版本化和可回归的核心产品能力。

模型看到的语义对象不等同于 Drawing IR 图元。一个语义对象可以只覆盖一个图元的局部参数区间，一个图元也可以同时支持多个语义对象。系统通过 Semantic Entity、SourceSpan、HalfEdge、Face 和显式接口建立多对多映射，不允许区域、Mask、包围盒或几何相交自动变成共同修改授权。

语义对象的粒度取决于当前任务。同一组几何可以在一次任务中被理解为“手臂”，在另一次任务中被理解为“角色外轮廓”。这种 Task-Relevant View 默认只存在于当前 Episode，不要求用户预先整理对象，也不为追求完整本体而阻塞编辑。

### 3.3 少量硬门禁，其他问题反馈模型

系统只硬阻止：

- Drawing IR Schema、数值或引用非法。
- base revision 或 Preview 已过期。
- 缺少当前动作所需的用户授权。

断线、方向、局部范围、样式、约束影响、标注冲突、视觉差异和可疑尺度形成结构化诊断，交给模型自主修正。模型认为仍可接受时，可以低置信度 candidate 状态提交并标红。

### 3.4 AI 默认自动执行并形成反馈 Loop

- 用户不选择“普通/Agent”或“精确/生成”开关。
- 模型自主观察、查询、编辑、预览、验证、修正和提交。
- 用户可以随时暂停、停止或追加指令。
- 当前 Preview 可以被后续候选替换；已提交结果通过新的纠正 Commit 修改，不重写历史。
- 生成服务或工具失败时返回模型重新规划，不自动强制切换成某个几何动作。
- 空间理解、编辑规划和最终视觉验收默认直接使用高级空间模型；超时重试不降级。轻量模型不得作为空间结果的否决者。

### 3.5 用户只处理权限、事实和价值判断

普通几何错误不打断用户。只有继续任务需要用户权限、缺失事实或主观选择时，模型才通过统一 Human Decision Gate 请求确认。

### 3.6 大图纸按相关性读取，而不是整图塞入模型

- 模型始终知道单位、整图范围、图元类别分布、区域密度和拓扑概况，但不会每轮接收全部精确节点。
- 当前目标、连接关系和必要邻域组成可扩展的局部工作集；模型可以继续查询相邻或重叠区域，直到证据足够。
- 区域允许重合；Authoring Graph 中的完整图元 ID 跨 Slice 保持一致。Arrangement 可在 Slice 内派生局部 SourceSpan，但必须保留来源参数映射，不把分析切分写回正式 Drawing IR。
- 空间邻近和视觉相交只是上下文，不自动把其他部件纳入修改目标。
- 单轮最多发送一张当前相关图像。模型需要 Source 局部细节时主动申请 crop，成功读取后再继续推理。
- 调用时间、请求大小、图像像素、finish reason 和 token 使用必须可审计，使网络失败、排队、推理超限和协议错误可以分别回归。
- 当前图纸读取、预览、测量和拓扑分析不得为了取得最新 revision 反复加载全部 Commit 历史。
- 模型上下文不发送要求模型手算的仿射公式；视觉选点以 Observation 绑定的归一化引用进入后端确定性解析。
- 工具常驻上下文只提供紧凑能力目录，完整输入契约按模型选择懒加载，不在每轮发送全部联合 Schema。
- 每个局部工作集显式标记 `resolved | partial | unknown | stale`；系统不得把尚未读取或尚未矢量化解释为没有图元。
- 只有未解析部分与当前目标、保持接口或影响范围相交时才继续展开；无关区域不阻塞局部 Preview。

### 3.7 无坐标优先的视觉 Grounding

- 已有向量图纸由后端统一渲染正常 Observation 和隐藏 Pick/Coverage Map，模型优先选择有限的语义候选 ID，而不是手绘完整轮廓或输出精确数值坐标。
- Grounding 候选必须显示真实 Overlay，包括支持的 SourceSpan/原子边、保持接口和显式排除结构；模型可以观察后继续合并、排除或扩大读取范围。
- Source 栅格、现有 IR 中不存在的新对象或自由重绘时，系统可以调用 SAM 2 或其他可提示分割工具；Mask 只作为视觉 Evidence 和生成输入，必须映射回二维世界模型后才能形成编辑动作。
- 所有 Observation、坐标引用和派生 Slice 绑定 drawing、revision、frame、compiler version 和 input digest。

### 3.8 空间动作是可编译程序，不是固定 Harness

- 系统根据当前目标、支持集、接口和约束提出 transform、deform、solve、replace、redraw 或 hybrid 等可执行候选，并说明影响范围、必要切分、可行性和代价。
- 模型选择候选或编写新的 Spatial Action Program；程序负责把目标关系、保持接口和方法降低为 Drawing Commands。
- 动作候选不构成写权限。模型可以组合工具、调整目标，或直接提交合法的底层 Drawing Transaction。
- 平面世界模型中的分析切分不会改写正式图纸；只有 Preview 真正编辑局部参数区间时，才物化必要切分。
- Preview 同时形成一条只读反事实世界分支，模型可以查询候选事务导致的几何、拓扑、语义支持和诊断变化，再决定修正或提交。
- 反事实分支只增量重算 Patch 影响范围，不为每个候选重新读取和编译整张图纸。

## 4. MVP 功能范围

### 4.1 二维 Drawing IR

首版支持：

- 几何：Point、Line、Ray、XLine、Circle、Arc、Ellipse、Polyline、Spline。
- 标注：Text、Dimension。
- 关系：连接、相交、包含、邻接和基础工程约束协议。
- Feature：CompoundPath 与任务期或持久语义部件。
- 坐标与单位：来源、页面、视图、文档坐标变换可追踪；缺少可靠单位时使用 provisional 坐标系。

首版不做：

- 任何 3D。
- 图层、图块和填充的可编辑语义。
- DWG 原生读写。
- 覆盖全部 CAD 约束类型的完整参数化求解器；MVP 只通过统一接口接入当前动作需要的基础约束子集。
- 多人协作、远程同步和分支合并。
- 大量建筑或机械领域专用规则。

### 4.2 输入与重建

- 支持文字、图片、PDF 以及文字与附件组合输入。
- 结构化 CAD 优先确定性解析，不用视觉模型重新猜测已有对象。
- 图片和栅格 PDF 使用来源分析、CV、清洁线稿、矢量化和视觉反馈 Loop。
- 清洁线稿形成 Line、Circle、Arc、Ellipse 等解析图元；无法可靠拟合的部分保留为 Polyline/Spline。
- 一条来源链可以提升为多个图元，并用 CompoundPath 保存来源顺序与逻辑整体。
- 分段和拟合阈值基于全图比例、稳健线宽和当前链尺度，不使用固定像素特例。
- 图元通过小批次 Preview/Commit 逐步出现，复杂图纸不要求一次模型调用读完。

### 4.3 模型主导 Agent Workflow

```text
创建 EditEpisode
→ 读取用户目标、全局图纸地图、当前 WorldModelSlice 与单一视图
→ Grounding Service 生成 Semantic Entity 候选与真实 Overlay
→ 模型选择、合并或排除候选，并确定设计目标
→ 程序映射 SourceSpan、HalfEdge、Face、Interface 与相关约束
→ 程序生成带可行性和影响分析的空间动作候选
→ 模型选择/组合动作或直接提交底层事务
→ Spatial Action Compiler 编译为任意合法 Drawing IR 增量事务
→ Preview + 统一渲染 + 硬校验 + 诊断
→ 模型继续修正、请求用户决策或提交
→ 原子 Commit + inverse Patch
```

模型每轮选择一个显式工具或状态动作。工具返回 revision-bound receipt 和结构化证据。固定 Planner DAG 不再限制模型下一步必须调用什么。

该流程是可用能力闭环，不是固定串行清单。明确引用、高置信局部候选、相关范围已读取且存在可执行动作时，系统并行准备局部证据并走快速路径：模型可在一次决策中完成候选选择和动作规划，随后直接生成 Preview。只有候选歧义、相关范围未解析、动作不可行或 Preview 出现问题时，才按需增加 Grounding、Slice 展开或模型轮次。

### 4.4 模型空间工具

MVP 工具至少覆盖：

- 渲染 overview、viewport、focus 和 before/preview/diff。
- 查询与检查四个 Drawing IR plane。
- 测量距离、角度、范围、相交、最近点和闭合度。
- 构建全局拓扑、追踪路径、查找接口和局部间隙。
- 构建或扩展 WorldModelSlice，查询 SourceSpan、HalfEdge、Face、incidence 与 authored connection。
- 通过 Pick/Coverage Map 生成、选择、合并和排除 Semantic Entity candidates。
- 将 Observation 中的归一化提示或候选 ID 解析为世界坐标、SourceSpan、接口和节点。
- 生成空间动作候选，并把 Spatial Action Program 编译为 Preview Transaction。
- 按需加载一个或一组工具契约，不强迫模型解析完整工具联合 Schema。
- 按参数范围拆分、合并、拟合和重建图元。
- 调用 CV、局部重绘和矢量化。
- 生成 Preview、诊断候选和原子 Commit。

拓扑工具可以返回候选路径和不确定性，但不能把结果变成模型无法修改的写权限。重绘 Mask 只限定生成输入，不限定最终 Drawing Transaction。

### 4.5 自由增量事务

模型可以：

- 更新现有节点。
- 删除原有节点并创建不同类型或 ID 的替代节点。
- 同时维护标注、关系与 Feature。
- 通过 lineage 记录 preserve、transform、split、merge、replace 或 redraw 来源关系。
- 在 Preview 中连续迭代，不污染正式 revision。

Commit 使用 compare-and-swap revision。事务失败不改变正式图纸，Undo 恢复全部四个 plane 和被授权解除的约束。

### 4.6 几何、生成和混合编辑

这些是模型可组合的工具能力，不是系统强制路由模式：

- 解析几何数值编辑、拆分、合并、延长、裁剪和重拟合。
- 局部图像重绘后重新矢量化。
- 确定性几何与生成式编辑混合。

自动标注或工程约束不能强制模型只能使用 geometric-edit。生成服务失败也不能自动退化成旋转或缩放。

### 4.7 标注与约束

- Text 与 Dimension 使用 Drawing IR 标注节点，可整体显示或隐藏。
- 标注不能被画布选择，也不能阻止模型修改几何。
- 几何变化后，模型可以重算、重新关联、标记冲突或删除重建标注。
- 约束进入模型上下文和影响报告；模型可以保持、重新满足、更新或提议解除约束。
- 删除、放宽或改变已有用户约束的含义需要 Human Decision Grant。

### 4.8 Human Decision Gate

统一覆盖：

- `grant-permission`：解除约束、修改用户锁定内容或其他权限。
- `choose-option`：多个合理方案需要用户选择。
- `confirm-intent`：影响范围明显扩大或真实意图无法推断。
- `provide-context`：缺少单位、尺寸或事实信息。
- `accept-risk`：接受未解决风险或低置信度候选。

请求绑定当前 Episode、revision、候选事务摘要和具体资源。MVP 授权只对当前候选有效，revision、事务或资源变化后自动失效，不提供永久允许。

任务进入 `waiting_for_user` 后保留 Preview、工具证据和完整上下文。用户响应、拒绝或追加指令后继续同一 Episode，不从头执行。

### 4.9 Preview、诊断与低置信度

- 画布显示当前有效增量 Preview，不堆叠过期候选。
- 画布动态显示语义候选、支持/排除结构、SourceSpan/HalfEdge、保持接口、拓扑路径、Mask 和动作影响；Overlay 不代表硬选区。
- 硬校验只处理协议、引用、revision 和缺失授权。
- 诊断至少覆盖连接、端点、拓扑、约束、标注、视觉目标、局部差异、尺度和伪影。
- 诊断反馈给模型，不自动扩大、缩小或改写候选。
- 低置信度提交以 candidate 样式标红。

### 4.10 审计、回放与回归

每个 Run/EditEpisode 至少保存：

- 用户目标、追加反馈、Drawing ID 和 base revision。
- 模型角色、配置摘要、Prompt hash 和原始结构化动作。
- 工具版本、输入摘要、receipt、Observation、Pick/Coverage 查询和真实耗时。
- Semantic Entity candidates、支持/排除映射、WorldModelSlice 和 Spatial Action Program。
- Task-Relevant View、Slice 完整度、Grounding Evidence Delta 与被替代假设。
- Action Proposals、Commands、lineage、before/preview/diff、诊断和提交理由。
- Counterfactual World Branch 的受影响范围、Arrangement/语义支持增量和查询结果。
- Human Decision 请求、响应和精确授权范围。
- Commit、前后 revision、正向/逆向 Patch 和进度事件。

事务回放不调用模型，必须重放出同一 Drawing Document。Agent 回归可以复用历史证据比较新模型行为，但不保存隐藏思维链、API Key、Authorization 或媒体 base64。

## 5. 用户体验与性能

- 深色 CAD 风格工作区，支持网格、坐标轴、缩放、平移、选择和 Preview。
- 任务状态吸附在输入框上方，只显示当前真实动作；运行时发送按钮切换为暂停/停止。
- Human Decision 以紧凑确认卡片展示问题、影响、推荐项和 Preview 入口。
- 用户看不到模型名称或隐藏推理，只看到工具动作摘要、事实结果和画布变化。
- HTTP 受理与首个状态目标小于 1 秒；活跃任务最长约 25 秒产生进度或 heartbeat。
- 30 秒是可见反馈体验目标，不是正确性的硬超时。
- 上下文预算回归需要覆盖 100+ 节点和本地最大真实快照；单轮图像数必须 `<= 1`，精确节点数受工作集上限约束。
- 普通明确任务不因审计、语义分层或整图完整性增加固定模型调用；坐标、拓扑、影响和约束由程序预计算后一次提供。
- 首轮可并行的渲染、空间索引、候选生成和确定性诊断应并行执行；后续只传 Evidence Delta，不重复传输完整历史。
- 清晰局部任务的首个 Preview 前目标为一次模型决策；语义/重绘任务通常再使用一次 Preview 视觉验收，额外轮次必须由歧义、相关未解析边界、不可行动作或 Preview 缺陷触发并审计。
- GroundingHistory、Counterfactual 派生缓存和审计媒体异步落盘，不得位于首个 Preview 的同步关键路径；事务、revision 和必要 Evidence 元数据仍同步保证一致性。

## 6. MVP 验收标准

### 6.1 Drawing Core

- 前后端以同一 Drawing IR 渲染和编辑。
- 四个 plane 可在同一事务中原子增删改。
- Commit 可逆、可回放；revision 冲突不能静默覆盖。
- 删除重建图元时 lineage 可追踪来源，不强求旧 ID 或类型不变。

### 6.2 来源重建

- `test1` 能逐步形成可见、可编辑的 Drawing IR。
- `test2` 能稳定拟合主要解析图元，剩余轮廓以 Polyline/Spline 保留。
- 明显复合折线可按自适应阈值一对多提升，平滑轮廓和轻微噪声不会碎片化。
- 多倍率缩放输入产生一致的分段决策。

### 6.3 模型与二维空间交互

- 模型可以自由组合视觉、向量、拓扑、CV、重绘和事务工具。
- 已有向量图纸的模型定位优先选择 Grounding candidate，不要求模型生成精确轮廓坐标。
- 一个语义对象可映射多个节点/SourceSpan，一个节点可同时支持多个语义对象。
- 重叠结构不会因 Pick、Mask、包围盒或几何 incidence 自动共同修改。
- 分析切分不改变正式 Drawing IR；只有 Preview 需要时才物化局部切分。
- 模型可选择 Action Proposal，也可组合工具或直接 Preview Raw Transaction。
- 模型能按当前任务将多个 SourceSpan 临时组成部件，并在需要时展开或折叠语义粒度，不要求永久 Feature。
- `partial/unknown` 不会被误认为空白，也不会在与当前任务无关时拖慢局部修改。
- Preview 可查询受影响拓扑和语义支持的增量结果，不需要提交后才发现结构变化。
- 回归能证明清晰局部任务在首个 Preview 前不超过一次模型决策，且每个额外轮次都有非空升级原因和新增 Evidence Delta。
- 拓扑或视觉工具结果不会成为不可扩大的硬选区。
- 自动标注不会改变模型编辑策略。
- 模型可以删除错误拟合的图元并重建完整语义部件。
- 工具与 Preview 过程能够在画布上真实、逐步显示。

### 6.4 编辑与反馈 Loop

- 模型能依据 before/preview/diff 和诊断继续修正，而不是重复同一失败候选。
- 正常几何错误不询问用户；权限、事实和价值判断通过 Human Decision Gate。
- 解除约束必须获得候选级授权；用户拒绝后模型重新规划。
- 用户追加意见后继续同一 Episode，不丢失历史上下文。

### 6.5 回归基准

- `test2` 的“抬起角色自身右手”应允许完整重建双侧轮廓，保持身体连接且不依赖动作特例。
- `test1` 验证复杂来源重建与后续自由编辑。
- 工程图验证约束影响报告、用户授权和精确事务。
- 重叠路径、自由形新增和大图分步读取均有回归样例。
- 回归分别记录 Grounding、支持映射、动作编译、无关区域保持、目标达成和 Loop 收敛，不能只记录单一成功状态。

### 6.6 模型可替换性

- 模型名称不进入 UI 或 Drawing IR。
- 工具协议、事务、审计、回放和 Human Decision 不依赖模型品牌。
- 模型可按配置升级；当任务确实需要更高推理能力时明确提示用户。
- 不因当前模型失败而向生产代码加入单例动作或对象规则。

## 7. 文档与研发约束

- 当前权威技术架构是 `docs/tech-architecture.md`。
- 当前主设计是 `docs/superpowers/specs/2026-08-12-model-led-drawing-agent-and-human-decision-gate-design.md`。
- 当前二维世界模型设计是 `docs/superpowers/specs/2026-08-13-2d-world-model-and-spatial-action-compiler-design.md`。
- 自适应分段、矢量化和全局拓扑算法继续作为模型工具基础能力。
- MVP 不维护错误架构的兼容入口、双主链或长期 Feature Flag；新主链通过后直接删除旧入口。
- `test1/test2`、本地审计、模型回复和生成媒体不进入 Git。
