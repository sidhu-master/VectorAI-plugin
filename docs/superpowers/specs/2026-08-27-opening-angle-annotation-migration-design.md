# 轴端开角标注迁移设计

## 目标

把旧 Web 端已经验证过的轴端开角标注完整迁入第二层工程标注插件。第一版只处理轴类零件左右端的镜像开角，不扩展为任意两线夹角工具。

## 行为边界

- 输入必须来自当前图纸中可见且已确认的直线或折线直线段。
- 本地几何算法配对中心轴上下镜像的短斜线，并计算交点、射线及夹角。
- 仅保留接触图纸左右轴向边界的开角。
- 抑制接近 90° 的正交角、中部斜线、退化线及可信度不足的组合。
- AI 只负责触发“自动标注”任务，不选择线段、不计算坐标和角度。
- 结果进入现有第二层预览、取消、确认流程，并通过第一层扩展协议提交。
- 重跑时稳定复用自动标注 ID；过期自动开角可更新，手工角度标注不受影响。

## 数据流

1. `drawing_auto_annotate` 读取当前 DrawingDocument。
2. `engineering-annotation` 从几何中测量确定性的 `OpeningAngleFact`。
3. 轴端选择器产生保留项与抑制诊断。
4. 布局器生成顶点、两条延长线端点、圆弧起止点和文字位置。
5. 开角事实转成 `DimensionIntent(kind: angular)` 和 `DimensionAnnotation`。
6. `SpatialEditProgram` 经第一层 `runExtensionProgram` 进入既有确认链路。
7. Viewer 按角度语义渲染两条射线、圆弧、切向箭头与角度文字。

## 模块划分

- `engineering-annotation/opening-angle/measure.ts`：镜像斜线配对和角度计算。
- `engineering-annotation/opening-angle/select.ts`：轴端筛选与 90° 抑制。
- `engineering-annotation/opening-angle/layout.ts`：嵌套圆弧及文字避让。
- `engineering-annotation/plan.ts`：把开角事实并入工程标注计划。
- `drawing-viewer-react/canvas/EntityRenderer.tsx`：专用角度标注渲染。

## DefinitionPoints 约定

角度标注使用五个点，保持旧版语义：

1. 角顶点；
2. 第一条边界射线的延长终点；
3. 第二条边界射线的延长终点；
4. 圆弧起点；
5. 圆弧终点。

Viewer 不再把这五点画成折线，而是据此重建圆弧和切向箭头。

## 验收标准

- 旧版夹具只生成左右两个 120° 开角，不生成 90° 和中部干扰角。
- 嵌套开角的圆弧和文字按物理外侧顺序分层且不重叠。
- 同一输入重复规划结果完全一致。
- 普通圆、圆弧等现有标注行为不回归。
- Viewer 输出两条延长线、一段圆弧、两个切向箭头和角度文本。
- 使用真实 `初始图.dxf` 完成导入到计划生成的集成自测。

