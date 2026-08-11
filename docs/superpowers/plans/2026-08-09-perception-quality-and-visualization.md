# 感知质量与多轮绘制可视化进展

**日期：** 2026-08-09
**范围：** 阶段四（导入与感知）质量修复 + 前端多轮绘制可视化
**状态：** 进行中

## 1. test1 基线诊断

通过 `pnpm test:drawing -- test1.jpg` 驱动感知管线，对 test1 做真实模型基线，暴露以下问题：

| 现象 | 根因 | 类型 |
|---|---|---|
| `extract_annotations` 整批失败（单个 `annotations[i]` imageBounds 越界即整批 reject）→ 尺寸/文字标注全丢 → 尺寸关联大量 conflict | 视觉工具"全有或全无"校验 | **确定性代码 Bug** |
| 识别到的圆弧（"半环形内外轮廓"）在命令构建时被整条丢弃 | `geometryValue` 要求 arc 必须带 `counterClockwise`，模型未输出该布尔即返回 null | **确定性代码 Bug** |
| 覆盖始终 `complete=false`，细化到 `max_depth` 后 `budget_exhausted` | 模型 `assess_coverage` 反复报告"存在未参数化的半环/圆角/直线"，但细化重读仍给不出完整 arc/line 参数；覆盖评估本身跨运行不稳定（同一区域一次 `refine`、一次 `complete`） | **模型能力限制** |
| 几何观测数跨运行波动（16 vs 10）、视图 ID 命名不一致（`page1_view1` vs `page1_1`） | `segment_views` 让模型自由命名视图；模型对 test1 复杂轮廓的识别不稳定 | **模型能力限制** |

**结论：** 两个可修复的确定性问题直接导致 test1 解析残缺；其余为模型（`doubao-seed-2.0-lite`）对复杂机械图轮廓的几何参数化能力限制，纯代码层改进空间有限。

## 2. 已修复（确定性代码修复）

### 2.1 `extract_annotations` 局部容错
`api/services/drawing-perception/vision-tools.ts`
- 原：单条 annotation 校验失败 → 整批抛 `DrawingVisionOutputError`，pipeline 重试后 `rawAnnotations=[]`。
- 现：丢弃无效条目、保留有效条目；仅当全部条目无效时才抛错以触发一次重试。
- 效果：标注不再整批丢失，`perceptionErrorCount` 1→0，`resolvedAssociations` 13→16，总耗时 -39%。

### 2.2 圆弧 `counterClockwise` 容错
`api/services/drawing-perception/build-patches.ts`
- 原：`geometryValue` 要求 `typeof params.counterClockwise === 'boolean'`，模型未输出该字段 → 整条弧返回 null 被跳过。
- 现：缺省或非布尔时默认 `counterClockwise: true`（CAD 圆弧合理默认），保留已识别的弧。
- 效果：识别到的半环形轮廓等弧可正常提交，不再被丢弃。

## 3. 可视化增强：按感知阶段分层呈现

前端按感知阶段区分 provisional 渲染样式，直观呈现"轮廓 → 细节"的多轮绘制过程：

- `src/drawing/preview/types.ts`：`PerceptionPreviewState` 增加 `stageByNodeId`，新增命名类型 `PerceptionPreviewStage`（outline/detail/annotation/reconciliation）。
- `src/drawing/preview/reducer.ts`：应用 delta 时维护 `stageByNodeId`，remove 时同步清除。
- `src/components/canvas/EntityRenderer.tsx`：新增 `perceptionStage` prop；`outline`（轮廓）用亮天蓝实线、`detail`/`annotation`（细节/标注）用淡青虚线；低置信度仍红色优先。
- `src/components/Canvas.tsx`：`PerceptionPreviewLayer` 传入 `stageByNodeId`。

效果：画布上轮廓先以实线主色出现、细节与标注随后以虚线淡色出现，多轮"从轮廓到细节"的绘制过程视觉可辨。

### 3.1 任务状态阶段展示修复
`src/components/agent/task-presentation.ts`
- 原：`currentStage` 在 `!plan` 时一律返回 `understand`。图片/PDF 感知型任务不经过文字 planner、没有 GoalSpec → `taskPlan` 恒为 `null` → 即使已在感知/绘制，任务面板也一直卡在"理解需求"。
- 现：无 plan 的感知任务按事件流推断阶段——收到 `perception_delta` → `perceive`（正在解析图纸）、出现 commit → `build`（正在构建模型）。"理解需求"仅保留在任务接收/规划瞬间。

### 3.2 画布交互性能优化
`src/components/Canvas.tsx`
- 原：拖动（`onMouseMove`）每帧、缩放（`onWheel`）每事件直接 `setCanvasTransform`，高频触发整块 SVG 重渲染 → 拖动/缩放时界面卡顿抖动闪烁。
- 现：用 `requestAnimationFrame` 节流合并高频更新，每帧最多提交一次；缩放基于 `transformRef` 最新视口计算。unmount 时清理 rAF。

## 4. 已知限制（模型能力，待决策）
1. **覆盖不完整**：`coverageComplete=false` 源于模型对 test1 复杂轮廓（半环、圆角、条形）几何参数化能力不足 + `assess_coverage` 判断不稳定。细化收敛策略（如"无新进展即停止"）可优化耗时，但无法让模型给出缺失参数。
2. **输出不稳定**：几何观测数与视图命名跨运行波动，影响可复现性与审计对比。

**可选后续（需用户决策）：**
- 视觉模型策略：换更强视觉模型，或改进 `detect_regional_geometry`/`detect_global_contours` prompt 引导更完整输出 arc/polyline 参数。
- 覆盖收敛：实现"细化无新进展即停止"，降低无效模型调用与耗时。

## 5. 验证

- `pnpm check`（tsc）通过。
- `pnpm test`：425/426 通过；唯一失败 `attachments.test.ts` 因开发机缺 `pdftoppm`（环境问题，与本次改动无关）。
- 感知基准（修复前 → 修复后）：总耗时 214s→131s；`perceptionErrorCount` 1→0；`resolvedAssociations` 13→16；`ambiguousAssociations` 7→3。
