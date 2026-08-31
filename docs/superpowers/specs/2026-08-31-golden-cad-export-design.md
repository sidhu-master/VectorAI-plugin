# 黄金样本等价 CAD 导出设计

## 目标

第二层插件导出的 DXF 必须以 `packages/engineering-annotation/test/fixtures/golden-shaft-001/target.dxf` 为 CAD 制图格式 Oracle。验收对象是 CAD 文件本身，而不是 DSH 画布截图：实体类型、图层、颜色、线型、线宽、文字样式、尺寸样式、箭头、符号块和标注布局规则必须与黄金样本采用同一套规范。

DSH 画布继续服务于选择、拖动、显隐和确认等交互，可以使用更适合屏幕操作的颜色和控件，不要求与最终 DXF 像素一致。

## 已确认的根因

现有导出器是一个轻量 DXF writer。它能够输出可解析的 AC1027 文件，但自行创建了简化图层表、三个简化 DIMSTYLE 和简化尺寸图元块。因此它满足“文件合法”，不满足“黄金样本 CAD 格式等价”。

实测差异包括：

- 黄金样本的 `GB_LINEAR/GB_ANGULAR/GB_RADIAL` 使用 3.5 mm 文字、3.5 mm 箭头、1.0 mm 延伸和 1.5 mm 文字间隙；当前导出使用 2.5/2.5/1.25/0.625。
- 黄金样本尺寸文字颜色由 `DIMCLRT=3` 控制，尺寸实体位于 `7标注层`；当前样式颜色为 0，视觉层级不同。
- 黄金样本将轴径表达为线性 DIMENSION 加 `%%C` 前缀；当前错误地使用 diametric DIMENSION。
- 黄金样本尺寸图元块由 LINE、ARC、HATCH 箭头、MTEXT 和必要 INSERT 组成；当前块只有 LINE/LWPOLYLINE/TEXT，缺失国标箭头与文字排版。
- 黄金样本具有完整图层线宽和标准文字样式；当前图层线宽为默认值，只有一个 `STANDARD/txt` 样式。
- 黄金样本的基准、形位公差和粗糙度使用标准符号块；当前使用临时 `*VAI` 图形块。
- 当前尺寸链布局按屏幕预览的避让结果直接外推，造成尺寸线过高、间距松散；CAD 导出应使用独立的纸面布局策略。

## 架构

### 1. CAD 标准配置与黄金样本隔离

生产代码新增 `GbCadExportProfile`，显式保存从黄金样本归纳出的通用国标制图配置：

- AC1027、毫米单位；
- 图层名称、ACI 颜色、线型和线宽；
- `Standard/标准/SLDTEXTSTYLE*/ZWISOGDT` 等必要文字样式；
- `GB_LINEAR/GB_DIAMETER/GB_RADIAL/GB_ANGULAR/GB_LEADER` 等尺寸样式；
- 闭合实心箭头、基准、形位公差框和粗糙度符号的通用块规范。

生产代码不得读取 `target.dxf`，不得包含样本文件名、样本坐标或黄金数值。`target.dxf` 只在测试中作为 Oracle。这样既保证通用性，也避免把一张样本图当作运行时模板。

### 2. 语义与 CAD 表达分离

工程算法继续产生 `DrawingDocument + EngineeringAnnotationDraft`：目标几何、标称值、公差状态、基准、形位公差、尺寸链和用户拖动后的世界坐标。

新的 CAD 投影器把这些语义映射为纸面实体：

- 轴径：`AcDbAlignedDimension + AcDbRotatedDimension`，文字覆盖使用 `%%C<>`；
- 轴向尺寸：`GB_LINEAR`；
- 开角：`AcDb2LineAngularDimension + GB_ANGULAR`；
- 圆角：`AcDbRadialDimension + GB_RADIAL`；
- 基准、形位公差、粗糙度和工艺说明：标准 INSERT/MTEXT/LINE/HATCH 块；
- 剖面：保留原始 HATCH 语义和边界，不重新离散成斜线。

算法数值和 CAD 样式互不耦合。缺少公差数值来源时仍可显示“待计算”，但框格、字体、连接线、图层和颜色必须符合黄金样本。

### 3. 独立 CAD 纸面布局

DXF 不复用 DSH 屏幕坐标缩放结果。CAD 布局器以模型单位工作：

- 图形主体保持原始世界坐标和比例；
- 直径尺寸按左右端及轴段分组，文字位于尺寸线旁；
- 轴向尺寸链在零件上方按链分层，使用黄金样本的紧凑间距；
- 开角放在端部外侧；
- 基准与形位公差优先放在外轮廓周围，用正交折线连接；
- 用户手动拖动过的标注位置优先于自动布局，但仍投影为相同 CAD 样式。

### 4. DXF 写入边界

`drawing-core` 的 writer 只负责完整合法的 DXF 结构和通用 CAD 实体。黄金样本样式配置、工程标注映射和纸面布局位于 `plugin-dsh-annotation-host`，避免第一层二维空间被轴类工程规则污染。

`acad-ts` 继续作为导出后的句柄、owner、collection 和 OBJECTS 修复器；它不是样式来源。

## 验收标准

### 结构等价

黄金夹具导出必须满足：

- AC1027，`$INSUNITS=4`；
- 标准图层的名称、ACI 颜色、线型和线宽与黄金样本一致；
- `GB_LINEAR/GB_ANGULAR/GB_RADIAL` 的关键 DIMSTYLE 字段逐项一致；
- 轴径、轴向尺寸、角度和半径使用与黄金样本相同的 DIMENSION 类型；
- 尺寸图元块含 MTEXT 与 HATCH 实心箭头，不以普通 TEXT 代替；
- 基准和形位公差使用 `8符号标注层`，尺寸使用 `7标注层`，中心线、剖面线分别使用对应图层；
- `ezdxf.audit()` 为 0 error/0 fix，`acad-ts` 能 restore handles 并 update collections。

### 视觉等价

在 CAD 中以相同模型范围执行 Zoom Extents 后，对照黄金样本逐类检查：

- 颜色、字体高度、箭头大小和方向；
- 延长线超出量、文字间隙与尺寸间距；
- 直径符号、角度弧线、半径箭头；
- 基准三角、形位公差框和正交引线；
- 剖面 HATCH 的角度、间距和裁剪边界。

允许标注内容因算法输入、公差计算状态和用户编辑而不同；不允许 CAD 表达方式因 DSH 预览实现而不同。

## 非目标

- 不要求 DSH 画布与 CAD 像素一致。
- 不把黄金样本坐标、标注数值或样本文件加载到生产运行时。
- 不在本任务中发明尚无数据来源的公差数值。
- 不修改 DSH 源码。
