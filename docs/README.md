# VectorAI 文档索引

本文档目录只保留当前事实与正在实施的规范。代码、公开导出和通过的契约测试是最终实现证据；文档与代码冲突时应修正文档。

## 权威文档

- [产品需求](prd.md)：产品目标、两层插件模型、用户流程、范围和验收标准。
- [技术架构](tech-architecture.md)：当前实现边界、依赖方向、数据与事务权威、DSH 集成，以及明确标注的目标架构。
- [开发指南](development.md)：环境准备、网站与 DSH 开发、Launcher、测试和发布检查。

## 活跃规范

- [可扩展 2D Space Surface](specs/extensible-2d-space-surface.md)：下一阶段第一层平台扩展及第二层 UI 接管协议。
- [仓库基线清理](specs/repository-baseline-cleanup.md)：本次从旧服务端产品线收缩到插件优先仓库的批准范围；清理完成后由 Git 保存历史。

`docs/specs/` 只放未完成或仍需验收的变更。实现稳定后，将长期有效的决策合并进 PRD 或技术架构，再删除完成的规范。

