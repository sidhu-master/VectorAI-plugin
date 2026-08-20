# DXF 保真导入与确定性识别设计

日期：2026-08-16

## 目标

第一阶段让维构 AI 能直接导入真实 ASCII DXF，并同时满足两件事：

1. 原文件、嵌套 `BLOCK/INSERT`、未知实体和 CAXA 扩展数据不丢失；
2. 可渲染的二维几何进入 Drawing IR，供画布、事务、AI 和审计共用。

在此基础上，只对无需行业判断的事实做程序化识别。工程语义不确定时必须保留为候选或冲突，不能伪装成已确认结果。

## 三层数据模型

### 1. 不可变源文件

DXF 与配套工程文档按内容哈希保存。源文件是最终保真依据，不随 Drawing IR 编辑而覆盖。

### 2. DXF 保真清单

解析器把 ASCII DXF 保存成可查询清单：

- HEADER 变量与单位；
- model space 实体的原始 group-code/value 对；
- 每个 BLOCK 的定义及原始实体；
- INSERT 的块名、插入点、缩放、旋转、阵列参数；
- 实体 handle、owner、subclass marker；
- 1001 起始的 XDATA 应用段以及 1000–1071 扩展值；
- 不支持实体和未知 group code 的原始记录。

清单不是 Drawing IR，不参与前端日常渲染；它用于审计、回溯、重新解释和未来的 DXF 回写。

### 3. Drawing IR 投影

将当前支持的二维实体投影为 Drawing IR：`POINT`、`LINE`、`CIRCLE`、`ARC`、`ELLIPSE`、`LWPOLYLINE/POLYLINE`、`SPLINE`、`TEXT/MTEXT`、`DIMENSION`。

INSERT 按矩阵递归展开用于画布显示。每个投影节点通过 `evidenceRefs` 保存源文件、实体 handle 和完整 INSERT 路径。递归环和异常深度会停止展开并记录诊断，不影响源文件保真。

`HATCH`、代理对象、CAXA 私有实体等暂不进入可编辑几何，但完整保留在清单中。

## 事务语义

导入是一笔系统事务：

- 默认替换当前画布内容；
- 删除旧节点和创建新节点在一次提交内完成；
- 导入前状态可通过现有 Commit/Revert 机制恢复；
- 解析或校验失败时不提交半成品。

## 确定性识别

### 可直接确认

- DXF 单位和坐标系事实；
- 显式二维图元及其数值；
- 显式文字和尺寸对象；
- BLOCK/INSERT 引用图；
- 图纸整体包围盒、轴向长度；
- 能由几何直接证明的主轴候选；
- 配套文档与几何在比例容差内同时吻合的区域宽度和外径。

### 仅作候选或冲突

- 只由文字命名、但几何无法唯一验证的齿轮/花键/轴承区域；
- 配套文档与图中标注或几何数值不一致的区域；
- 尺寸目标无法唯一绑定的 DIMENSION；
- CAXA XDATA 中尚未有稳定 schema 的工程含义。

### 暂不自动生成

公差、粗糙度、形位公差、基准、配合、齿数和模数等需要工程判断的标注。

## 工程文档匹配

配套 UTF-8 文档按 INI 风格解析。`axis_origin=left_end` 时，以图纸主轴方向最左端作为轴向零点。每个区域生成可审计的 SemanticFeature：

- `confirmed`：位置、宽度和外径与几何一致；
- `candidate`：只有部分字段可验证；
- `conflict`：文档与几何或显式尺寸冲突，属性中保留双方数值和原因。

Drawing IR 当前质量枚举只有 confirmed/candidate，因此冲突节点使用 candidate，并在 `properties.recognitionStatus='conflict'` 中显式表达。

## API 与前端

新增确定性接口：

`POST /api/drawings/:drawingId/imports/dxf`

请求包含 DXF base64、文件名和可选工程文档。它绕过 Agent 路由，返回更新后的 workspace、源文件引用、保真清单摘要、识别结果和诊断。

前端文件选择支持 `.dxf` 和可选 `.txt`。纯 DXF 上传直接进入该接口；图片/PDF 与自然语言仍走现有 Agent 流程。

## 性能与安全边界

- 默认单文件 20 MB；
- 原始 pair 扫描和清单构建为线性复杂度；
- INSERT 最大递归深度和最大展开节点数可配置；
- 首个可用响应不等待模型；
- 文件名只作为展示元数据，不参与路径拼接；
- 所有 ID 从源哈希、handle 与 INSERT 路径稳定派生，便于回归。

## 验收基准

使用项目中的 `初始图.dxf`、`样本图001.dxf` 和配套工程文档验证：

- 原始文件哈希一致；
- 样本图的嵌套 BLOCK/INSERT 可遍历且展开图元可见；
- CAXA XDATA 原始组码可查询；
- 初始图基础几何完整进入 Drawing IR；
- B01 等确定区域得到 confirmed，G01 数值冲突不得被错误确认为真；
- 导入事务可撤销；
- 前端可以上传并看到结果。
