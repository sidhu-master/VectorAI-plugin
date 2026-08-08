# VectorAI 2D CAD 与图纸感知基础设计

**日期：** 2026-08-08  
**状态：** 待用户书面确认  
**范围：** 二维 CAD 显式图元、关联式尺寸、角色化模型路由、通用图纸拆解、尺寸 OCR 与归属

## 1. 背景与目标

VectorAI v0.1 已具备 SpatialPatch、SpatialCommit、Undo/Redo、Agent Runtime、SSE 进度、本地审计、图片/PDF 输入和基础 Point/Line/Circle 模型。`test1.jpg` 的真实回归证明运行控制和审计链路有效，同时暴露了三个基础缺口：图元不足以表达常见二维 CAD，整图执行步骤过大，以及图形识别和尺寸 OCR/归属耦合在一次视觉调用中。

本设计的目标是建立可扩展但边界明确的二维 CAD 基础：

- 使用显式 CAD 图元，保留工程参数与可编辑语义。
- 支持文字和关联式尺寸标注。
- 使用与具体物体无关的“视图—拓扑—关联”拆图方法。
- 将几何观察、标注 OCR、尺寸归属和 SpatialPatch 构建拆成独立工具。
- 所有携带图片或裁剪图的模型调用默认使用 `doubao-seed-2.0-lite`。
- 保持增量提交、低置信度标红、可审计和可确定性回放。

## 2. 明确不做

首版不实现：

- 任何 3D 实体、曲面、网格、B-Rep 或 STEP。
- 图层、图块、外部引用和属性块。
- Hatch、渐变填充和材质。
- DWG 原生读写。
- 约束求解器；首版只记录和验证关系。
- 富文本排版、复杂字体替换和打印样式表。
- 建筑、机械等领域专用 Planner；领域语义只作为可选 Semantic Layer 数据。

## 3. 核心设计原则

1. **显式而非离散化：** 圆、圆弧、椭圆和样条保留原生参数，不默认打散为线段。
2. **几何与标注分离：** 尺寸和文字是 Annotation Entity，不混入轮廓拓扑。
3. **观察与模型分离：** Vision 先生成带证据与置信度的 Observation，不直接修改 SpatialModel。
4. **关联优先：** Dimension 引用实体锚点；无法唯一归属时保留候选，不猜测绑定。
5. **局部提交：** 每个拓扑组件或有限实体批次形成独立 SpatialCommit。
6. **媒体临时化：** 原图和裁剪图只存在于运行期附件缓存，不进入公开状态、热上下文或审计正文。
7. **协议独立于 DXF 版本：** Spatial Protocol 保存设计语义，各 Representation Adapter 负责降级或报错。

## 4. 二维 CAD 图元协议

协议版本从 `0.1` 升级为 `0.2`。坐标使用二维笛卡尔坐标；角度统一使用度数，零度沿正 X 轴，逆时针为正。方向向量进入模型前必须归一化。

### 4.1 公共字段

```ts
interface BaseEntity {
  id: string;
  type: EntityType;
  visible: boolean;
  parentId?: string;
  group?: string;
  confidence?: number; // 0-1；低于 0.6 在 UI 标红
}
```

`confidence` 是实体级事实；SpatialCommit 仍保留提交级 confidence。媒体证据只以 Observation ID 或裁剪区域坐标间接关联，不将 base64 写入实体。

### 4.2 几何实体

```ts
type EntityType =
  | 'point' | 'line' | 'ray' | 'xline'
  | 'circle' | 'arc' | 'ellipse'
  | 'polyline' | 'spline'
  | 'text' | 'dimension';

interface PointEntity extends BaseEntity {
  type: 'point';
  x: number;
  y: number;
}

interface LineEntity extends BaseEntity {
  type: 'line';
  start: Vec2;
  end: Vec2;
}

interface RayEntity extends BaseEntity {
  type: 'ray';
  origin: Vec2;
  direction: Vec2;
}

interface XLineEntity extends BaseEntity {
  type: 'xline';
  origin: Vec2;
  direction: Vec2;
}

interface CircleEntity extends BaseEntity {
  type: 'circle';
  center: Vec2;
  radius: number;
}

interface ArcEntity extends BaseEntity {
  type: 'arc';
  center: Vec2;
  radius: number;
  startAngle: number;
  endAngle: number;
  counterClockwise: boolean;
}

interface EllipseEntity extends BaseEntity {
  type: 'ellipse';
  center: Vec2;
  majorAxis: Vec2;
  ratio: number;       // minorRadius / majorRadius，范围 (0, 1]
  startParam?: number; // 缺省表示完整椭圆
  endParam?: number;
}

interface PolylineVertex {
  point: Vec2;
  bulge?: number; // tan(includedAngle / 4)，0 或缺省为直线段
}

interface PolylineEntity extends BaseEntity {
  type: 'polyline';
  vertices: PolylineVertex[];
  closed: boolean;
}

interface SplineEntity extends BaseEntity {
  type: 'spline';
  degree: number;
  controlPoints: Vec2[];
  knots: number[];
  weights?: number[];
  closed: boolean;
  periodic: boolean;
}
```

矩形、正多边形、槽、圆角矩形不是底层 EntityType。它们属于创建命令或 Semantic Feature，编译后产生 Polyline、Line 和 Arc，同时可在 `semanticEntities` 中保留“rectangle”“slot”等设计意图。

### 4.3 文字

```ts
interface TextEntity extends BaseEntity {
  type: 'text';
  content: string;
  position: Vec2;
  height: number;
  rotation: number;
  alignment: 'left' | 'center' | 'right';
  verticalAlignment: 'baseline' | 'bottom' | 'middle' | 'top';
  maxWidth?: number; // 存在时为多行文字
}
```

首版不保存富文本 run；换行使用 `content` 中的 `\n`。

### 4.4 关联式尺寸

```ts
type DimensionKind =
  | 'linear' | 'aligned' | 'angular'
  | 'radius' | 'diameter' | 'ordinate' | 'arc-length';

type EntityAnchor =
  | { kind: 'start' | 'end' | 'center' }
  | { kind: 'vertex'; index: number }
  | { kind: 'curve-parameter'; parameter: number }
  | { kind: 'nearest'; point: Vec2 };

interface DimensionTarget {
  entityId: string;
  anchor: EntityAnchor;
}

interface DimensionCandidate {
  targets: DimensionTarget[];
  score: number;
  reasons: string[];
}

interface DimensionTolerance {
  upper?: number;
  lower?: number;
}

interface DimensionEntity extends BaseEntity {
  type: 'dimension';
  dimensionKind: DimensionKind;
  associationStatus: 'resolved' | 'ambiguous' | 'conflict';
  targets: DimensionTarget[];
  candidates?: DimensionCandidate[];
  observedValue?: number; // OCR 从图纸标注读取的值
  computedValue?: number; // 根据关联几何实时计算的值
  displayText?: string;
  unit?: 'mm' | 'cm' | 'm' | 'deg';
  tolerance?: DimensionTolerance;
  prefix?: string;
  suffix?: string;
  textPosition: Vec2;
  definitionPoints: Vec2[];
}
```

- `resolved` 必须具有满足尺寸类型要求的 targets。
- `ambiguous` 可以没有最终 targets，但必须保留至少两个候选或明确的低置信度原因。
- `conflict` 表示 OCR 值、测量值或已有约束互相矛盾，不修改关联几何。
- 几何变化后重新计算 `computedValue` 并与 `observedValue` 比较；显示覆盖文本不替代这两个工程值。

## 5. Patch、验证和表示层

现有 `entity.add/update/delete` 操作保持不变，但 EntityPatch 改为按 `EntityType` 区分的类型安全联合。更新操作不得改变实体 type；类型变化使用 delete + add。

Validator 增加：

- Ray/XLine 方向向量非零且规范化。
- Arc 半径大于零、角度有限；完整圆必须使用 Circle。
- Ellipse majorAxis 非零、ratio 在 `(0, 1]`。
- Polyline 至少两个顶点；闭合轮廓至少三个顶点；bulge 必须有限。
- Spline 的 degree、控制点、knots、weights 数量与单调性一致。
- Text 高度大于零且内容非空。
- Dimension 的 targets 存在、锚点适用于实体类型、候选得分在 `[0,1]`。

SVG Renderer 为每种显式图元增加原生或等价 path 表示。DXF Adapter 保留结构化映射：POINT、LINE、RAY、XLINE、CIRCLE、ARC、ELLIPSE、POLYLINE/LWPOLYLINE、SPLINE、TEXT/MTEXT 和 DIMENSION。目标 DXF 版本不支持某实体时 Adapter 必须明确降级并产生 warning，不在 Core 中静默离散化。

## 6. 角色化模型路由

```ts
interface AgentModelProfile {
  planner?: string;
  vision: string;
  executor?: string;
  repair?: string;
}
```

默认路由：

- Planner、Vision、Executor、普通验证错误修正和总结默认均使用 `doubao-seed-2.0-lite`。
- `repair` 默认使用 `doubao-seed-2.1-turbo`，但只允许在一次模型结果明确给出 `confidence < 0.6` 后触发；普通 JSON 或几何验证失败不得升级模型。
- 请求体可覆盖角色模型；覆盖值按原样传给兼容服务端。
- Audit manifest 和模型调用事件记录 role、model、startedAt、durationMs、attempt、status，不记录 prompt 原文、令牌或媒体正文。

Agent Runtime 保存本次 `AgentModelProfile`，GatewayPlannerAdapter 和 GatewayExecutorAdapter 不再依赖一个隐式全局模型。低置信度升级最多一次，并可携带原图或局部裁剪调用 Turbo；若 Turbo 调用失败、输出无效或仍为低置信度，则保留最后一个几何有效的 Lite 结果并以红色提交，不阻塞其他组件。

## 7. 通用图纸拆解

拆解不按页面从上到下，也不使用“头、脚、门、窗”等对象名称作为运行阶段。统一流程如下：

1. **normalize_drawing**：方向、分辨率、背景、PDF 页和裁剪缓存。
2. **analyze_sheet**：单位、比例、图框、标题栏、单视图/多视图。
3. **segment_views**：主视图、剖视图、局部详图、独立尺寸密集区；每个视图建立坐标变换。
4. **detect_datums**：中心线、对称轴、基准线、原点候选和整体边界。
5. **detect_geometry**：输出显式图元候选、端点、交点、切点和证据区域。
6. **extract_annotations**：并行提取文字、尺寸、符号、公差、箭头和引线。
7. **build_topology**：连接端点、闭合轮廓、内部负空间、重复特征和独立连接组件。
8. **associate_dimensions**：建立标注与几何锚点的候选图，解析唯一归属。
9. **build_spatial_patches**：按拓扑组件和实体预算形成局部 Commit。
10. **verify_drawing**：闭合、重复、悬空标注、尺寸冲突、相切/对称/共线关系验证。

重建顺序是主闭合轮廓、内部孔槽与负空间、重复特征、独立连接组件、构造几何、文字和尺寸。建筑平面图可将墙线视为连接组件、门窗视为开口特征，但 Agent 阶段不改变。

## 8. Observation 与 OCR/归属接口

```ts
interface GeometryObservation {
  id: string;
  viewId: string;
  type: Exclude<EntityType, 'text' | 'dimension'>;
  imageBounds: [number, number, number, number];
  measuredParams: Record<string, unknown>;
  confidence: number;
}

interface AnnotationObservation {
  id: string;
  viewId: string;
  kind: DimensionKind | 'text';
  rawText: string;
  value?: number;
  unit?: string;
  tolerance?: DimensionTolerance;
  imageBounds: [number, number, number, number];
  arrowheads: Vec2[];
  confidence: number;
}

interface DimensionAssociation {
  annotationId: string;
  targets: Array<{
    geometryObservationId: string;
    anchor: EntityAnchor;
  }>;
  score: number;
  reasons: string[];
  status: 'resolved' | 'ambiguous' | 'conflict';
}
```

归属先使用确定性评分：箭头接触、引线相交、距离、方向、共线、尺寸符号和可测量类型。仅当最高候选与次高候选分差小于配置阈值时，调用视觉模型处理包含局部裁剪和有限候选的歧义任务。

Observation 保存图片坐标和裁剪哈希，不保存裁剪正文。Observation 可写入独立本地调试记录，但只有经过编译与验证的 Entity 才进入 SpatialCommit。

## 9. Agent 集成与性能预算

- HTTP accepted 继续要求小于 1 秒。
- 活跃运行每 25 秒发送 heartbeat，保证 30 秒内有可见回执。
- 全图只用于 analyze_sheet、segment_views 和必要的全局验证。
- detect_geometry 和 extract_annotations 使用视图或局部裁剪缓存。
- 单个 build_spatial_patches 批次最多 25 个实体；超出时按拓扑组件继续分批。
- 每个工具产生结构化 Receipt：输入引用、输出数量、低置信度数量、耗时、warning 和 needReplan。
- 单个视觉阶段共享 deadline；超时只暂停或失败当前组件，不提交部分 Patch。
- OCR、归属和审计写入不阻塞模型关键路径。

## 10. 错误和低置信度策略

- GeometryObservation 或执行结果低于 0.6：先对同一局部上下文使用 `doubao-seed-2.1-turbo` 升级一次；Turbo 失败、无效或仍低置信度时，使用最后一个几何有效结果形成独立的红色候选实体 Commit，并保持实体 confidence；不得用模型猜测补齐缺失的关键参数。
- Dimension `ambiguous`：以红色未解析尺寸存在，不绑定猜测目标。
- Dimension `conflict`：产生验证事件，不修改几何。
- 不支持的图元：Capability Registry 不向模型暴露该创建工具；返回结构化 `UNSUPPORTED_ENTITY_TYPE`。
- Adapter 无法无损导出：返回 warning 和明确降级记录。
- 任一 Patch 原子验证失败：整个 Commit 拒绝，最多修正两次后暂停对应组件。

## 11. 兼容与迁移

- `0.1` Point/Line/Circle 数据在 `0.2` 中保持字段兼容。
- `createEmptyModel()` 默认创建 `0.2`；读取 `0.1` 时执行纯数据迁移，不生成 Commit。
- 现有审计回放依据 manifest 中的 protocolVersion 选择验证器。
- 旧 AI Intent 继续可编译；新增类型逐项加入 Intent Validator、Compiler 和 Patch Validator。
- DXF R12 Adapter 可先支持其原生子集；完整显式图元由后续更高版本 Adapter 输出。

## 12. 测试策略

1. 每种图元拥有 Intent 编译、模型验证、Patch add/update/delete、inverse Patch 和回放测试。
2. 每种图元拥有 SVG 表示和 DXF 映射黄金样例。
3. Dimension 覆盖 resolved、ambiguous、conflict、几何修改后重测量和悬空引用。
4. 模型路由测试证明所有带图调用使用 `doubao-seed-2.0-lite`，请求覆盖能透传，纯文本角色不被误改。
5. Drawing Pipeline 使用录制响应验证视图分割、几何观察、OCR、候选评分和局部重试。
6. `test1.jpg` 作为本地黄金样例，首个验收目标是稳定提取主要 Circle/Line/Arc、尺寸观察及候选关联，而非一次生成整图。
7. 性能测试使用假时钟验证 25 秒 heartbeat；录制响应验证单批实体上限和媒体复用。

## 13. 分批交付

本设计拆为三个可独立验收的实施计划：

1. **模型路由与可观测性**：AgentModelProfile、`doubao-seed-2.0-lite` 透传、模型调用审计和回归。
2. **二维 CAD Core v0.2**：显式图元、关联式尺寸、Patch、Validator、SVG、DXF 和迁移。
3. **Drawing Perception Pipeline**：视图/拓扑拆解、GeometryObservation、AnnotationObservation、尺寸 OCR、确定性归属和 Agent 分批提交。

执行顺序为 1 → 2 → 3。第三批只依赖前两批的稳定接口，不在感知代码中临时发明图元结构。
