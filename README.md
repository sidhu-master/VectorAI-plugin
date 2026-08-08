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
COMPANY_AI_MODEL_NAME
COMPANY_AI_VISION_MODEL
COMPANY_AI_GATEWAY_URL
COMPANY_INTERNAL_TOKEN
```

未配置模型服务时，文字生成进入演示模式；图片/PDF 感知需要可用的视觉模型配置。

## 架构入口

- `docs/prd.md`：产品范围
- `docs/tech-architecture.md`：技术架构
- `src/core/`：平台无关 Spatial Core
- `src/core/patch/`：增量 Patch、验证、应用和逆操作
- `src/core/history/`：SpatialCommit 与 Undo/Redo
- `api/services/audit/`：本地审计、脱敏和回放

本地运行记录写入 `.local/vectorai/runs/`，该目录不会进入 Git。审计载荷会移除令牌、API Key 和媒体正文。

## 验证

```bash
pnpm test
pnpm check
pnpm lint
pnpm build
```

完整 Agent Workflow、进度流和 PDF 支持会在后续实施批次接入当前 Patch/History/Audit 地基。

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
