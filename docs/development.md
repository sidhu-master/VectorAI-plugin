# VectorAI 开发指南

## 1. 前置环境

- Node.js 22（或仓库依赖支持的兼容版本）
- pnpm 11.7.0
- DeepSeek Harness `0.1.2-alpha.1` 与 `web` profile（开发 DSH 插件时）
- macOS/Xcode Command Line Tools（构建原生 Launcher 时）
- Python 3.13.2（仅用于贡献者构建自包含矢量化运行时）

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

dsh plugin --profile web add --ignore-workspace-root-check ./packages/plugin-dsh-space
```

第二层自动标注插件独立构建、独立安装；本地开发时先安装第一层：

```bash
pnpm build:dsh-annotation

dsh plugin --profile web add --ignore-workspace-root-check ./packages/plugin-dsh-space
dsh plugin --profile web add --ignore-workspace-root-check ./packages/plugin-dsh-annotation
```

Host 与 Client 源码包只是私有构建输入。构建结果会合并到两个 Bundle 的 `lib/` 中，不再分别安装或发布。

npm 正式安装遵循 DSH 官方 Bundle 命令，并保持两条命令的安装顺序：

```bash
dsh plugin --profile web add @newwe/vectorai-plugin-dsh-space@alpha
dsh plugin --profile web add --allow-build=tesseract.js @newwe/vectorai-plugin-dsh-annotation@alpha
```

Bundle 本地构建不会写入 npm 或当前 DSH profile：

```bash
pnpm build:dsh-space
pnpm build:dsh-annotation
```

`pack:dsh-plugins` 由版本准备完成后的发布流程内部调用，在 `dist/npm/` 生成并审计恰好两个预编译 `.tgz`；不要在普通源码工作区单独调用。平台运行时和完整发布步骤见 [DSH 插件打包与发布手册](releasing-dsh-plugins.md)。只有明确要求发布新版时才执行：

```bash
pnpm release:dsh-plugins -- --version 0.1.0-alpha.N --tag alpha
```

发布脚本先发布五个平台运行时，再发布第一层和第二层，并等待 npm 扫描、记录可续跑 receipt、执行全新 DSH profile 验证。离线用户可把两个 Bundle `.tgz` 按同样顺序传给 `dsh plugin --profile web add`；平台运行时仍需一并镜像到离线 registry。

首次构建 Launcher 前安装精确版本的官方源码运行时：

```bash
pnpm install:dsh-alpha
```

安装器校验官方 tag、commit 和版本，重复运行会复用已构建运行时。VectorAI Client 通过 alpha 的正式 `shell.overlay` 扩展位加入图纸列，并按会话调整 Conversation 的可用宽度，不修改 DSH 源码或构建产物。真实启动与验收始终使用上述精确源码运行时。

## 4. macOS Launcher

```bash
pnpm test:dsh-launcher
pnpm build:dsh-launcher
```

Launcher 使用独立应用窗口启动 DSH，不显示终端黑窗。它在启动前处理 3080 端口的旧 DSH 进程，关闭窗口后终止自己创建的进程组，并使用非持久 WKWebView 数据仓库避免旧 Client bundle 缓存。

## 5. 运行行为

- 普通上传/粘贴图片只作为 DSH 对话附件，不会自动矢量化或打开画布。
- 用户明确调用图纸导入时，`drawing_import` 读取 DSH attachment，并运行 npm 自动选择的自包含平台矢量化程序；不读取用户系统 Python。
- 正式状态位于 `~/.dsh/vectorai/drawings/`；源图片仍由 DSH attachment store 管理。
- 自动标注 Workspace claim 位于 `~/.dsh/vectorai/annotation-sessions/`；任务完成、取消或失败不会清除，session 销毁时删除。
- 分区草稿、确认版本及 Undo/Redo 历史位于 `~/.dsh/vectorai/annotation-partitions/`，使用散列 session 文件名和临时文件 rename 原子写入。
- 尺寸意图、公差规格、尺寸链及其 Undo/Redo 历史位于 `~/.dsh/vectorai/dimension-plans/`；它与第一层 Drawing 分离，并保留独立的最后确认基线。
- 名义尺寸链不会因 DXF 或资料上传自动启动。用户明确提出尺寸链任务后，模型调用无坐标参数的 `drawing_dimension_chain_start`；本地 Host 使用当前分区和已暂存资料生成方案。方案待复核、冲突或过期时不能确认。
- 单独拖入工程资料时，插件会接收、校验并在当前本机会话暂存解析文本，但不会自动分区或接管画布。只有用户文字明确要求轴段分区后，模型才可调用 `drawing_partition_start`；Host 自动合并已暂存资料与模型传入的精简任务上下文，本地算法负责台阶识别、边界计算和吸附。DXF 与资料同时拖入也只会打开图纸并暂存资料。
- 资料格式：`txt/md/csv/tsv/json/yaml/yml/ini/xml/html/htm/log`、`pdf/docx/xlsx/pptx/odt/ods/odp/rtf/epub`。旧 `doc/xls/ppt` 会提示另存为新版 Office、PDF 或文本；扫描 PDF 本阶段不做 OCR。
- 全部解析在本机 Host 完成。DXF 上限 20 MiB；最多 16 份资料，单份 20 MiB、合计 50 MiB，提取文本单份 4 MiB、合计 8 MiB；结构化文档解析限时 30 秒。Client 和 Host 都校验限制与 SHA-256，任何资料失败都发生在第一层导入 DXF 之前。
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
pnpm e2e:golden-dimension-chain
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
