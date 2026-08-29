# DSH 0.1.2-alpha.1 官方布局迁移设计

## 目标

将 VectorAI 的 DSH 集成从 `0.1.0-rc.8` 升级到固定版本
`0.1.2-alpha.1`，删除对 DSH 已构建 JavaScript 的会话布局修改。第一层插件使用
DSH 官方 Web Client slot 系统提供稳定的桌面壳：左侧保留 DSH 导航，中间显示当前
Drawing Workspace，右侧显示原生会话。没有 Drawing 能力接管时，界面保持普通 DSH
会话布局。

同时把 `shaft-reference-terminal-closure-v1` 设为轴向名义尺寸链的默认策略。用户只需
明确提出“建立尺寸链”，无需知道黄金样本或策略名称。

## 已确认的根因

当前运行环境使用 DSH `0.1.0-rc.8`，Launcher 内补丁、npm cache 内会话 bundle 与
仓库补丁均为 v8。相同 Host 在新浏览器上下文中能计算出横向布局，而长期运行的
WKWebView 会话仍可退化为上下布局。Drawing Workspace 实际仍在可访问性树中，故障
发生在被修改的 DSH ConversationRoot 布局生命周期，而不是 Drawing claim、Drawing
repository 或第二层渲染器。

`conversation.workspace` 不是 rc.8 的公开 slot。当前脚本通过字符串锚点向编译产物
加入 slot、MutationObserver、分栏 CSS 和新会话补丁；这使插件热替换、会话壳重新挂载、
DSH 构建变化和 WKWebView 生命周期都能破坏布局。继续增加补丁版本不能消除这个架构
风险。

## 版本选择

- 固定使用 `@deepseek-ai/*@0.1.2-alpha.1`，不使用浮动 `latest` 或范围版本。
- `0.1.1-rc.2` 只包含图片处理相关改进，未提供本迁移需要的新 Web Client 架构。
- `0.1.2-alpha.1` 提供公开 `root` slot、三栏 AppFrame 契约、`sidebar`、
  `conversation`、`details`、`shell.overlay` 子 slot 和 `ctx.layout` 服务。
- alpha 版本风险由精确锁定版本、启动契约探针、完整回归和可回滚 Launcher 构建控制。

## 第一层布局适配器

### 所有权

第一层 `@vectorai/plugin-dsh-space-client` 增加一个独立的 `VectorAIAppFrame`。它通过
公开的 `root` single slot 注册，声明并渲染官方子 slot，不修改 DSH 文件，不复制会话
状态，也不拥有聊天数据。

第二层自动标注插件仍只向第一层 `DrawingSurfaceRegistry` 注册专业 Workspace
contribution。第二层不得注册 `root`、`sidebar` 或 `conversation`。

### 布局状态

`VectorAIAppFrame` 始终保留官方壳的四个区域：

1. `sidebar`：DSH 导航及其折叠控制；
2. VectorAI Drawing 区：仅当前 session 的 Drawing Surface claim 激活时出现；
3. `conversation`：原生聊天、输入框、轨迹和会话头；
4. `details` 与 `shell.overlay`：继续向其他插件开放，不被 VectorAI 截断。

没有激活 Drawing 时，不渲染 Drawing 列，Conversation 占满官方中间区域。存在 Drawing
时，Drawing 使用剩余宽度，Conversation 使用可拖动的固定偏好宽度，默认 440px，范围
360–640px。窗口缩小时优先折叠 sidebar 和 details，但 Drawing 与 Conversation 不切换
为上下排列。低于可用最小宽度时允许整个工作区横向约束，不静默改变信息架构。

### Session 与热替换

布局可见性直接来自第一层 session-scoped Drawing Surface snapshot，不再观察 DOM
属性。切换会话、创建新会话或插件热替换时，snapshot 决定 Drawing 列是否存在；旧
session 的 claim 不得泄漏到新 session。Workspace contribution 更换只替换 Drawing
列内部内容，不重新注册根壳。

### 与其他 UI 插件的关系

DSH 的 `root` 是 single slot。VectorAI 壳与另一个 root-shell 插件同时安装时必须按
DSH 的显式优先级选举，不通过 CSS 抢占。VectorAI 提供一个可关闭的 shell 注册配置；
普通功能插件继续使用官方子 slot，不受影响。启动检查会报告另一个 root owner 赢得选举，
而不是显示错误布局。

## 兼容探针与 Launcher

Launcher 固定启动 DSH `0.1.2-alpha.1`。旧的
`dsh-inline-workspace-patch.mjs`、bundle 内副本以及启动前文件改写全部删除。

启动器在拉起服务前只做只读兼容检查：

- DSH 版本必须精确等于 `0.1.2-alpha.1`；
- profile 必须装载第一层 Host/Client 与第二层 Host/Client；
-构建期契约测试必须证明官方 `root/sidebar/conversation/details/shell.overlay` 类型可用；
-运行时 smoke 必须证明 VectorAI root owner 已挂载且 Drawing session 呈左右布局。

检查失败时 Launcher 显示具体兼容错误并停止，不修改 npm cache，不回退到上下布局。

## 尺寸链默认策略

`drawing_dimension_chain_start` 的参数继续允许显式覆盖，但省略时使用
`shaft-reference-terminal-closure-v1`。工具描述不再要求用户提到“黄金样本”。
`shaft-hierarchical-dimensioning-v1` 保留为显式备选策略，用于希望复核其他行业惯例的
任务。

黄金样本仍然只是测试 Oracle；运行时代码不得包含样本文件名或样本专用坐标。

## 迁移和数据兼容

- Drawing、分区、尺寸链和会话 durable state 的本地路径不变。
- 不迁移或重写用户数据。
- Host Remote 继续使用 `@Remote`/Typert；不重新引入已被 alpha 删除的 APIProxy。
- 插件所有 `@deepseek-ai/*` 依赖同步升级，禁止 rc.8 与 alpha 包混装。
- build 脚本继续生成独立 Host/Client bundle，不增加 VectorAI 服务端。

## 验收

自动测试必须覆盖：

1. 所有 DSH package 精确锁定 alpha.1，且没有 rc.8 残留；
2. 默认尺寸链策略生成黄金样本的 8 个显示区间、3 个闭合区间和 3 条链；
3. 无 Drawing session 只显示普通 Conversation；
4. Drawing session 始终为左导航／中图纸／右聊天；
5. 会话切换、新建会话、Drawing claim 变化和 Client 热替换不会变成上下布局；
6. 窗口从最小尺寸到全屏均保持横向布局，Canvas 收到真实 ResizeObserver 尺寸；
7. details、overlay、附件、工具调用、分区、开角和尺寸链流程继续工作；
8. Launcher 启动、关闭窗口终止进程、3080 端口回收和双击全屏继续工作；
9. 仓库不存在修改 DSH 安装文件的脚本或 Launcher 调用路径。

最终必须在真实 `DSH.app` 中执行冷启动、会话切换、窗口缩放和重启验收，并保存日志与
可重复的 smoke 输出。

