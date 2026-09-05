# VectorAI 技术架构

> 状态：当前架构与已批准目标的权威说明
>
> 更新日期：2026-09-04

## 1. 架构结论

VectorAI 已从“网站 + Express Agent”收缩为本地插件平台。正式图纸由宿主内的 `DrawingWorkspacePort` 实现持有；共享包只处理 Drawing、空间计算、事务和渲染。DSH 是主要生产宿主，静态网站是本地视觉开发宿主。

```text
                     host-neutral packages
Drawing Core -> Spatial/Edit -> Workspace -> React Viewer
      |                              |
      +-> public plugin contracts    +-> host Adapter
                                          |
                   +----------------------+------------------+
                   |                                         |
             DSH Host/Client                          browser-local site
                   |
          Engineering Annotation
```

没有 VectorAI Express、HTTP API、云端仓库或网站聊天链路。

## 2. 包与依赖方向

| 包 | 职责 |
|---|---|
| `drawing-core` | Canonical Drawing 文档、图元、可移植公差/基准结果、事务、验证 |
| `drawing-spatial` | 有界、宿主无关的空间查询 |
| `drawing-edit-protocol` | 模型可见的语义编辑协议 |
| `drawing-edit-core` | 语义选择后的确定性求解、forward/inverse Commands |
| `drawing-workspace` | React-free Store、Port、revision 冲突、Preview、选择与交互状态 |
| `drawing-surface-api` | 版本化 Workspace/Layer/Tool contribution 与受限 Runtime 契约 |
| `drawing-viewer-react` | 共享画布、图层、面板和交互组合 |
| `plugin-space-contracts` | DSH 与高层插件使用的严格公共协议 |
| `plugin-dsh-space-host` | 会话仓库、工具、策略、持久化与唯一提交权限 |
| `plugin-dsh-space-client` | DSH 同页画布、Remote Adapter 与资源生命周期 |
| `plugin-dsh-space` | 可安装的第一层 bundle |
| `engineering-annotation` | 宿主无关的工程标注识别、尺寸意图、公差规则边界、尺寸链与投影核心 |
| `plugin-dsh-annotation` | 第二层可安装 bundle，仅组装依赖与 Cordis patch |
| `plugin-dsh-annotation-host` | 第二层 DSH 工具与流程适配器 |
| `plugin-dsh-annotation-client` | 独立构建的第二层专业 Workspace contribution |

依赖只能朝内。Core/Workspace 不依赖 React、DSH、Node 文件系统或模型 SDK；专业插件不能 deep import 第一层 Host 仓库或 Client Store。

## 3. Drawing 权威与事务

正式值是完整 `DrawingWorkspaceSnapshot`：Drawing ID、revision、Canonical `DrawingDocument`、来源引用、能力和最近提交信息。Viewport、鼠标位置、面板、用户选择、AI 注意、拖动和候选是本地/会话投影，不是另一份 Drawing。

写入遵守：

1. 读取明确 revision 的 Snapshot；
2. 生成一组 Commands 和 expected revision；
3. 在副本上原子验证整批 Commands；
4. 成功后生成新 revision 并整体替换 Snapshot；
5. 记录 forward/inverse 或等价历史；
6. 冲突返回最新 Snapshot，不覆盖较新修改。

DSH 持久化使用版本化 durable envelope，包含当前 Drawing、追加式 Commit 记录和幂等 Operation receipt。Undo/Redo 是新 revision，不原地改写历史。浏览器预览 Adapter 使用 localStorage 和内存 fallback，语义相同但不与 DSH 同步。

## 4. DSH 集成

### Host

第一层 Host 从 DSH Agent/session 取得可信身份，持有每会话 Drawing 仓库，并通过严格 Typert/Remote 暴露有界读取和 staged 操作。Client 不能调用原始 commit。附件保留在 DSH 资源系统，Snapshot 只保存引用；Client 解析临时 URL 并在卸载时释放。

模型工具是按能力惰性激活的。普通聊天、普通图片或全新会话不会触发 Drawing 导入或 Workspace。只有明确的 `drawing_import` 或已有 Drawing 上的绘图能力才进入图纸链路。

### Client 与布局

第一层 Client 通过 DSH `0.1.3-alpha.1` 的正式 `shell.overlay` 扩展位声明 session-scoped Drawing 子槽，并按官方 Conversation 区域的真实尺寸为画布预留左侧空间。它在内部维护 `DrawingSurfaceRegistry`；专业插件注册 contribution，但注册本身不激活 UI，只有当前 session 的成功能力 claim 才参与确定性选举。没有 Drawing 时不产生 Overlay、Conversation 恢复全宽；存在 Drawing 时固定使用“图纸在中间、聊天在右侧”的横向布局。仓库不包含或运行 DSH 编译产物补丁，也不覆盖官方 root/sidebar/details 的所有权。

macOS Launcher 在无终端窗口下启动 DSH，处理 3080 端口占用、独立窗口和关闭窗口后终止所属进程组。

## 5. 语义编辑链路

```text
用户目标
 -> observe（创建 revision-bound episode）
 -> select/ground（模型给语义引用，Host 解析精确节点和接口）
 -> intent（方向、关系、保持目标；无裸世界坐标）
 -> deterministic solve + Preview
 -> diagnostics + independent assessment
 -> blocked | confirmation_required | auto_safe
 -> finalize 或 discard
 -> durable revision + Undo receipt
```

模型上下文只携带当前目标、短语义 key、有界局部事实、诊断摘要和下一步可用能力。长 handle、完整节点数组、Commands、坐标和 durable receipt 留在 Host EpisodeStore。上下文压缩不会破坏链路，也不要求模型反复抄写随机句柄。

模型负责“要改什么、希望形成什么关系”；算法负责精确节点解析、坐标、拓扑保护、连接器变形、候选排序和 inverse。多部件可以不连续；连通性不能替代语义归属。

三种展示状态必须分离：

- `selectedIds`：用户主选择；
- namespaced attention/grounding：模型当前真实分析目标；
- Preview/annotation：候选或正式业务结果。

固定参考身体、上下文邻居或诊断范围不得伪装成 AI 选中。

## 6. 临时运动铰链

Motion Rig 是第一层可选交互状态。Host 从语义选择推导 control body、connector interfaces 和 fixed anchors；浏览器拖动时本地求解，无模型/Host 往返。松开只结束一次 gesture，不结束编辑会话。控制点和连接点可继续拖动，直到确认或取消。

确认提交一次 revision；取消恢复基线；临时约束不写入 DXF。Preview 可隐藏铰链/高亮并显示应用后结果，也可叠加修改前位置。任何不兼容 revision 变化使 Rig 失效或进入明确恢复流程。

## 7. 第二层 Engineering Annotation

当前实现包含确定性标注核心、持久 session claim、DSH Host 和独立 Client 工作区。正式 Drawing 仍由第一层拥有。DXF 由第一层 `importDxf` 原子规范化为 Canonical Drawing；第二层把轴段分区作为绑定精确 Drawing revision 的独立语义资产保存，不把分区伪装成 DXF 图元。

DXF `HATCH` 在第一层以版本化参数模型保存：边界路径、直线/圆弧/椭圆/NURBS 边、填充样式、全局角度与缩放、图案线族及虚线节奏都是源数据。`@vectorai/drawing-hatch` 使用本地 Clipper2 做严格拓扑规范化，SVG 画布生成规则线族后通过复合路径裁剪。导入阶段不再把剖面线永久离散成预裁剪线段，也不会用近邻容差伪造闭合边；旧 `segments` 数据仅作为迁移期只读兼容格式。

当前 Surface 架构提供：

- `drawing-surface-api` 版本化 contribution 契约；
- 只读 Observable + 受限 Action face，不跨 bundle 传 Store/React Context；
- 受控 DrawingSurface、Canvas Layers、Interaction Controllers；
- 第一层 Client 内部的 Workspace registry 和永久 fallback；
- 第二层按成功能力路由创建、持久化 sticky session claim；
- create/replace/assess/finalize/discard extension Preview；
- 独立 Client 通过只读 annotation session projection 驱动 claim，不检查消息文本或附件。
- 第一层提供宿主内 `importDxf` 和受限 `renderObservation` 扩展接口；它们不注册全局上传路由或提示词；
- 第二层 Client 通过 `conversation.input.dock` 注册会话级文件桥。DXF 仅委托第一层原子导入并刷新画布；受支持文档通过 `stageDocuments` 在本机解析并绑定当前会话，既不提交分区也不认领第二层 Workspace。用户随后明确提出分区任务时，`drawing_partition_start` 才消费已暂存文档上下文并接管 Workspace；普通图片继续走 DSH 原生链路；
- 第二层 Host 在第一层 `importDxf` 之前完成文档格式、大小、摘要和本地文本抽取。文本类由自有解码器处理，PDF/新版 Office/OpenDocument/RTF/EPUB 由 Host-only `officeparser` 处理，OCR、CDN worker 和远端服务全部关闭；
- 第二层依次执行文档解析、轴向坐标系、外轮廓、持久台阶、证据融合；`segments` 是由几何负责的完整连续轴段，`semanticGroups.range` 保存独立的精确功能范围，`segmentIds` 只保留关联几何证据。功能范围允许跨过轴段边界、互相留空，两者不再共用同一个显示或编辑含义；
- 缺失语义只交给无工具、深度 1、严格输出 schema 的视觉 reviewer；输入是稳定轴段 ID 与本地编号图，输出不含坐标，也不要求覆盖全部轴段。Host 只接受受控类型、`confidence >= 0.8` 且逐段视觉证据完整的提议，并拒绝泛化工作区；
- 分区状态机支持 analyzing/editing/confirmed/needs-rebase，确认、取消、重新编辑、Undo/Redo 不改变 Drawing revision。确认时会持久化完整草稿；侧栏中的已确认版本可以显式恢复为编辑态，取消后回到原确认版本，再确认则建立 `parentRevisionId` 修订链。
- 第二层画布默认按 `semanticGroups.range` 渲染功能分区，未覆盖的轴向范围自然留白；功能视图拖动只修改语义范围，连续轴段视图拖动才修改物理台阶。左侧“图纸结构”面板可切换到完整 `segments` 视图，切换本身不改写分区数据或 revision。旧会话缺少 `range` 时继续从关联轴段推导范围，保证版本 1 数据可读。

第二层认领的是会话 Workspace，不是一次任务的 modal。completed、canceled、failed、idle 或 needs-rebase 均不释放 claim。插件暂时不可用时显示第一层 fallback，但保留 claim。

当前轴类智能分区是第二层的第一项完整交互能力；公差与尺寸链数据基础也已落地。最终尺寸候选布局、碰撞优化、覆盖策略和生产公差公式属于后续阶段。分区契约与验收见 [DXF 智能分区设计](superpowers/specs/2026-08-25-dxf-smart-partition-design.md)。

### 识别运行时与真实请求回测

第二层 Host 只通过 `createAnnotationRecognitionRunner()` 创建一个 `RecognitionPipelineRunner`，并按固定顺序注册四条生产管线：

1. `partition-semantic-review`：分区视觉观察、受限语义复核、校验与本地落地；
2. `deterministic-engineering-annotation-plan`：开角、内外径、中心线与圆角的确定性识别及排版；
3. `axial-dimension-inference`：工程资料单位归一化、轴向拓扑、尺寸候选、尺寸链求解与投影；
4. `shaft-gdt-semantic-review`：轴类功能面、基准顺序、形位控制、粗糙度和受控几何落点。

全局入口是唯一注册表与组合根，不是把不同工程域塞进一个算法文件。每条管线仍维护自己的强类型输入、输出和版本，但生产流程与合同回测必须执行同一个已注册的 `RecognitionPipeline` 对象；测试不能复制一套“近似生产”的提示词、几何抽取、后处理、工程规则或落点算法。确定性管线可以直接完成并记录本地阶段，不会为了形成统一接口而强制发起模型请求。

工具与业务服务只能注入 `runner.run()` 的薄封装：标注工具负责应用 edit program，尺寸服务负责合并并保存投影，分区与形位服务负责各自的会话事务。识别管线不得写 Drawing、分区、尺寸计划或标注会话；反过来，持久化服务也不得拥有或直接调用底层识别算法。尺寸链的人工显示/闭环编辑复用轴向管线提供的重投影边界，不复制尺寸投影实现。

所有 DSH 耦合集中在 `dsh-recognition-model-adapter.ts`：父 Agent 解析、图片附件入库、子代理启动、`agent/request` 与 `llm/stream` 观测，以及资源释放都只能从这一边界发生。子代理传输提供方与实际 LLM provider/model 是两套独立路由，不得互相代用。当前运行时兼容门槛由 `release/dsh-plugins.json` 唯一维护，精确锁定 DSH `0.1.3-alpha.1`（源码 tag 与 commit 同时校验）；任一运行时包版本不同、五项子代理能力不完整、子会话请求无法关联或 Agent/LLM 路由漂移时均明确失败，不静默降级为另一种请求方式。npm 暂未发布同版本 SDK，因此构建期依赖临时使用清单记录的 `0.1.2-rc.1`，它不是可运行版本，也不会成为终端用户安装步骤。

模型仍只承担有界语义复核。轴段坐标、边界、尺寸、基准优先级、形位特征、公差值、粗糙度值和最终图元落点继续由本地算法与正式工程证据决定。一次子代理可以产生多次模型请求，运行时按子会话 ID 收集每次请求的 provider、model、reasoning effort、token 上限、消息数、工具名和内容摘要，以便比较真实运行环境。

回测产物只保存规范化结果、阶段状态、版本、规则摘要和 SHA-256 指纹。提示词正文、system 正文、图片字节、工程文档正文、凭据、环境变量和 provider header 不得进入报告或持久化记录。模型路由、DSH 运行时版本、管线版本、测试夹具或规则版本任一变化都会改变可复现指纹。

仓库命令 `pnpm probe:dsh-recognition` 是显式、可选的真实环境检查。它先拒绝过期的 annotation bundle，再在 `.local/dsh-recognition-probe` 下生成隔离的临时 Cordis patch，通过当前 Headless DSH profile 发起一次 60 秒内的结构化子代理请求。命令校验三项 DSH 版本、运行时兼容状态、结构化结束原因、子会话请求观察和 SHA-256 摘要；终端只打印通过状态、provider、model、reasoning effort、版本和观察次数。JSONL 结果若包含 prompt、persona、messages 或 system 正文会直接判失败。`VECTORAI_DSH_CLI` 仅用于开发时显式指定 CLI 文件，不能改变版本门槛；源码版 DSH 的隔离验收可以通过 `VECTORAI_DSH_RECOGNITION_BUNDLE` 指向该 profile 中实际安装的 annotation bundle，以保证外部化模块从同一个 Host 解析。

### 公差与尺寸链数据边界

第一层 `drawing-core` 只保存通用 Viewer/Exporter 能理解的已解析结果：公差显示模式、偏差或极限值、配合代号、基准引用、规则 ID/版本/输入摘要及证据。旧 `tolerance.upper/lower` 字段仍可读取。第一层不保存公式源码、尺寸链方程、AI 提示词或可变工作流状态。

第二层 `engineering-annotation` 是工程规划权威，维护：

- `DimensionIntent`、`EngineeringDatum`、`ToleranceSpec`、`DimensionChain` 与显式依赖边；
- 按角色、稳定几何引用和意图 ID 打破平局的 Kahn 拓扑排序；依赖环只报错，不自动断边；
- worst-case 尺寸链上下界分析；`statistical` 当前返回明确 unsupported 诊断；
- 投影前的状态、证据、规则结果与 Drawing revision 校验。

名义尺寸链推断位于现有 `DimensionIntent` / `DimensionChain` 之前，流程为：分区轴线与台阶边界规范化为 `AxialTopology`；候选生成器只建立相邻跨度、功能范围、文档范围、工艺包络、有限组合与总长；求解器先应用 `required / prohibited` 硬约束，再按人工、文档、功能/工艺和几何证据层级选择闭环。方向、坐标、长度和实体 ID 不参与同级歧义的裁决；同级证据等价时返回多个候选并要求复核。所有名义值、正负系数和等式校验均由本地算法产生。

方案随 dimension-plan durable envelope 保存，包含候选、决策依据、显示/闭环集合和诊断。Client 通过严格 Typert remote 只能按候选 ID 切换显示或闭环，不能提交坐标。确认前会重新投影和验证；`needs-review`、`conflict`、`stale` 均阻止确认。上传文件不会调用推断，唯一模型入口是显式 `drawing_dimension_chain_start`。

`golden-shaft-001/target.dxf` 是测试 Oracle，不是运行时模板。`pnpm e2e:golden-dimension-chain` 从初始 DXF、工程资料和公共 API 完整重建方案，比较 8 个显示区间、3 个闭环区间和 3 条链，并由源码守卫防止样本文件名或闭环常数进入生产决策。

`ToleranceRuleProvider` 是同步、确定性、宿主无关的扩展口。同一规则 ID、不可变版本、名义值、单位和规范化输入必须产生相同输出。工程文档证据进入分区时已经换算为 Drawing 坐标单位，因此后续尺寸拓扑也必须标记为 Drawing 单位；用于候选匹配的原始文档 region/anchor 另行生成 Drawing-unit 视图，不能把源文档单位再次套用于已规范化坐标。Host 在 provider 权威边界把 `mm/cm/m/in` 的尺寸意图统一换算为规范毫米值；provider 输出、持久化 `inputs.basicSize`、输入摘要和 reconciliation 比较都使用这个毫米值，因此同一物理尺寸不会因表达单位变化而失效。输入用 UTF-8 canonical JSON 的 SHA-256 摘要记录。规则模块不能访问 DSH、模型、网络、React、Node 文件系统或可变 Drawing；AI candidate 不具有最终数值权限。通用规则测试仍可使用 Fixture provider，生产标准选择走下述具名、版本化标准 provider。

公差与配合选择器仍完全属于第二层插件。`engineering-annotation` 提供版本化、同步、离线的 `ToleranceStandardProvider`；当前 GB/T 1800-2020 数据集明确公布自身完整度和数值来源，未授权的规格单元返回 unavailable，不能从黄金图纸或相邻表格值推断。DSH Host 读取绑定 Drawing revision 的尺寸意图，负责 catalog、preview、apply、manual override、restore 以及配合双方的一笔原子 Undo/Redo；Client 只维护单实例、非模态 popup、临时画布预览和窗口偏好，不计算偏差，也不因 popup 预览改变 viewport。AI 只能推荐功能意图或代号，所有上/下偏差、极限尺寸和配合结果都由本地 provider 确定性解析并由 Host 复核。

确认或已确定解析的第二层记录先通过统一 projector 变成第一层可移植 `ToleranceProjection`。Drawing/Core、通用 Viewer 和 DXF exporter 只消费这个 projection，不读取 provider 表、推荐状态或 popup session。投影到既有尺寸时只替换对应 `toleranceProjection`；尺寸 ID、几何、文字位置、源图层、可见性、剖面、尺寸链、基准、GD&T、直径和开口角均保持第一层/原计划权威。

R2013 DXF 对跨零偏差使用每个 `DIMENSION` 的 ACAD `DSTYLE` XDATA：`DIMTOL=1`、`DIMTP=upper`、`DIMTM=abs(lower)`、`DIMTDEC=profile tolerance decimals`，并保持整数/实数组代码类型。写入 DSTYLE 或可见 stacked MText 前，偏差从 projection 的原始单位换算到 Drawing 的 DXF 长度单位；`VECTORAI` XDATA 仍保留未经换算的数值和单位。上下偏差同号时禁止写入会丢失符号的 native `DIMTOL`，改用带显式正负号的 stacked MText。短语义 payload 继续作为单个不超过 254 bytes 的 `1000` 值；合法的长 standard ref 使用版本化元数据和按顺序、UTF-8 安全的多个 `1000` 分片，每片不超过 254 bytes，可精确重组而不截断字段。wire 与持久化边界把每个 standard-ref 字段限制为 3584 UTF-8 bytes；exporter 按 16,383-byte ceiling 校验一个实体的全部 ACAD/VECTORAI XDATA，并为每个 REGAPP 额外预留 40 bytes 保守开销，而不宣称精确模拟 AutoCAD 内部布局。绕过新版校验的遗留对象会得到稳定错误，绝不截断引用。直径尺寸输出原生 `AcDbDiametricDimension`，并保留相同的 native/fallback 公差路径。designation-only 展示不会暗中启用 native tolerance，旧 `tolerance.upper/lower` 数据仍按旧文本路径输出且不冒充标准语义。DXF importer 接受 `$INSUNITS` 的 inch/mm/cm/m 编码，并把 header 长度单位传给全部非角度尺寸；角度尺寸仍使用 `deg`。

确认后的第二层 revision 通过 `projectEngineeringAnnotations` 生成第一层 `DimensionAnnotation`，DXF 只格式化 portable projection，绝不回调规则提供器。第二层标注计划使用独立 durable envelope 保存 snapshot、undo、redo 和 `lastConfirmed`，先成功落盘再发布内存状态；Drawing revision 变化进入 `needs-rebase`。

## 8. Viewer 与宿主适配

`drawing-viewer-react` 是网站和 DSH 的唯一画布实现。当前公共组合提供网格/轴、图元、标注、关系、对象/属性侧栏、pan/zoom、选择、Preview、Motion Rig、底部工具栏和 DXF 导出。

网站的 `BrowserLocalDrawingWorkspacePort` 是开发预览权威，不包含聊天、图片意图判断或自动矢量化。DSH Adapter 负责远端资源和 durable repository。未来宿主通过实现 Port 和 Surface contribution API 接入，不复制 Canvas。

## 9. 安全、错误与生命周期

- session、revision、extension/workflow、digest 和 operation binding 全部由 Host 验证；
- stale、过期、越权和 digest mismatch 是硬拒绝，不创建 revision；
- 模型不能提交 approved/force/autoSafe 等授权字段；
- Preview 失败不修改正式 Drawing；
- 插件卸载释放订阅、pointer capture、临时图层和浏览器资源；
- source media 不进入模型文本上下文或 Drawing JSON；
- 本地审计不得记录 token、API key 或媒体正文。

## 10. 测试分层

- 单元/契约：Core、Spatial、Edit、Workspace、Viewer、Remote codec、依赖边界；
- 集成：仓库持久化、幂等 receipt、Preview/Finalize/Undo、Client 生命周期；
- E2E：Host-owned semantic edit、Motion Rig、Launcher；
- 工程数据 E2E：真实 DXF + 二进制工程资料经统一 Host admission 进入智能分区；黄金轴向尺寸链语义推断；公差规则解析、DAG 顺序、第一层投影、DXF 与持久恢复；
- 构建：静态网站、DSH Host Typert 与 Client bundle；
- packaged cross-bundle E2E 覆盖 sticky routing、卸载 fallback、重装恢复、一笔正式提交和 Undo。
