# VectorAI

VectorAI 是一个本地优先、可嵌入宿主的二维空间与工程图插件系统。第一层为 DeepSeek Harness（DSH）及其他宿主提供统一 Drawing IR、二维画布、空间查询、交互编辑和可审计提交；第二层在这些公共能力上实现工程图自动标注等专业流程。

项目采用 Apache-2.0 许可证。VectorAI 不运行自己的云端或 Express 服务：DSH 插件使用 DSH 的本地 Host/Client 协议，网站使用浏览器本地 Adapter，两者复用相同的核心包和 Viewer，但各自维护本地状态，不做隐式同步。

## 当前能力

- Canonical Drawing 文档、revision、事务及验证
- 二维空间查询与确定性语义编辑求解
- React 画布：网格/坐标轴、缩放拖动、框选、对象/属性面板、Preview、Undo/Redo、DXF 导出
- DSH 会话内画布、附件导入、本地矢量化、Host-owned 语义编辑与临时运动铰链
- DSH 输入区本地导入 DXF + 多份工程资料（文本、PDF、新版 Office、OpenDocument、RTF、EPUB）并进入可编辑智能分区
- 版本化 Drawing Surface API、受限 Runtime 和受控画布原语
- DSH 会话级 Workspace registry、sticky claim 与永久第一层 fallback
- 第一层 staged extension Preview 权限边界
- 独立构建的工程标注 Host/Client 插件和专业工作区骨架
- macOS 原生 DSH 启动器
- 无服务端的浏览器本地画布预览站

可扩展 2D Surface 平台已落地：第一层继续拥有唯一画布入口和提交权限，第二层按成功能力路由在会话内接管专业 UI，同时只使用受控画布和受限 Runtime。下一阶段集中在生产级标注识别、分区、布局与冲突优化。详见 [可扩展二维空间规范](docs/specs/extensible-2d-space-surface.md)。

## 快速开始

```bash
pnpm install
pnpm test
pnpm check
pnpm dev
```

`pnpm dev` 只启动静态 Vite 预览站，不启动 API 或模型服务。浏览器中的修改保存在本地存储。

构建 DSH 插件：

```bash
pnpm build:dsh-space
pnpm build:dsh-annotation
```

完整的 DSH 安装、兼容补丁、Launcher 和验证说明见 [开发指南](docs/development.md)。

## 仓库结构

```text
apps/dsh-launcher-macos/       macOS 原生启动器
packages/drawing-*             Drawing、空间、编辑、Workspace 与 Viewer
packages/drawing-surface-api/  版本化跨插件 Surface 契约
packages/plugin-space-contracts/  宿主无关公共插件协议
packages/plugin-dsh-space-*    第一层 DSH Host/Client 适配器
packages/engineering-annotation/  工程标注确定性核心
packages/plugin-dsh-annotation/   第二层可安装 bundle
packages/plugin-dsh-annotation-host/ 第二层 DSH Host 流程
packages/plugin-dsh-annotation-client/ 第二层独立 Client 工作区
src/                           浏览器本地预览站
scripts/                       当前构建、兼容与 E2E 脚本
docs/                          当前权威文档与未完成规范
```

## 常用命令

```bash
pnpm test                         # 当前单元与集成测试
pnpm check                        # TypeScript 检查
pnpm build                        # 静态网站生产构建
pnpm build:dsh-space              # DSH Host/Client 产物
pnpm build:dsh-annotation         # 第二层 Host/Client 产物
pnpm test:dsh-launcher            # macOS Launcher 测试
pnpm e2e:host-owned-semantic-edit # 真实第一层语义链路
pnpm e2e:motion-rig               # 临时运动铰链链路
pnpm e2e:drawing-surface          # 跨包接管、恢复、提交与 Undo
```

## 文档

- [产品需求](docs/prd.md)
- [技术架构](docs/tech-architecture.md)
- [开发指南](docs/development.md)
- [文档索引](docs/README.md)
- [可扩展二维空间规范](docs/specs/extensible-2d-space-surface.md)

历史方案不在工作树内保留；需要追溯时使用 Git 历史。
