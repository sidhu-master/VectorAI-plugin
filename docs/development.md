# VectorAI 开发指南

## 1. 前置环境

- Node.js 22（或仓库依赖支持的兼容版本）
- pnpm 10
- DeepSeek Harness `0.1.0-rc.8` 与 `web` profile（开发 DSH 插件时）
- macOS/Xcode Command Line Tools（构建原生 Launcher 时）
- Python 3（DSH 本地清洁线稿矢量化；worker 随 Host 包发布）

VectorAI 不需要自己的 Express 服务、云端账号或 API 网关。

## 2. 安装与静态网站

```bash
pnpm install
pnpm dev
```

网站是共享 Drawing Workspace 的本地预览壳。它使用 `src/adapters/browser-local-drawing-workspace-port.ts` 保存浏览器本地 Drawing，不包含聊天、自动导入或 `/api` 请求。

生产构建：

```bash
pnpm check
pnpm build
pnpm preview
```

## 3. 构建和安装 DSH 插件

```bash
pnpm build:dsh-space

dsh plugin --profile web add --ignore-workspace-root-check \
  ./packages/plugin-dsh-space \
  ./packages/plugin-dsh-space-host \
  ./packages/plugin-dsh-space-client
```

第二层自动标注插件独立构建、独立安装；本地开发时先安装第一层：

```bash
pnpm build:dsh-annotation

dsh plugin --profile web add --ignore-workspace-root-check \
  ./packages/plugin-dsh-annotation \
  ./packages/plugin-dsh-annotation-host \
  ./packages/plugin-dsh-annotation-client
```

本地 monorepo 开发需要列出 workspace 包；发布后的 bundle 由包管理器解析依赖。

DSH rc.8 如未提供 VectorAI 需要的同页 Workspace 布局，运行受保护补丁：

```bash
pnpm patch:dsh-workspace -- --dsh-bin "$(command -v dsh)"
```

补丁校验已知版本和代码锚点，首次修改前创建备份，重复运行幂等，未知布局时失败关闭。它只适配 DSH UI 插槽，不修改 AI 工具协议。DSH 提供正式布局 API 后应移除。

## 4. macOS Launcher

```bash
pnpm test:dsh-launcher
pnpm build:dsh-launcher
```

Launcher 使用独立应用窗口启动 DSH，不显示终端黑窗。它在启动前处理 3080 端口的旧 DSH 进程，关闭窗口后终止自己创建的进程组，并使用非持久 WKWebView 数据仓库避免旧 Client bundle 缓存。

## 5. 运行行为

- 普通上传/粘贴图片只作为 DSH 对话附件，不会自动矢量化或打开画布。
- 用户明确调用图纸导入时，`drawing_import` 读取 DSH attachment 并运行随 Host 打包的本地 Python worker。
- 正式状态位于 `~/.dsh/vectorai/drawings/`；源图片仍由 DSH attachment store 管理。
- 自动标注 Workspace claim 位于 `~/.dsh/vectorai/annotation-sessions/`；任务完成、取消或失败不会清除，session 销毁时删除。
- 分区草稿、确认版本及 Undo/Redo 历史位于 `~/.dsh/vectorai/annotation-partitions/`，使用散列 session 文件名和临时文件 rename 原子写入。
- 尺寸意图、公差规格、尺寸链及其 Undo/Redo 历史位于 `~/.dsh/vectorai/dimension-plans/`；它与第一层 Drawing 分离，并保留独立的最后确认基线。
- DXF 智能分区只由专业工作区的显式导入触发。DXF 上限 20 MiB，工程文档上限 2 MiB；Host 会重新计算 SHA-256。
- Drawing 工具按需激活；无 Drawing 的普通会话不显示 VectorAI Workspace。
- 第一层与第二层 UI 路由已使用成功能力认领，不使用消息文本或附件启发式；第二层不可用时临时回退第一层。

## 6. 测试

快速发布基线：

```bash
pnpm test
pnpm check
pnpm build
pnpm build:dsh-space
pnpm build:dsh-annotation
```

独立验证：

```bash
pnpm test:dsh-launcher
pnpm e2e:host-owned-semantic-edit
pnpm e2e:motion-rig
pnpm e2e:drawing-surface
pnpm e2e:dxf-smart-partition
pnpm e2e:tolerance-data-foundation
```

包级调试示例：

```bash
pnpm --filter @vectorai/drawing-workspace test
pnpm --filter @vectorai/drawing-viewer-react test
pnpm --filter @vectorai/plugin-dsh-space-host test
pnpm --filter @vectorai/plugin-dsh-space-client test
pnpm --filter @vectorai/engineering-annotation test
pnpm --filter @vectorai/plugin-dsh-annotation-host test
pnpm --filter @vectorai/plugin-dsh-annotation-client test
```

构建产物不得重新暴露旧 raw write routes：

```bash
! rg "drawingSpace/(commit|createPreview|commitPreview|discardPreview)" \
  packages/plugin-dsh-space-host/lib/typert.js \
  packages/plugin-dsh-space-client/lib/client.js
```

## 7. 调试原则

- 先区分路由、模型选择、Host grounding、确定性 solver、Preview、policy 和 Client 展示中的哪一层失败。
- 不针对单张图或自然语言示例添加坐标、人体部件或动作特判。
- 模型高亮异常时检查 Grounding/attention projection，不能用最终正确结果掩盖错误中间状态。
- 提交失败时保留原 operation ID，通过 operation receipt 对账，不用新 ID 盲目重试。
- revision stale 后重新 observe/ground，不复用旧 part key、Preview 或 selection projection。

常见错误：

- `PENDING_DRAWING_SOURCE_REQUIRED`：需要用户显式选择并导入 Drawing source。
- `EDIT_TARGET_UNRESOLVED`：当前语义范围尚未解析为可信节点/接口。
- `EDIT_PREVIEW_STALE` / `EDIT_TASK_STALE`：新任务、revision 或手动编辑已使旧状态失效。
- `confirmation_required`：来源或诊断不满足 auto-safe，应保留 Preview 等待确认。
- `COMMIT_OUTCOME_UNKNOWN`：用原 operation binding 查询 durable receipt。

## 8. 贡献和发布检查

- 新共享能力放在最内层合适 package，禁止从 Core 指向宿主。
- 新插件只依赖公共 contracts/exports，并增加 dependency-boundary 测试。
- 公差公式只能实现 `ToleranceRuleProvider`，必须固定规则 ID/版本、同步且确定性；禁止把公式源码写入 Drawing、DSH Adapter 或 Client。生产公式尚未随仓库提供。
- 行为修改先写失败测试；交互变更同时验证空白取消选择、pan/zoom、Preview 与 Undo/Redo 回归。
- Client bundle 和 Host Typert 都要从干净安装构建。
- 不提交 `.env`、`.local/`、DSH 用户状态、媒体正文或 HyperFrames 生成素材。
- 更新 PRD/技术架构时明确区分“当前实现”和“已批准目标”。
