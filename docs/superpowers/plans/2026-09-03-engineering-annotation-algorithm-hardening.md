# 工程标注算法行业化改进 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把第二层插件从“能复现当前样本的启发式标注”升级为“由几何、工程语义和标准数据共同驱动，证据不足时主动询问，且能在通用图纸上稳定工作的工程标注系统”。

**Architecture:** 将整条链路分为几何事实、工程语义、设计决策、标注表达和 CAD 导出五层。国家/国际标准只约束适用范围、符号语义和表达格式；功能、公差值、基准优先级和闭环选择必须由文档、装配/工艺上下文或用户确认提供。黄金样本仅作为黑盒输出 Oracle，并使用旋转、镜像、缩放、尺寸变异和非黄金零件证明算法没有过拟合。

**Tech Stack:** TypeScript 5.8、Vitest、React 18、Labella/VPSC、`@node-projects/acad-ts`、VectorAI Drawing Core、DSH 插件 Host/Client。

**Spec:** `docs/prd.md`、`docs/tech-architecture.md`，以及本计划“标准与决策边界”一节。

## Global Constraints

- 生产代码不得读取或识别黄金样本文件名、drawing ID、哈希、固定坐标、固定尺寸、固定分区名或期望标注集合。
- 黄金样本只可位于测试夹具和验证脚本中；必须同时通过至少一个非黄金轴类夹具和变形测试。
- 模型负责语义分类与设计意图补充；确定性算法负责坐标、拓扑、数值、约束、排版与事务。
- 标准规定“如何表达”时，代码不得把它扩大解释为“必须选择哪个基准、公差、粗糙度或闭环尺寸”。
- 缺少功能、装配、工艺或文档依据时，结果必须是 `needs-user-input`，不能静默生成看似正式的标注。
- 手工调整位置必须保持为世界坐标语义偏移，重绘、缩放、切换会话和再次标注不得丢失。
- 每个里程碑独立提交、独立验收；上一里程碑未通过，不开始下一项。
- 发布或交给 DSH 测试前必须重建插件，并证明 `src` 与实际加载的 `lib` 同步。

## 标准与决策边界

| 领域 | 标准负责 | 系统仍需的工程依据 |
| --- | --- | --- |
| 尺寸表达 | GB/T 4458.4、ISO 129-1：尺寸线、界线、箭头、文字和基本表示 | 应标哪些尺寸、哪段闭环、加工/检验基准 |
| 线性尺寸公差 | GB/T 1800、ISO 286、ISO 14405-1：适用特征、公差代号和极限偏差 | 配合类型、功能等级、最终公差带选择 |
| 基准与形位公差 | GB/T 1182、ISO 1101、ISO 5459：符号、受控对象、基准体系和公差区解释 | 哪个表面是主/次/第三基准、控制类型和数值 |
| 表面粗糙度 | GB/T 131、GB/T 1031、ISO 21920-1：符号、参数和推荐值表达 | 加工方法、功能表面、Ra/Rz 数值和是否去除材料 |
| DXF | AutoCAD DXF 实体规范：DIMENSION、TOLERANCE、LEADER、HATCH 等结构 | 目标 CAD 兼容 profile、图层命名、ACI 颜色和字体配置 |

---

### Task 1: 锁定实际运行产物，消除 `src/lib` 漂移

**Files:**
- Modify: `scripts/build-dsh-space.mjs`
- Modify: `scripts/prepare-dsh-plugin-release.mjs`
- Create: `scripts/check-dsh-build-freshness.mjs`
- Modify: `package.json`
- Test: `scripts/check-dsh-build-freshness.test.ts`

**Interfaces:**
- Consumes: Host/Client 的 `src`、构建后的 `lib` 和插件 manifest。
- Produces: `pnpm check:dsh-build-freshness`；产物过期时非零退出并列出不同步包。

- [x] **Step 1: 写失败测试**

  构造临时包，先写入源码并生成构建 manifest，再修改源码；断言 freshness checker 返回 `DSH_BUILD_STALE`。另测未修改源码返回成功。

- [x] **Step 2: 验证测试失败**

  Run: `pnpm vitest run scripts/check-dsh-build-freshness.test.ts`

- [x] **Step 3: 实现内容摘要校验**

  构建时为所有参与打包的 `src`、资源和 package manifest 生成稳定 SHA-256 摘要，写入 `lib/.vectorai-build.json`。检查器重新计算摘要，不比较文件时间。

- [x] **Step 4: 接入构建、启动前检查与发布流程**

  `build:dsh-annotation` 成功后更新 manifest；`pack:dsh-plugins` 和发布流程先执行 freshness check。开发启动发现过期产物时明确失败，不允许静默加载旧 `lib`。

- [x] **Step 5: 验证（按当前要求暂不提交）**

  Run: `pnpm vitest run scripts/check-dsh-build-freshness.test.ts && pnpm build:dsh-annotation && pnpm check:dsh-build-freshness`

  Commit: `build: prevent stale dsh plugin artifacts`

**验收标准:** 修改任意宿主或客户端源码但不构建时，插件不能被打包或误判为最新版本。

---

### Task 2: 建立工程决策权限边界，停止无依据自动标注

**Files:**
- Modify: `packages/plugin-dsh-annotation-host/src/shaft-gdt-rules.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/gdt-reviewer.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/auto-annotation-route.ts`
- Modify: `packages/engineering-annotation/src/gdt/types.ts`
- Test: `packages/plugin-dsh-annotation-host/src/shaft-gdt-rules.test.ts`
- Test: `packages/plugin-dsh-annotation-host/src/gdt-reviewer.test.ts`

**Interfaces:**
- Consumes: 已确认功能分区、文档要求、人工要求、配合和工艺证据。
- Produces: `resolved | needs-user-input` 的基准、形位公差和粗糙度候选，每个候选带 `evidenceIds`、`ruleRef` 和 `decisionAuthority`。

- [x] **Step 1: 写反例测试**

  仅给两个 `bearing-seat` 几何分类，不提供设计要求；断言不再自动生成圆度、圆柱度、跳动和 `Ra 0.8`，而是返回需要确认的问题。

- [x] **Step 2: 写有依据的正例测试**

  提供“两个轴承位共同建立旋转基准轴”“齿轮工作圆柱面要求总跳动”“轴承配合面 Ra 0.8”的独立证据；断言只生成被证据支持的三项结果。

- [x] **Step 3: 删除一刀切规则**

  移除 `supports.map(... value: 0.8)`、对所有支承面统一生成圆度/圆柱度/全跳动、对所有旋转功能面统一生成圆跳动的路径。

- [x] **Step 4: 引入决策权限字段**

  使用 `standard-expression | deterministic-geometry | documented-requirement | ai-recommendation | user-confirmed`。只有后三类能够确定设计控制和数值；AI 推荐未确认时不得进入正式图纸。

- [x] **Step 5: 验证（按当前要求暂不提交）**

  Run: `pnpm vitest run packages/plugin-dsh-annotation-host/src/shaft-gdt-rules.test.ts packages/plugin-dsh-annotation-host/src/gdt-reviewer.test.ts`

  Commit: `fix: require evidence for gdt and surface decisions`

**验收标准:** 同一几何轴承位在无功能文档时不会产生正式形位公差或粗糙度；黄金样本要求只有通过证据输入才可恢复。

---

### Task 3: 统一轴局部坐标和受控轮廓拓扑

**Files:**
- Create: `packages/engineering-annotation/src/shaft/coordinate-frame.ts`
- Create: `packages/engineering-annotation/src/shaft/contour-topology.ts`
- Modify: `packages/engineering-annotation/src/shaft/axis.ts`
- Modify: `packages/engineering-annotation/src/shaft/profile.ts`
- Modify: `packages/engineering-annotation/src/shaft/steps.ts`
- Test: `packages/engineering-annotation/src/shaft/coordinate-frame.test.ts`
- Test: `packages/engineering-annotation/src/shaft/contour-topology.test.ts`
- Test: `packages/engineering-annotation/src/shaft/shaft-analysis.test.ts`

**Interfaces:**
- Produces: `ShaftCoordinateFrame { origin, axis, normal, toLocal(point), toWorld(z, r) }`。
- Produces: `ShaftContourTopology { positiveProfile, negativeProfile, stations, transitions, confidence, evidenceIds }`。

- [x] **Step 1: 写旋转、镜像和缩放不变性测试**

  对同一非黄金轴图分别旋转 90°、镜像和缩放 10 倍；断言局部站点、半径和拓扑关系一致。

- [x] **Step 2: 写图层污染测试**

  向图纸加入尺寸线、文字轮廓、中心线和剖面线；断言它们不进入轴外轮廓和台阶候选。

- [x] **Step 3: 实现局部坐标和实体角色过滤**

  先按 layer/role/entity type 排除 annotation、hatch、centerline、construction geometry，再在局部坐标中构造轮廓。

- [x] **Step 4: 构造轮廓图并折叠过渡原语**

  连续线、圆弧、样条离散段形成有序 contour graph；把短倒角、圆角和退刀槽作为 transition 连接相邻稳定圆柱区，避免它们制造虚假主台阶。

- [x] **Step 5: 替换未校准单分数判断**

  台阶置信度至少组合轮廓连续性、正负侧对应、轴向驻留长度、半径变化和实体质量；阈值集中放入版本化 policy，并记录各项贡献。

- [x] **Step 6: 验证（按当前要求暂不提交）**

  Run: `pnpm vitest run packages/engineering-annotation/src/shaft`

  Commit: `refactor: derive shaft features in a local contour frame`

**验收标准:** 图纸旋转、镜像、缩放或增加标注图层后，轴线、台阶和稳定圆柱段不变化。

---

### Task 4: 修正连续轴段与功能分区语义

**Files:**
- Modify: `packages/engineering-annotation/src/partition/analyze.ts`
- Modify: `packages/engineering-annotation/src/partition/fuse.ts`
- Modify: `packages/engineering-annotation/src/partition/regular.ts`
- Modify: `packages/engineering-annotation/src/partition/types.ts`
- Test: `packages/engineering-annotation/src/partition/fuse.test.ts`
- Test: `packages/engineering-annotation/src/partition/semantic.test.ts`
- Create: `packages/engineering-annotation/src/partition/generalization.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `ShaftContourTopology`。
- Produces: 始终连续的 `axialSegments` 与允许间隙/重叠语义的 `functionalRegions`，两者不可互相替代。

- [x] **Step 1: 写分区语义反例**

  功能区域之间存在过渡间隙时，断言基础轴段连续，但功能区域保持稀疏，不自动扩张到填满间隙。

- [x] **Step 2: 写文档冲突测试**

  文档宽度、直径或端点与几何不一致时，断言保留 `conflict` 和双方证据，不直接改写几何边界。

- [x] **Step 3: 把融合评分改为可解释特征**

  分别记录 station、width、diameter、topology 和 document identity 的误差；禁止只用一个加权总分吞掉关键冲突。

- [x] **Step 4: 移除固定 5%“常规区域”结论**

  未分类间隙保持 `ordinary-candidate`；只有几何稳定且无功能证据时才可成为普通轴段，并保留推断来源。

- [x] **Step 5: 验证（按当前要求暂不提交）**

  Run: `pnpm vitest run packages/engineering-annotation/src/partition`

  Commit: `fix: separate axial decomposition from functional regions`

**验收标准:** 功能分区可以有间隙；文档与几何冲突时不会被阈值静默合并。

---

### Task 5: 修复直径特征的连通性和适用范围

**Files:**
- Modify: `packages/engineering-annotation/src/diameter/measure.ts`
- Modify: `packages/engineering-annotation/src/diameter/types.ts`
- Test: `packages/engineering-annotation/src/diameter/measure.test.ts`
- Modify: `packages/engineering-annotation/src/diameter/layout.test.ts`

**Interfaces:**
- Consumes: Task 3 的稳定圆柱面和局部坐标。
- Produces: 每个独立圆柱面的 `DiameterFact`，包含连续 z 区间、内/外径分类、关联轮廓和测量精度。

- [x] **Step 1: 写断开同直径反例**

  两个同为最大外径、但中间隔着较小直径的轴段必须输出两个事实，不能生成跨越间隙的假区间。

- [x] **Step 2: 写内外径与局部剖面测试**

  内孔、外圆、非对称局部剖面和重复同径段分别验证受控几何与标注位置。

- [x] **Step 3: 按 contour component 和连续区间分组**

  删除“最大半径不分段”特例；任何同径聚类都必须再次按轴向连续性、上下轮廓对应关系和拓扑 component 分割。

- [x] **Step 4: 移除过早的两位小数取整**

  几何事实保留原始精度和测量不确定度；显示层根据文档单位、尺寸样式和公差决定小数位。

- [x] **Step 5: 验证（按当前要求暂不提交）**

  Run: `pnpm vitest run packages/engineering-annotation/src/diameter`

  Commit: `fix: preserve independent cylindrical diameter features`

**验收标准:** 不连续同径段不会合并，标注锚点始终落在真实受控圆柱区间内。

---

### Task 6: 将开角识别迁移到轴局部坐标

**Files:**
- Modify: `packages/engineering-annotation/src/opening-angle/measure.ts`
- Modify: `packages/engineering-annotation/src/opening-angle/select.ts`
- Modify: `packages/engineering-annotation/src/opening-angle/layout.ts`
- Test: `packages/engineering-annotation/src/opening-angle/opening-angle.test.ts`
- Create: `packages/engineering-annotation/src/opening-angle/transform-invariance.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `ShaftCoordinateFrame` 和 contour transitions。
- Produces: 与世界坐标方向无关的轴端开角事实。

- [x] **Step 1: 写 0°、90°、任意角旋转测试**

  对同一开角图元分别旋转，断言角度、左右端语义、受控线段和抑制结果不变。

- [x] **Step 2: 替换全局 X/Y 判断**

  全部端点、镜像、斜率、交点、左右端判断使用 `(z,r)`；只在生成绘图点时调用 `toWorld`。

- [x] **Step 3: 把“几何检测”和“是否应标”分开**

  检测层输出全部可信开角；选择层只提升有轴端/倒角语义或文档要求的候选，正交关系继续抑制重复 90° 标注。

- [x] **Step 4: 验证（按当前要求暂不提交）**

  Run: `pnpm vitest run packages/engineering-annotation/src/opening-angle`

  Commit: `fix: make opening-angle recognition transform invariant`

**验收标准:** 旋转后的图纸与原图产生同一组语义开角，不依赖世界 X/Y。

---

### Task 7: 把尺寸链变成基于工程证据的多方案求解

**Files:**
- Modify: `packages/engineering-annotation/src/dimension-inference/policy.ts`
- Modify: `packages/engineering-annotation/src/dimension-inference/infer.ts`
- Modify: `packages/engineering-annotation/src/dimension-inference/candidates.ts`
- Modify: `packages/engineering-annotation/src/dimension-inference/types.ts`
- Test: `packages/engineering-annotation/src/dimension-inference/infer.generic.test.ts`
- Modify: `packages/engineering-annotation/src/dimension-inference/golden.integration.test.ts`
- Modify: `docs/tech-architecture.md`
- Modify: `docs/prd.md`

**Interfaces:**
- Consumes: 功能区域、加工/装配/检验基准、文档尺寸和人工要求。
- Produces: 一个确定方案或多个等价候选；每个缺省段带选择理由和反事实替代方案。

- [x] **Step 1: 写方向反例**

  镜像同一轴并交换轴 orientation，断言缺省段不会仅因为“位于方向末端”改变。

- [x] **Step 2: 写证据歧义测试**

  两个闭环候选工程证据等价时，断言状态为 `needs-review`，不得用坐标、ID 或固定 tie-breaker 假装确定。

- [x] **Step 3: 删除默认参考端闭合策略**

  移除生产默认中的黄金样本参考端惯例；`policyById` 必须真实区分策略，未知策略不得静默返回同一个默认实现。

- [x] **Step 4: 建立证据层级而非魔法总分**

  先应用 required/prohibited 硬约束，再按功能、工艺、文档和人工证据形成可解释偏序；数值权重只可用于同层次候选的可校准排序。

- [x] **Step 5: 保留黄金样本为输出 Oracle**

  黄金样本若需要特定闭环，必须通过测试输入中的功能/工艺证据推出；删除“参考终端惯例”作为隐式输入。

- [x] **Step 6: 验证（按当前要求暂不提交）**

  Run: `pnpm vitest run packages/engineering-annotation/src/dimension-inference && pnpm e2e:golden-dimension-chain`

  Commit: `fix: infer dimension closures from engineering evidence`

**验收标准:** 缺省段不再由方向决定；黄金结果由显式工程证据推出，证据不足时展示候选并询问。

---

### Task 8: 审核公差、形位公差和粗糙度数据来源

**Files:**
- Modify: `packages/engineering-annotation/src/tolerance/gbt1800-2020-data.ts`
- Modify: `scripts/extract-gbt1800-2020.py`
- Modify: `packages/engineering-annotation/src/gdt/gbt1184-catalog.ts`
- Modify: `packages/engineering-annotation/src/surface-texture/gbt1031-catalog.ts`
- Create: `packages/engineering-annotation/src/standards/provenance.ts`
- Create: `packages/engineering-annotation/src/standards/standard-data-audit.test.ts`

**Interfaces:**
- Produces: 每个标准表的标准号、版次、表号、页码、源文件校验和、提取方式、单位和适用特征。

- [ ] **Step 1: 建立逐表来源 manifest**

  GB/T 1800、GB/T 1184 和 GB/T 1031 每张表记录来源位置和变换步骤。无法证明出处的数据标为 `unverified`，不得进入自动推荐。

- [ ] **Step 2: 写边界与抽样核对测试**

  覆盖每个基本尺寸区间边界、孔/轴大小写、公差等级端点、微米/毫米换算和至少每张表每行一个独立核对点。

- [ ] **Step 3: 分离未注公差与单独公差推荐**

  GB/T 1184 H/K/L 未注公差不得被当作单项形位公差的自动推荐值；单独标注值必须要求等级/功能依据或用户选择。

- [ ] **Step 4: 标记产品推荐策略**

  “常用”“优先”和默认配合组合若不是标准原文直接规定，使用 `product-policy` 来源，不显示成国家标准结论。

- [ ] **Step 5: 验证并提交**

  Run: `pnpm vitest run packages/engineering-annotation/src/tolerance packages/engineering-annotation/src/gdt packages/engineering-annotation/src/surface-texture packages/engineering-annotation/src/standards`

  Commit: `fix: make engineering standard data traceable`

**验收标准:** UI 中每个推荐值都能追溯到标准表或明确的产品策略；未经核实的数据不能自动应用。

---

### Task 9: 建立跨类型的统一 CAD 标注排版器

**Files:**
- Create: `packages/engineering-annotation/src/layout/annotation-constraint-graph.ts`
- Create: `packages/engineering-annotation/src/layout/annotation-layout.ts`
- Create: `packages/engineering-annotation/src/layout/obstacles.ts`
- Modify: `packages/engineering-annotation/src/diameter/layout.ts`
- Modify: `packages/engineering-annotation/src/opening-angle/layout.ts`
- Modify: `packages/plugin-dsh-annotation-client/src/DimensionChainOverlay.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/GdtOverlay.tsx`
- Modify: `packages/plugin-dsh-annotation-client/src/SurfaceTextureOverlay.tsx`
- Test: `packages/engineering-annotation/src/layout/annotation-layout.test.ts`

**Interfaces:**
- Consumes: 所有标注的目标、包盒、允许方向、内外部候选位置、分组和用户偏移。
- Produces: 稳定世界坐标位置、leader 路径、碰撞诊断和布局版本。

- [ ] **Step 1: 写跨类型重叠夹具**

  构造轴端直径、60°/120°开角、基准框、形位框、粗糙度和三组尺寸链同时存在的场景；断言包盒不重叠、引线不穿文字、受控关联保持正确。

- [ ] **Step 2: 定义硬约束与软约束**

  硬约束包括目标关联、允许拖动方向、文字可读、不可覆盖关键几何；软约束包括距离最短、同组对齐、长尺寸靠外、减少交叉和优先留在可读空白区。

- [ ] **Step 3: 将现有 Labella 降为局部求解器**

  Labella/VPSC 继续处理单侧一维标签，但输入障碍来自全局约束图；各标注类型不再独立决定最终位置。

- [ ] **Step 4: 持久化手工偏移**

  用户拖动只更新对应 annotation/group 的约束偏移；重新排版时把它作为强偏好，不触发画布缩放或其他标注回弹。

- [ ] **Step 5: 验证并提交**

  Run: `pnpm vitest run packages/engineering-annotation/src/layout packages/engineering-annotation/src/diameter packages/engineering-annotation/src/opening-angle`

  Commit: `feat: solve engineering annotation layout globally`

**验收标准:** 直径与开角、尺寸链与形位框、粗糙度与表格之间自动避让；拖动一个标注不移动无关链路。

---

### Task 10: 使用原生 CAD 语义完成 DXF 导出

**Files:**
- Modify: `packages/drawing-core/src/io/dxf.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/engineering-dxf-export.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/gb-cad-profile.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/engineering-dxf-export.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/cad-golden-contract.test.ts`
- Modify: `packages/plugin-dsh-annotation-host/src/golden-engineering-export.integration.test.ts`

**Interfaces:**
- Produces: 原生 `DIMENSION`、`TOLERANCE`、`LEADER`、`HATCH`；不支持的表面纹理/基准使用标准块和可追踪属性。

- [ ] **Step 1: 写实体类型合同测试**

  断言尺寸为 `DIMENSION`、形位框为 `TOLERANCE`、关联引线为 `LEADER`、截面为 `HATCH`，并验证 handle 关联和 DIMSTYLE。

- [ ] **Step 2: 扩展 drawing-core 通用 DXF 实体**

  writer 只实现 DXF 通用结构，不包含 GB、黄金样本或轴类业务。实体顺序不可作为解析前提。

- [ ] **Step 3: 在 Host 做工程语义映射**

  基准、形位框、尺寸公差、粗糙度和剖面语义映射为 CAD 实体；CAXA 特殊编码只存在于 `caxa-compatible` profile。

- [ ] **Step 4: 同时执行结构和真实 CAD 验证**

  使用 `acad-ts` 和可用的 `ezdxf.audit()` 检查合法性，再在目标 CAD 中分别打开黄金样本与导出文件比较可编辑性、颜色、线型、箭头、符号和截面。

- [ ] **Step 5: 验证并提交**

  Run: `pnpm test:cad-export`

  Commit: `feat: export native cad annotation semantics`

**验收标准:** CAD 能识别并编辑尺寸和形位公差语义，截面不丢失；黄金样本只决定 profile 表达，不决定标注内容。

---

### Task 11: 建立防过拟合总验收与文档收口

**Files:**
- Create: `packages/engineering-annotation/test/fixtures/general-shafts/`
- Create: `scripts/e2e-engineering-generalization.ts`
- Modify: `packages/engineering-annotation/src/dimension-inference/source-guard.test.ts`
- Modify: `package.json`
- Modify: `docs/prd.md`
- Modify: `docs/tech-architecture.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Produces: `pnpm e2e:engineering-generalization` 和发布前统一质量门禁。

- [ ] **Step 1: 增加至少五类非黄金夹具**

  包括旋转轴、非对称局部剖面、重复同径断开轴段、多轴承位、无文档/有冲突文档。夹具只描述输入和工程证据，不复制黄金输出。

- [ ] **Step 2: 增加变形测试**

  对黄金和非黄金输入执行旋转、镜像、平移、缩放、尺寸扰动和实体 ID 重命名；语义结果按变换保持等价，数值随几何变化。

- [ ] **Step 3: 强化源码守卫**

  扫描生产代码中的 fixture 名称、hash、drawing ID、已知坐标/尺寸数组和从 test-support 的反向依赖；同时检测默认策略描述中的“黄金惯例”“参考终端”等隐式耦合。

- [ ] **Step 4: 更新产品和架构文档**

  删除 `docs/tech-architecture.md` 中“默认采用黄金样本参考端闭合惯例”的描述，记录五层职责、证据权限、标准 provenance 和失败时询问策略。

- [ ] **Step 5: 执行总验收**

  Run: `pnpm test && pnpm check && pnpm e2e:engineering-generalization && pnpm test:cad-export && pnpm build:dsh-annotation && pnpm check:dsh-build-freshness`

- [ ] **Step 6: 提交**

  Commit: `test: enforce engineering annotation generalization`

**验收标准:** 黄金样本、非黄金夹具和所有几何变形同时通过；更换 ID、坐标方向或尺寸后结果仍由规则重新计算，不保留样本答案。

## 执行顺序与停止条件

1. Task 1 是基础门禁，必须最先完成，否则后续无法确认 DSH 实际加载哪套代码。
2. Task 2 先停止无依据的错误正式标注，避免继续积累错误数据。
3. Task 3–6 修复几何事实层；任何一项失败都不应通过调整黄金样本专属阈值解决。
4. Task 7–8 修复工程决策与标准数据层。
5. Task 9–10 在语义正确后统一排版和 CAD 输出。
6. Task 11 是发布门禁，不是补测试；若变形测试失败，返回对应算法任务修复。

## 每个任务的固定验收模板

- 标准检查：输出是否符合适用标准的语义和表达范围。
- 通用检查：至少一个非黄金夹具通过。
- 变形检查：旋转、镜像、缩放或尺寸扰动后语义保持正确。
- 黄金检查：只比较最终输出，不允许生产运行时读取黄金输入。
- 运行检查：重建插件后，从 DSH 实际加载的 `lib` 验证结果。
- 回归检查：编辑某类标注不得删除、移动或重建其他标注类别。
