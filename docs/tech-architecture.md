# VectorAI 技术架构

> 状态：当前架构与已批准目标的权威说明
>
> 更新日期：2026-08-24

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
| `drawing-core` | Canonical Drawing 文档、图元、事务、验证 |
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
| `engineering-annotation` | 宿主无关的工程标注识别/规划核心 |
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

第一层 Client 是 `conversation.workspace` 的唯一注册者，并在内部维护 `DrawingSurfaceRegistry`。专业插件注册 contribution，但注册本身不激活 UI；只有当前 session 的成功能力 claim 才参与确定性选举。第一层默认工作区是不可移除的 fallback。DSH rc.8 尚无完整的可组合同页布局 API，因此仓库保留一个受版本/锚点保护的兼容补丁；该补丁只属于 DSH Adapter，不改变 Drawing 或 AI 协议。正式布局 API 可用后应删除兼容层。

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

当前实现包含确定性标注核心、持久 session claim、DSH Host 工具和独立 Client 工作区。正式 Drawing 仍由第一层拥有，第二层提交高层 `SpatialEditProgram`，第一层负责编译、评估、提交与 Undo。

当前 Surface 架构提供：

- `drawing-surface-api` 版本化 contribution 契约；
- 只读 Observable + 受限 Action face，不跨 bundle 传 Store/React Context；
- 受控 DrawingSurface、Canvas Layers、Interaction Controllers；
- 第一层 Client 内部的 Workspace registry 和永久 fallback；
- 第二层按成功能力路由创建、持久化 sticky session claim；
- create/replace/assess/finalize/discard extension Preview；
- 独立 Client 通过只读 annotation session projection 驱动 claim，不检查消息文本或附件。

第二层认领的是会话 Workspace，不是一次任务的 modal。completed、canceled、failed、idle 或 needs-rebase 均不释放 claim。插件暂时不可用时显示第一层 fallback，但保留 claim。

生产级分区、候选布局、碰撞优化和覆盖策略仍属于下一阶段。完整契约与验收见 [可扩展二维空间规范](specs/extensible-2d-space-surface.md)。

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
- 构建：静态网站、DSH Host Typert 与 Client bundle；
- packaged cross-bundle E2E 覆盖 sticky routing、卸载 fallback、重装恢复、一笔正式提交和 Undo。
