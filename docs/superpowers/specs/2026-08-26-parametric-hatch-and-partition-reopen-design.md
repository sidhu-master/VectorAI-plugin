# 参数化剖面线与分区重新编辑设计

日期：2026-08-26

## 目标

1. DXF `HATCH` 导入后保留边界、图案线族、填充规则和坐标语义，不再把提前生成的线段当作唯一事实。
2. 使用成熟的 Clipper2 拓扑与填充规则处理复杂轮廓；浏览器渲染保持原始角度、相位、间距和虚线定义。
3. 已确认分区在侧边栏中始终可见，并可通过显式操作重新进入编辑、取消或再次确认。

## 非目标

- 本阶段不编辑 HATCH 图案本身。
- 不改变轴段识别、文档融合或尺寸链算法。
- 不引入云端服务或 Python 运行时。

## HATCH 数据模型

二维底座为 `section-hatch` 增加版本化参数语义：

- `style`：对应 DXF group 75（normal / outer / ignore）。
- `elevation` 与 `extrusion`：保留 OCS 来源语义；进入二维空间时记录确定性的 OCS→工作平面变换。
- `boundaryPaths`：保留每个 path 的 flags，以及 line、arc、ellipse、spline、polyline/bulge 边。
- `patternLines`：保留 angle、base、offset 和 dash lengths。
- `patternAngle`、`patternScale`、`double`：保留 HATCH 全局图案参数。
- `segments` 降为可选的 legacy/materialized projection，只用于读取旧快照或非参数化消费者，不再作为新导入的事实源。

旧快照仍可读取：只有 `segments` 的节点继续按旧方式渲染；新节点优先使用参数语义。序列化 schema 保持向后兼容，导出时优先重建原始 HATCH。

## 几何内核

新增独立的 `@vectorai/drawing-hatch` 基础包，避免 DXF 解析、React 渲染和拓扑算法互相耦合。

- 曲线边界使用按几何误差控制的离散化，不再按固定点数粗略采样。
- 端点只在与模型尺度相关的严格容差内吸附；不允许用大容差跨越缺口强行闭合。
- 使用 `clipper2-ts` 的 Clipper2 算法规范化闭合轮廓、处理自交、孔洞与嵌套岛。
- 依据 DXF hatch style 选择 EvenOdd/外层等填充区域。
- 所有 Clipper 输入先按图纸范围选择安全整数缩放，检查 `Number` 安全整数范围并在输出时还原。
- 无法形成合法闭环时保留原始 HATCH 与诊断，不输出伪造剖面线。

选择 TypeScript 端口而不是 WASM，是为了保持当前同步 DXF 导入接口、降低插件装载复杂度；该端口沿用 Clipper2 的 Boost Software License 1.0，并通过参考测试集验证。第三方许可写入 NOTICE。

## 渲染

React 画布不再预裁剪每条剖面线：

1. 根据参数化边界生成 compound SVG clip path。
2. 根据每个 pattern line 的 base、offset、angle 和 dash 定义生成覆盖边界包围盒的规则线族。
3. 使用 clip path 和对应填充规则裁剪显示。

因此缩放不会改变世界坐标间距，凹轮廓、孔洞和样条边界不会因错误的交点配对产生孤立线。渲染计划按 HATCH 内容摘要和几何容差缓存；视口变化只更新显示精度，不重新解析 DXF。

## 分区重新编辑

分区状态增加显式的 `reopenPartition` 用例，而不是把 Undo 当作 UI 语义：

- 确认时除公开 revision 外，在会话存储中保留产生该 revision 的完整 draft，包括 step candidates。
- 已确认状态的“图纸结构”面板显示 revision、确认时间和只读轴段列表。
- 点击“重新编辑分区”后，以确认 revision 为 baseline 恢复完整 draft，phase 变为 `editing`，重新显示分区框和取消/预览/确认工具栏。
- 取消返回原 confirmed revision；确认生成新 revision，并设置 `parentRevisionId`。
- 旧持久化数据若没有完整 draft，则由 confirmed segments 构造可编辑草稿，并把现有内部边界作为 accepted snap candidates，同时记录迁移诊断。
- 图纸 revision 不一致时拒绝 reopen 并进入 `needs-rebase`，不在错误图纸上恢复边界。

## 接口与错误

- host、Typert remote 和 client controller 增加 `reopenPartition(sessionId, expectedDrawingRef)`。
- 重复 reopen 在 editing 状态下幂等返回当前草稿。
- 无 confirmed revision 返回 `PARTITION_CONFIRMED_REQUIRED`。
- 非法 HATCH 不阻塞整张 DXF 导入；保留源实体并产生可见诊断，禁止生成越界 fallback 线。

## 验证

- 协议/schema：新旧 section-hatch 均可往返，未知字段仍被严格拒绝。
- Clipper2 内核：凹多边形、孔洞、岛、自交、反向边、乱序边、圆弧、椭圆弧和 NURBS 边界。
- 初始轴图回归：ANSI31 间距恒为 3.175mm；所有可见线段位于合法材料区域；不存在跨缺口闭合线和孤立短线。
- 渲染：缩放前后世界间距不变；clip path 使用正确 fill rule；legacy segment 快照仍可显示。
- 分区：confirm → reopen → edit → cancel，以及 confirm → reopen → edit → confirm 新 revision；重启后同样成立。
- DSH 真实验证：确认后侧栏仍可查看分区；重新编辑工具栏恢复；目标 DXF 的上下剖面线连续、均匀且不越界。

## 迁移顺序

1. 扩展 drawing-core/schema，并增加 legacy 兼容。
2. 建立 drawing-hatch 内核并接入 Clipper2。
3. DXF importer 改为参数化输出。
4. React renderer 改为参数化 clip-path 渲染，保留 legacy fallback。
5. 增加 partition reopen 的 store、remote、controller 与侧栏 UI。
6. 运行全量测试、初始 DXF 端到端测试和 DSH 真实界面验证。
