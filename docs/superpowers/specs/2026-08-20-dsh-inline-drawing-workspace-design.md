# DSH 聊天内并排图纸工作区设计

> 状态：用户已确认
>
> 日期：2026-08-20

## 1. 目标

把 VectorAI 第一层画布从 DSH `conversation.view` 的独立“图纸”Tab，迁移为与原生聊天同时显示的会话工作区：

```text
DSH 会话侧栏 | VectorAI 图纸画布 | DSH 原生聊天
```

左侧会话侧栏、DSH 消息流、输入框、审批、队列和工具详情继续由 DSH 拥有。VectorAI 只提供图纸工作区，不复制聊天组件，也不启动 HTTP/Express 服务。

## 2. 已确认的 DSH rc.8 边界

DSH `0.1.0-rc.8` 的 `conversation.view` 是互斥视图环，宿主通过 `only: active.id` 每次只渲染一个 Tab。`conversation.session`、根 `conversation` 和 `details` 都是已经被内置 UI 占用的 `single` slot；另一个插件不能重复注册覆盖。

因此，单改 VectorAI 插件无法可靠实现聊天与画布并排。禁止使用 DOM Portal、查询哈希类名或 CSS 强行移动 DSH 私有节点，因为这种实现无法通过版本升级和生命周期验证。

## 3. 方案选择

采用一个对 DSH 通用、对 VectorAI 无感知的新增扩展点：

```ts
'conversation.workspace': {
  kind: 'single';
  scope: 'session';
}
```

DSH 会话根布局声明并渲染该 slot。没有插件注册时，布局与原版完全一致；存在工作区时，主内容区变成：

```text
┌──────────────────────────────┬──┬──────────────────┐
│ conversation.workspace       │拖│ DSH conversation │
│ 自适应占满剩余空间            │动│ 固定/可调宽度      │
└──────────────────────────────┴──┴──────────────────┘
```

VectorAI Client 注册 `conversation.workspace`，不再注册 `conversation.view`。这避免重复挂载 Drawing store、附件 URL 和 Remote 订阅。

## 4. 布局行为

- 桌面宽度下，画布占满剩余空间，聊天默认宽度 `440px`。
- 聊天宽度可以从左侧分隔条拖动，限制为 `360px` 到 `640px`。
- 画布最小宽度为 `520px`；窗口不足时改为上下堆叠，图纸在上、聊天在下，二者仍在同一页。
- 只有 `conversation.workspace` 真正有内容时才启用分栏；其他 DSH profile 保持原布局。
- Header、消息滚动区和 Composer 作为一个完整聊天列移动，输入框不会横跨画布。
- 分隔条支持 Pointer Events、`role="separator"`、方向与当前宽度 ARIA 属性。
- 第一版宽度属于瞬时 UI 状态，重启恢复默认值；不引入新的持久设置协议。

## 5. DSH 兼容补丁

当前 DSH 来自 `npx @deepseek-ai/dsh@next` 缓存，没有本地源码 checkout。VectorAI 仓库提供开源、可测试、幂等的 rc.8 补丁器：

1. 从实际 `dsh` 可执行文件解析安装根目录。
2. 校验 `@deepseek-ai/dsh-client-ui-conversation` 版本精确为 `0.1.0-rc.8`。
3. 校验待替换的稳定源码锚点；任何锚点不匹配都拒绝修改。
4. 首次修改前创建同目录备份。
5. 注入 `conversation.workspace` 声明、布局节点和拖动逻辑。
6. 已应用时返回 `already-patched`，不会重复注入。

DSH.app 启动脚本在启动 Host 前调用补丁器。补丁失败时启动中止并显示明确错误，避免在半兼容 UI 上继续运行。正式目标是把同一扩展点整理为 DSH 上游改动；本地补丁只是 rc.8 开发期 Adapter，不进入 Drawing Core。

## 6. VectorAI Client

`@vectorai/plugin-dsh-space-client` 自己声明 SlotMap 类型扩展，并把现有 `DrawingConversationView` 注册到 `conversation.workspace`。

组件继续：

- 使用当前 Agent/session 绑定的 Remote Workspace Port；
- 加载正式 Snapshot 与 Preview；
- 在工具调用变化后刷新；
- 在卸载时释放原图 URL 和 Drawing store；
- 复用 `@vectorai/drawing-viewer-react` 的坐标轴、网格、平移缩放、选择、属性和 Preview diff。

布局专用 CSS 只选择本补丁新增的稳定 `data-*` 属性和 VectorAI 自己的类名，不依赖 DSH 的哈希 CSS 类。

## 7. 错误与恢复

- DSH 版本不匹配：`DSH_WORKSPACE_UNSUPPORTED_VERSION`，不修改文件。
- 源码锚点缺失或出现多次：`DSH_WORKSPACE_PATCH_ANCHOR_MISMATCH`，不修改文件。
- 写入失败：保留备份；临时文件删除，原文件不被部分覆盖。
- Client Slot 未声明：DSH 启动时显式失败，而不是静默退回独立 Tab。
- VectorAI Remote 不可用：聊天仍可用，画布显示现有 Workspace 错误态。

## 8. 验收

自动验证：

- 补丁器首次应用、重复应用、版本拒绝、锚点拒绝和原子写入测试；
- VectorAI Client 注册 `conversation.workspace` 且不再注册 `conversation.view`；
- Client store 与附件释放生命周期测试；
- VectorAI 全量 test/check/build/lint 门禁。

真实 DSH 验收：

- 启动后左侧仍是原会话栏；
- 同一个会话中图纸与聊天同时可见；
- 输入框位于聊天列底部；
- 分隔条可拖动，画布正确收到 ResizeObserver/尺寸变化；
- 粘贴图片并导入后，图纸直接出现在并排画布；
- 切换会话不会串图或泄漏原图 URL；
- 关闭 DSH 窗口仍停止本地 Host。

## 9. 非目标

- 本切片不实现 DXF/PDF 文件通道、Undo/Redo 或导出。
- 不复制或重写 DSH ChatView、Composer、审批和队列。
- 不把 DSH UI 补丁带入宿主无关包。
- 不为本切片启动 VectorAI Express、WebSocket 或其他监听服务。
