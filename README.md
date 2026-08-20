# VectorAI Spatial Protocol Engine

VectorAI 是 AI 原生二维空间协议引擎。AI 通过可验证的 Drawing IR 增量事务理解、维护和修改真实二维图纸，而不是直接生成不可编辑的图片。

## 本地开发

```bash
pnpm install
pnpm setup:vectorization
pnpm dev
```

前端默认运行在 Vite 开发端口，`/api` 代理到本地 Express 服务 `http://localhost:3001`。
`setup:vectorization` 会在 `.local/vectorai/cv-venv/` 创建隔离的 Python 环境并安装中心线矢量化依赖；服务启动后复用一个常驻 Python 进程，不会为每条线重复启动解释器。若该环境不可用，服务仍能启动，但模型调用 `vectorize_image` 时会收到能力不可用的工具结果并自行换方案。

## 环境变量

在未提交到 Git 的 `.env` 中按需要配置：

```text
COMPANY_AI_BASE_URL
COMPANY_AI_API_KEY
COMPANY_AI_MODEL_NAME=doubao-seed-2.0-lite
COMPANY_AI_PRIMARY_MODEL=doubao-seed-2.0-lite
COMPANY_AI_SPATIAL_MODEL=doubao-seed-2.1-turbo
COMPANY_AI_REVIEW_MODEL=doubao-seed-2.1-turbo
COMPANY_AI_IMAGE_EDIT_MODEL
COMPANY_AI_IMAGE_EDIT_URL
COMPANY_AI_GATEWAY_URL
COMPANY_INTERNAL_TOKEN
```

AI 对话只有一个 Agent 主流程，不提供“普通/Agent”模式切换。纯文字、图片、PDF 及文字与附件的组合输入统一启动 Agent；运行中的纯文字作为下一轮指令追加。模型是可替换的单动作决策边界；Drawing IR、SceneCompiler、工具、事务、验证、Human Decision、审计与回放不依赖具体模型。`COMPANY_AI_SPATIAL_MODEL` 负责空间理解与 Drawing IR 规划；`COMPANY_AI_REVIEW_MODEL` 是独立第三方检查者，只比较同视口的 `before | after` 是否满足当前用户指令，并把意见返回主模型，不参与编辑、授权或 Commit 门禁。确定性几何诊断负责快速前置检查。模型名称不会出现在任务 UI。低于 0.6 的有效图元作为 candidate 标红。

## 架构入口

- `docs/prd.md`：产品范围
- `docs/tech-architecture.md`：技术架构
- `docs/superpowers/specs/2026-08-13-2d-world-model-and-spatial-action-compiler-design.md`：任务驱动 2D World Model、临时语义视图和空间动作设计
- `src/drawing/`：Canonical Drawing IR、Command、事务、验证、Commit 与回放
- `src/drawing/scene/`：前后端共享 SceneCompiler
- `api/services/drawing-agent/`：空间 Agent、模型协议、Preview/Verify/Revise/Commit 与审计
- `api/services/drawing-vision/`：服务端 overview/detail observation 与 Grounding
- `api/services/drawing-perception/`、`drawing-feedback/`：图片重建工具与反馈 loop

本地运行记录写入 `.local/vectorai/runs/`，该目录不会进入 Git。审计载荷会移除令牌、API Key 和媒体正文。

PDF 图纸会在本地服务端通过 Poppler 的 `pdftoppm` 只渲染第一页，并缩放到最长边 2048px。开发机需能执行 `pdftoppm`；如命令不在 `PATH`，可设置 `PDFTOPPM_PATH` 为其绝对路径。

## Agent Workflow

Agent 默认自动执行。启动请求在意图判断和图纸转换前返回 `runId`，前端随后通过 SSE 接收结构化执行记录；这些记录是可审计的动作摘要、真实工具状态和诊断结果，不包含模型隐藏推理。生产快路径是 `Observation + bounded World Model → 一次模型选择/规划 → Free Drawing Transaction Preview → 立即画布增量 → Commit`。每轮上下文显式给出正式 revision 与当前 Preview 两种编辑基线；模型可用 `preview_transaction` 舍弃候选重做，或用 `revise_preview` 保留候选并只提交纠正。后端把候选修订合成为可独立提交的 canonical 事务。模型只在相关空间事实为 partial/unknown、目标依赖视觉语义、候选出现新缺陷或用户追加反馈时按需查询 Grounding、旧拓扑适配器、Counterfactual World 或 `evaluate_preview`；这些额外轮次都记录 `escalationReason + Evidence Delta`，不组成固定流水线。

复杂图纸通过与 drawing、revision、空间范围和编译器版本绑定的 continuation token 真实分页读取；跨范围或跨 revision 的 token 返回 stale，不会把未读区域误报为空。CV、重叠分区、路径追踪、拆分、重绘、矢量化和拟合都是模型可选工具；工具结果不拥有写权限，任何修改最终都必须经过 Drawing IR Preview 和原子 Commit。

| 方法 | 路由 | 用途 |
|---|---|---|
| `POST` | `/api/agent/runs` | 在指定 Drawing revision 上启动任务，可携带图片或 PDF |
| `GET` | `/api/agent/runs/:runId/events` | SSE 进度流和最近 100 条事件回放 |
| `GET` | `/api/agent/runs/:runId` | 获取当前状态、最新动作和候选句柄 |
| `POST` | `/api/agent/runs/:runId/pause` | 请求在安全点暂停 |
| `POST` | `/api/agent/runs/:runId/resume` | 继续执行 |
| `POST` | `/api/agent/runs/:runId/stop` | 中止当前调用且不提交半成品 |
| `POST` | `/api/agent/runs/:runId/instructions` | 追加在下一个安全点生效的指令 |
| `POST` | `/api/agent/runs/:runId/decisions/:requestId/respond` | 响应通用用户决定并继续同一任务 |

有效运行在连续静默 25 秒时发送 heartbeat，以 30 秒内出现可见回执为体验目标；这不是正确性的硬超时。每轮模型只选择一个工具动作，画布显示查询节点、关键点、路径和当前 Preview；模型可多轮观察、修改、诊断和重新预览。干净线稿可以通过矢量化工具提取中心线和拓扑链，自适应分段后形成直线、圆、圆弧、椭圆或 Polyline piece，并由 CompoundPath 保持逻辑整体。

用本地图纸运行非 CI 基准（结果只写入被 Git 忽略的 `.local/vectorai/baselines/`）：

```bash
pnpm test:drawing -- test1.jpg
```

命令逐行输出受理延迟、首个事务预览延迟、各感知阶段耗时、提交批次数、低置信度与局部工具错误数量，不输出图片正文。正式服务的高级空间模型单次调用 deadline 默认 120 秒，Agent 总 deadline 默认 15 分钟；期间仍以结构化阶段事件和 25 秒 heartbeat 保持可见回执。

检查某次本地运行：

```bash
find .local/vectorai/runs -maxdepth 2 -type f -print
tail -n 20 .local/vectorai/runs/<runId>/events.jsonl
```

不调用外部模型，使用本地最大 Drawing 快照回归 Agent 上下文预算：

```bash
pnpm benchmark:agent-context
```

输出当前 checkpoint 冷读、空间索引、观察渲染、Prompt/Schema 字节、工作集节点和单轮图像指标。

## 验证

```bash
pnpm test
pnpm check
pnpm lint
pnpm build
pnpm test:test2-self-edit -- test2.png
pnpm e2e:region-hair-edit
```

<!-- 原 Vite 模板说明保留在下方，后续项目初始化清理时删除。 -->

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  extends: [
    // other configs...
    // Enable lint rules for React
    reactX.configs['recommended-typescript'],
    // Enable lint rules for React DOM
    reactDom.configs.recommended,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```
