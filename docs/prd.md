# VectorAI 产品需求文档

> 产品阶段：MVP
>
> 更新日期：2026-08-16
>
> 当前方向：模型主导的 AI 二维空间交互引擎

## 1. 产品愿景

VectorAI 要成为 AI 与二维世界之间的连接引擎，让 AI 像理解、维护和修改代码一样理解、维护和修改真实二维图纸。

用户可以提供自然语言、图片、PDF 或 CAD 数据。系统把图纸转换为统一 Drawing IR，并从中派生可查询的二维世界模型；模型结合视觉语义、真实向量数据、平面拓扑和空间动作工具自主观察、规划、修改和校验。最终结果不是不可编辑图片，而是可修改、可撤销、可审计、可回放的二维图纸事务。

模型应拥有通用语义表达能力，而不是直接承担数值求解或持有 Drawing IR 写句柄。系统不为某个对象、姿态或样例规定专用路径；模型选择任务相关部件、空间关系和保持条件，Host 负责把它们求解并编译成原子 Drawing 事务。

## 2. MVP 目标

首版需要跑通三条通用能力：

1. **来源重建**：把二维图片、栅格 PDF 或结构化 CAD 转成可编辑 Drawing IR，并在画布上逐步显示结果。
2. **模型主导编辑**：用户描述想要的结果，模型自主使用视觉与空间工具，对 Drawing IR 进行多轮增量修改。
3. **视觉反馈 Loop**：独立检查者只复核“当前 Preview 是否满足用户指令”，主模型读取 before/after、确定性诊断与检查结论后自主修正或提交，直到完成、请求用户决策或明确失败。

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
- 从视觉与 Drawing IR 中选择任务目标、语义参考、关系和需要保持的内容。
- 在确有歧义时选择、合并或排除局部 Semantic Entity candidates。
- 选择下一项空间、视觉、CV 或事务工具。
- 决定修改范围、设计结果和编辑方式。
- 解释独立检查结果并继续修正。
- 显式决定继续修订当前语义目标，还是丢弃候选。
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
- base revision、Episode、引用、Preview 或 operation 绑定已过期/不一致。
- 缺少当前动作所需的用户授权，或触碰不可覆盖的保护/deny。
- inverse、durable history、幂等 ledger 或 mandatory safety evaluator 不可用。

断线、方向、局部范围、样式、约束影响、标注冲突、视觉差异和可疑尺度形成结构化诊断，交给模型自主修正。独立检查者的 `satisfied / needs_revision / unavailable` 结论同样只是证据，不是 Commit 授权。模型认为仍可接受时，可以低置信度 candidate 状态提交并标红。

### 3.4 AI 默认自动执行并形成反馈 Loop

- 用户不选择“普通/Agent”或“精确/生成”开关。
- 模型自主观察、查询、编辑、预览、验证、修正和提交。
- 用户可以随时暂停、停止或追加指令。
- 当前 Preview 可以被后续语义候选原子替换；模型不传父 handle，Host 从当前 Episode 解析并限制最多三个候选。已提交结果通过新的纠正 Commit 修改，不重写历史。
- 生成服务或工具失败时返回模型重新规划，不自动强制切换成某个几何动作。
- 主模型与独立检查模型分别配置。检查者不参与规划、不编辑图纸、不授予权限，也不能否决主模型；其任务只有依据当前有效用户指令比较修改前后结果。

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

### 3.7 任务驱动的空间引用，Grounding 按需使用

- 对已明确的任务，模型可使用 `current_selection`、Observation 归一化点/区域、短候选 key 或语义查询选择部件；`observationId`、drawing/revision 和精确节点由 Host 当前 Episode 绑定，模型不携带这些句柄，也不手算仿射矩阵。
- 已有向量图纸由后端统一渲染 Observation；只有目标歧义、图元边界与语义边界不一致或连接证据不足时，才生成局部 Pick/Coverage 与 Semantic Entity candidates。
- Grounding 候选必须显示真实 Overlay，包括支持的 SourceSpan/原子边、保持接口和显式排除结构；模型可以观察后继续合并、排除或扩大读取范围。
- Source 栅格、现有 IR 中不存在的新对象或自由重绘时，系统可以调用 SAM 2 或其他可提示分割工具；Mask 只作为视觉 Evidence 和生成输入，必须映射回二维世界模型后才能形成编辑动作。
- 所有 Observation、坐标引用和派生 Slice 绑定 drawing、revision、frame、compiler version 和 input digest。

### 3.8 空间意图由 Host 编译，不是固定姿态 Harness

- `SpatialIntentRequest` 是 DSH 明确任务的默认入口。模型只声明 semantic parts、direction/relative position/alignment/topology/显式用户数值引用和 preservation goals。
- 首版不让模型输出 `translation`、pivot、rotation 或世界坐标。确定性求解器生成和排名通用候选，再交给现有 transaction compiler 产生 forward/inverse Commands。
- 多部件目标在一次求解、一个 Preview 和一笔 Commit 内完成；连接、保护范围、碰撞、越界与最小变形共同参与求解和校验。
- 扩展插件可以通过第一层受信任的内部 program 接口表达创建、删除或标注事务，但这些底层命令不进入 DSH 模型目录。
- 候选不构成写权限；Host 必须基于实际 before/after effect 重算 assessment。
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

- 支持文字、图片、PDF、ASCII DXF 以及文字与附件组合输入；DXF 可同时携带 UTF-8 工程数据文档。
- 结构化 CAD 优先确定性解析，不用视觉模型重新猜测已有对象。DXF 原文件按内容哈希不可变保存，嵌套 BLOCK/INSERT、未知实体和 CAXA XDATA/私有组码不得因当前 Drawing IR 不支持而丢失。
- BLOCK/INSERT 为来源结构；画布递归展开当前支持的二维图元，每个投影节点保留 source handle 与完整 INSERT 路径，导入作为一笔可撤销的系统事务提交。
- 程序只确认单位、显式图元、显式尺寸、主轴等可证明事实。配套文档与几何不一致时必须产生 conflict，缺少唯一证据时保持 candidate；不得自动猜测公差、粗糙度、形位公差、基准、配合、齿数或模数。
- 图片和栅格 PDF 使用来源分析、CV、清洁线稿、矢量化和视觉反馈 Loop。
- 清洁线稿形成 Line、Circle、Arc、Ellipse 等解析图元；无法可靠拟合的部分保留为 Polyline/Spline。
- 一条来源链可以提升为多个图元，并用 CompoundPath 保存来源顺序与逻辑整体。
- 分段和拟合阈值基于全图比例、稳健线宽和当前链尺度，不使用固定像素特例。
- 图元通过小批次 Preview/Commit 逐步出现，复杂图纸不要求一次模型调用读完。

### 4.3 模型主导 Agent Workflow

```text
创建 EditEpisode
→ 代码读取用户目标、局部 Drawing IR 事实与单一 Observation
→ 模型用 drawing_select_parts 选择语义部件
→ 模型输出紧凑 SpatialIntentRequest（关系与保持条件）
→ Host 解析 Observation/selection，确定性求解坐标并编译 Drawing Commands
→ Preview + 统一渲染 + 硬校验 + 诊断
→ 独立检查者比较 before/after，结论绑定具体 Preview
→ 主模型修订语义目标、丢弃、请求用户决策或提交
→ 原子 Commit + inverse Patch
```

模型每轮选择一个显式工具或状态动作。工具返回 revision-bound receipt 和结构化证据。固定 Planner DAG 不再限制模型下一步必须调用什么。

该流程是可用能力闭环，不是固定串行清单。明确任务以一次模型决策加一次程序编译到达首个 Preview；只有目标歧义、相关范围未解析、操作表达力不足或 Preview 出现问题时，才按需增加 Grounding、Slice 展开、底层事务或模型轮次。

### 4.4 模型空间工具

MVP 工具至少覆盖：

- 渲染 overview、viewport、focus 和 before/preview/diff。
- 查询与检查四个 Drawing IR plane。
- 测量距离、角度、范围、相交、最近点和闭合度。
- 构建全局拓扑、追踪路径、查找接口和局部间隙。
- 构建或扩展 WorldModelSlice，查询 SourceSpan、HalfEdge、Face、incidence 与 authored connection。
- 通过 Pick/Coverage Map 生成、选择、合并和排除 Semantic Entity candidates。
- 将 Observation 中的归一化提示或候选 ID 解析为世界坐标、SourceSpan、接口和节点。
- 用 `drawing_preview_spatial_intent` 把任务级定性目标与保持条件确定性求解为 Preview Transaction。
- 用 `drawing_revise_spatial_intent` 替换当前候选；坐标和内部 Preview lineage 仍由 Host 持有。
- 按需加载一个或一组工具契约，不强迫模型解析完整工具联合 Schema。
- 按参数范围拆分、合并、拟合和重建图元。
- 调用 CV、局部重绘和矢量化。
- 生成 Preview、诊断候选和原子 Commit。

拓扑工具可以返回候选路径和不确定性，但不能把结果变成模型无法修改的写权限。重绘 Mask 只限定生成输入，不限定最终 Drawing Transaction。

### 4.5 自由增量事务

受信任的 Host compiler 与扩展插件可以：

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
- 画布通过统一 Spatial Interaction Frame 动态显示语义候选、支持/排除结构、SourceSpan/HalfEdge、保持接口、拓扑路径、Mask 和动作影响；Overlay 不代表硬选区。
- Interaction Frame 必须使用后端解析的真实世界坐标：精确区分 target、context、excluded、interface、anchor、before 和 after，不允许前端根据包围盒重新猜测语义范围。
- 直接修改工具在执行前先投影当前目标、目标点与运动方向；工具返回后切换为真实 before/after 差异，让长耗时任务也有可验证的连续反馈。
- 硬校验只处理协议、引用、revision 和缺失授权。
- 诊断至少覆盖连接、端点、拓扑、约束、标注、视觉目标、局部差异、尺度和伪影。
- 诊断反馈给模型，不自动扩大、缩小或改写候选。
- 语义写入 Preview 由独立检查者复核：后端把同视口的修改前和修改后截图左右拼成一张，检查者只返回是否满足指令、理由和结构化缺陷。
- 检查结果绑定 revision、当前 Preview handle 与事务摘要，作为下一轮主模型上下文；`needs_revision` 或 `unavailable` 不清除当前 Preview，也不构成提交门禁。
- 一次用户指令默认最多复核 3 个语义候选；达到预算后不得自动提交失败候选，正式 Drawing IR 保持不变，并向用户提供重试或追加指令。该上限只约束资源，不包含任何对象或动作特判。
- 模型上下文给出准确的 `editBaseOptions`：无候选时用 `taskDrivenProgram` 创建 Preview；有候选时可用 `continueWithTaskProgram` 追加通用空间操作、用 `revise_preview` 写底层纠正，或用 `preview_transaction` 从正式 revision 舍弃重做。Runtime 校验模型声明的基线，不替模型决定。
- `revise_preview` 的纠正先在父候选上验证，再由程序合成为仍以 canonical revision 为基线的完整事务，因此新候选可以独立回放和 Commit。
- 低置信度提交以 candidate 样式标红。

### 4.10 审计、回放与回归

每个 Run/EditEpisode 至少保存：

- 用户目标、追加反馈、Drawing ID 和 base revision。
- 模型角色、配置摘要、Prompt hash 和原始结构化动作。
- 工具版本、输入摘要、receipt、Observation、Pick/Coverage 查询和真实耗时。
- `SpatialEditProgram`、逐操作解析 receipt，以及按需产生的 Semantic Entity candidates、支持/排除映射和 WorldModelSlice。
- Task-Relevant View、Slice 完整度、Grounding Evidence Delta 与被替代假设。
- Action Proposals、Commands、lineage、before/after 对照图、独立检查结果、诊断和提交理由。
- Counterfactual World Branch 的受影响范围、Arrangement/语义支持增量和查询结果。
- Human Decision 请求、响应和精确授权范围。
- Commit、前后 revision、正向/逆向 Patch 和进度事件。

事务回放不调用模型，必须重放出同一 Drawing Document。Agent 回归可以复用历史证据比较新模型行为，但不保存隐藏思维链、API Key、Authorization 或媒体 base64。

## 5. 用户体验与性能

- 深色 CAD 风格工作区，支持网格、坐标轴、缩放、平移、选择和 Preview。
- 任务状态吸附在输入框上方，只显示当前真实动作；运行时发送按钮切换为暂停/停止。
- Human Decision 以紧凑确认卡片展示问题、影响、推荐项和 Preview 入口。
- 用户看不到模型名称或隐藏推理，只看到工具动作摘要、事实结果和画布变化。
- 空间交互统一使用克制的深色 CAD 配色：青色表示当前目标/候选，琥珀表示接口/锚点，低饱和灰表示上下文/排除/修改前；不使用随机颜色区分图元。
- HTTP 受理与首个状态目标小于 1 秒；活跃任务最长约 25 秒产生进度或 heartbeat。
- 30 秒是可见反馈体验目标，不是正确性的硬超时。
- 上下文预算回归需要覆盖 100+ 节点和本地最大真实快照；单轮图像数必须 `<= 1`，精确节点数受工作集上限约束。
- 首轮没有明确选中项时只发送 Grounded Observation 与 Global Map；出现活跃目标后才编译局部 World Model。World Model 与完整 Working Set 不在同一轮重复表达。
- 普通明确任务不因审计、语义分层或整图完整性增加固定模型调用；坐标、拓扑、影响和约束由程序预计算后一次提供。
- 首轮可并行的渲染、空间索引、局部事实和确定性诊断应并行执行；语义候选仅在歧义时生成，后续只传 Evidence Delta，不重复传输完整历史。
- 清晰局部任务的首个 Preview 前目标为一次主模型决策；语义/重绘任务通常增加一次独立复核。只有主模型根据复核意见决定修正时才增加编辑轮次，并记录理由与新增证据。
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
- 已明确的向量任务可用 observation/node_anchor 引用直接生成 `SpatialEditProgram`，不要求先建立全图语义候选，也不要求模型手算精确坐标。
- 有歧义的定位可以按需选择 Grounding candidate，不要求模型生成完整轮廓坐标。
- 一个语义对象可映射多个节点/SourceSpan，一个节点可同时支持多个语义对象。
- 重叠结构不会因 Pick、Mask、包围盒或几何 incidence 自动共同修改。
- 分析切分不改变正式 Drawing IR；只有 Preview 需要时才物化局部切分。
- 模型可选择 Action Proposal，也可组合工具或直接 Preview Raw Transaction。
- 通用程序能够原子组合移动、端点重连、路径创建和删除，并保证未被操作引用的节点保持不变。
- 模型能按当前任务将多个 SourceSpan 临时组成部件，并在需要时展开或折叠语义粒度，不要求永久 Feature。
- `partial/unknown` 不会被误认为空白，也不会在与当前任务无关时拖慢局部修改。
- Preview 可查询受影响拓扑和语义支持的增量结果，不需要提交后才发现结构变化。
- 回归能证明清晰局部任务在首个 Preview 前不超过一次模型决策，且每个额外轮次都有非空升级原因和新增 Evidence Delta。
- 拓扑或视觉工具结果不会成为不可扩大的硬选区。
- 自动标注不会改变模型编辑策略。
- 模型可以删除错误拟合的图元并重建完整语义部件。
- 工具与 Preview 过程能够在画布上真实、逐步显示。
- Grounding 支持集中的局部 SourceSpan 只描边对应参数区间，不高亮整个相交图元；excluded 与 interface 在同一帧中可清晰辨认。
- 每个写工具在返回 Preview 前先产生 planning 帧，Preview 后产生 before/after 帧；动画不可拦截点选、平移或缩放。
- Interaction Frame 不进入模型文本上下文，大图投影保持有界，避免为了 UI 反馈增加模型 token 和首帧延迟。

### 6.4 编辑与反馈 Loop

- 主模型能依据 before/after、独立检查结果和诊断继续修正，而不是重复同一失败候选。
- 活跃上下文只保留当前候选契约与最新复核，旧候选仍完整保存在审计日志；连续候选用尽预算时安全结束且 canonical 零改动。
- 独立检查者不接收编辑工具，不参与提交决策；复核不通过时当前 Preview 仍可见、可修改、可由主模型确认提交。
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
- 当前默认编辑设计是 `docs/superpowers/specs/2026-08-15-task-driven-spatial-edit-program-design.md`。
- Human Decision 与模型主循环设计是 `docs/superpowers/specs/2026-08-12-model-led-drawing-agent-and-human-decision-gate-design.md`。
- 当前二维世界模型设计是 `docs/superpowers/specs/2026-08-13-2d-world-model-and-spatial-action-compiler-design.md`。
- 自适应分段、矢量化和全局拓扑算法继续作为模型工具基础能力。
- MVP 不维护错误架构的兼容入口、双主链或长期 Feature Flag；新主链通过后直接删除旧入口。
- `test1/test2`、本地审计、模型回复和生成媒体不进入 Git。
