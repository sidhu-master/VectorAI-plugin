# VectorAI Spatial Protocol Engine

VectorAI 是 AI 原生二维空间协议引擎。AI 通过可验证的 SpatialPatch 增量构建 SpatialModel，而不是直接生成不可编辑的图片。

## 本地开发

```bash
pnpm install
pnpm dev
```

前端默认运行在 Vite 开发端口，`/api` 代理到本地 Express 服务 `http://localhost:3001`。

## 环境变量

在未提交到 Git 的 `.env` 中按需要配置：

```text
COMPANY_AI_BASE_URL
COMPANY_AI_API_KEY
COMPANY_AI_MODEL_NAME=doubao-seed-2.0-lite
COMPANY_AI_PRIMARY_MODEL=doubao-seed-2.0-lite
COMPANY_AI_VISION_MODEL=doubao-seed-2.0-lite
COMPANY_AI_REPAIR_MODEL=doubao-seed-2.1-turbo
COMPANY_AI_GATEWAY_URL
COMPANY_INTERNAL_TOKEN
```

Agent 主流程默认使用 Lite。二维图纸走专用感知管线，按页级分析、视图拆分、几何/OCR 并行检测、拓扑与尺寸关联、最多 25 图元的增量 Patch 顺序执行；旧的单体图纸 Prompt 不再参与主路径。低于 0.6 的有效图元直接提交并标红；文字任务的低置信度有效结果才升级一次 Turbo。未配置模型服务时，文字生成进入演示模式；图片/PDF 感知需要可用的视觉模型配置。

## 架构入口

- `docs/prd.md`：产品范围
- `docs/tech-architecture.md`：技术架构
- `src/core/`：平台无关 Spatial Core
- `src/core/patch/`：增量 Patch、验证、应用和逆操作
- `src/core/history/`：SpatialCommit 与 Undo/Redo
- `api/services/audit/`：本地审计、脱敏和回放
- `api/services/drawing-perception/`：图纸资产缓存、视觉工具、拓扑、尺寸关联与 Patch 编排

本地运行记录写入 `.local/vectorai/runs/`，该目录不会进入 Git。审计载荷会移除令牌、API Key 和媒体正文。

PDF 图纸会在本地服务端通过 Poppler 的 `pdftoppm` 只渲染第一页，并缩放到最长边 2048px。开发机需能执行 `pdftoppm`；如命令不在 `PATH`，可设置 `PDFTOPPM_PATH` 为其绝对路径。

## Agent Workflow

Agent 模式默认自动执行。启动请求在规划和图纸转换前返回 `runId`，前端随后通过 SSE 接收结构化执行记录；这些记录是可审计的决策摘要、工具状态和验证结果，不包含模型隐藏推理。

| 方法 | 路由 | 用途 |
|---|---|---|
| `POST` | `/api/agent/runs` | 启动任务，可携带当前 `spatialModel`、图片或 PDF |
| `GET` | `/api/agent/runs/:runId/events` | SSE 进度流和最近 100 条事件回放 |
| `GET` | `/api/agent/runs/:runId` | 获取计划、游标和已提交模型 |
| `POST` | `/api/agent/runs/:runId/pause` | 请求在安全点暂停 |
| `POST` | `/api/agent/runs/:runId/resume` | 继续执行 |
| `POST` | `/api/agent/runs/:runId/stop` | 中止当前调用且不提交半成品 |
| `POST` | `/api/agent/runs/:runId/instructions` | 追加在下一个安全点生效的指令 |

有效运行在连续静默 25 秒时发送 heartbeat，因此用户可见回执间隔保持在 30 秒以内。图纸任务按稳定 observation/entity ID 提交独立组件，单个组件失败不会回滚之前的提交；图片正文只存在于运行期缓存，终止后释放。

用本地图纸运行非 CI 基准（结果只写入被 Git 忽略的 `.local/vectorai/baselines/`）：

```bash
pnpm test:drawing -- test1.jpg
```

命令逐行输出受理延迟、首个 Patch 延迟、各感知阶段耗时、Patch 批次数、观测/尺寸关联数量、低置信度与局部工具错误数量，不输出图片正文。正式服务的普通模型阶段 deadline 默认 120 秒，图纸感知总 deadline 默认 240 秒；期间仍以结构化阶段事件和 25 秒 heartbeat 保持可见回执。

检查某次本地运行：

```bash
find .local/vectorai/runs -maxdepth 2 -type f -print
tail -n 20 .local/vectorai/runs/<runId>/events.jsonl
```

## 验证

```bash
pnpm test
pnpm check
pnpm lint
pnpm build
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
