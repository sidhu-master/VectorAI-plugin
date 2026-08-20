# DXF 保真导入与确定性识别实施计划

> 对应设计：`docs/superpowers/specs/2026-08-16-lossless-dxf-import-and-deterministic-recognition-design.md`

## 1. 保真源数据与清单

- 扩展 SourceArtifact MIME，支持 DXF 与 UTF-8 文本。
- 先写失败测试，覆盖源文件哈希、DXF group pair、SECTION、BLOCK、INSERT、XDATA 和未知实体保留。
- 实现线性 ASCII DXF 扫描器与本地 manifest store。

## 2. Drawing IR 投影

- 先写失败测试，覆盖基础实体映射、角度、bulge、样条、文字/尺寸以及嵌套 INSERT 矩阵。
- 实现递归块展开、稳定 ID、evidenceRefs 和保护阈值。
- 不支持实体只进入清单和诊断，不伪造几何。

## 3. 确定性识别

- 先写失败测试，覆盖工程文档解析、轴向基准、已确认区域和冲突区域。
- 生成来源特征、主轴特征、区域 SemanticFeature 以及少量可证明尺寸。
- 保持粗糙度、公差、GD&T 等为未决项。

## 4. 原子导入服务与 API

- 先写失败测试，覆盖保存源文件、保存清单、单事务替换、失败不提交和响应摘要。
- 实现 `DxfImportCoordinator`。
- 接入 `POST /api/drawings/:drawingId/imports/dxf` 和统一错误映射。

## 5. 前端上传与呈现

- 先写失败测试，覆盖 `.dxf` 文件卡、可选 `.txt`、确定性接口调用和 workspace 更新。
- 扩展 DrawingClient、store 和 AIDialog，不改变图片/PDF Agent 流程。
- 在聊天中显示真实文件名和导入摘要，不伪装成用户命令。

## 6. 真实样本回归

- 对三份真实文件运行解析和识别快照测试。
- 运行相关单测、全量 TypeScript 检查和生产构建。
- 启动本地服务，用浏览器完成上传、画布渲染和撤销验收。
- 输出可确认、待确定、冲突三类结果与剩余边界。
