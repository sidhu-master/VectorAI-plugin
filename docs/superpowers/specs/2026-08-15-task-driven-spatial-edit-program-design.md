# 任务驱动空间编辑程序设计

> 状态：已确认设计
>
> 日期：2026-08-15
>
> 决策：以 `SpatialEditProgram` 作为模型控制二维空间的默认入口；局部候选解析与自由重绘作为按需能力

## 1. 决策摘要

VectorAI 的目标不是穷举所有可能的图形、部件和编辑模板，而是让模型像编辑代码一样编辑二维空间：模型表达要改什么、改成什么关系，程序把意图确定性地编译为可预览、可审计、可回滚的 Drawing IR 增量事务。

新的默认链路是：

```text
用户指令
  -> 模型观察并输出结构化空间编辑程序
  -> 程序解析视觉引用、节点引用和坐标
  -> 几何编译器生成 Drawing Commands
  -> Preview
  -> 独立检查者比较修改前后并反馈
  -> 主模型接受、修订或舍弃重做
  -> Commit
```

`Drawing IR` 继续是唯一可写真相。`SpatialEditProgram` 不是第二份图纸，而是绑定 drawing、revision、observation 和用户目标的一次性编辑计划。

## 2. 为什么需要这一层

当前模型一次响应往往要同时完成：

- 从视觉语义找到目标部位；
- 从视觉坐标换算世界坐标；
- 推断精确 Drawing IR 节点和端点；
- 设计几何变化；
- 手写底层 Drawing Commands。

这些任务互相放大误差。模型即使正确理解了“移动某个视觉载体并重连边界”，也可能因为 Y 轴方向、矩阵反算、端点顺序或节点 ID 选择错误而生成相反结果。

新架构让模型主要做需要视觉与智能的选择：

- 目标是谁；
- 目标应该去哪里；
- 哪些接口需要重连；
- 哪些内容必须保持不变；
- 什么条件代表任务完成。

代码负责可计算的工作：

- observation 坐标到世界坐标的逆变换；
- 节点锚点、端点和顶点定位；
- 平移、改端点、创建路径、删除等几何操作；
- 原子事务、版本检查、Preview、诊断与回滚。

## 3. 设计边界

### 3.1 默认：任务驱动，而非全局候选穷举

模型可以直接根据当前观察输出一个 `SpatialEditProgram`。只有目标存在歧义时，模型才请求局部 Grounding、ID 图、拓扑查询或局部候选。系统不要求预先枚举“所有语义对象”或“所有可能动作”。

### 3.2 模型拥有完整控制能力

结构化程序是高效默认入口，不是权限边界。模型仍可：

- 使用现有低层 `preview_transaction`；
- 请求局部重绘或重新矢量化；
- 修改、替换或删除任意合法 Drawing IR；
- 根据检查者反馈选择基于现有 Preview 修订，或舍弃 Preview 从 canonical revision 重做。

### 3.3 不加入对象特判

生产代码只认识通用几何、引用和关系，不认识“手臂”“打招呼”“头发”等业务对象。测试可以使用具体图形验证能力，但不得把样例语义写入提示词、编译器或评分规则。

### 3.4 检查是反馈，不是语义硬限制

独立检查者只判断结果是否满足用户指令并指出差异。除 Drawing IR 有效性、revision 一致性和程序自身矛盾外，诊断默认不阻止模型继续设计。需要解除用户或工程约束时，通过通用 Human Decision Gate 请求授权。

## 4. SpatialEditProgram

首版协议以少量可组合操作覆盖常见二维编辑，同时保留底层事务逃生口：

```ts
interface SpatialEditProgram {
  baseRevision: RevisionId;
  replacesPreviewHandle?: string;
  summary: string;
  intent: string;
  targets: SpatialTarget[];
  operations: SpatialOperation[];
  preserveNodeRefs?: string[];
  postconditions?: SpatialPostcondition[];
  evidenceRefs?: string[];
  confidence?: number;
}
```

`targets` 是供 UI、审计和反馈模型理解的语义说明，真正修改范围由 `operations` 的显式节点引用决定。未被操作引用的图元天然保持不变。

首版操作：

- `translate`：将任意一组 Drawing IR 节点从一个空间引用移动到另一个空间引用；
- `set_endpoint`：修改开放几何的起点或终点；
- `create_path`：使用空间引用创建 line 或 polyline；
- `delete_nodes`：删除明确引用的节点。

这四种操作可以组合出“移动视觉载体、删除旧边界、重建连接”等任务。Circle、Arc、Spline 等更复杂的新建或替换可继续使用 `preview_transaction`，后续根据真实任务频率扩展操作，而不是先枚举全部图形。

## 5. 空间引用

模型不再被要求手算 observation 到世界坐标的仿射逆矩阵。程序接受三类显式引用：

```ts
type SpatialPointRef =
  | {
      kind: 'observation';
      observationId: string;
      normalized: [number, number];
    }
  | {
      kind: 'world';
      frameId: string;
      point: [number, number];
    }
  | {
      kind: 'node_anchor';
      nodeId: string;
      anchor: 'center' | 'start' | 'end' | 'vertex';
      index?: number;
    };
```

规则：

- observation 点必须绑定当前 drawing 与 revision，归一化坐标范围为 `[0, 1]`；
- 后端使用该 observation 的 `worldToImage` 矩阵做确定性逆变换；
- world 点必须声明 frame；首版只接受文档世界坐标 frame；
- node anchor 从 canonical 或被明确指定的 Preview 基线解析；
- 过期、外部或不可逆 observation 必须返回明确可恢复错误，不能猜测。

## 6. 编译与事务语义

编译分为四步，均在一次工具调用内完成：

1. 解析并规范化协议；
2. 把所有点引用解析为世界坐标；
3. 顺序应用操作到内存工作文档并生成 Drawing Commands；
4. 创建普通 Drawing Transaction Preview。

每个操作产生结构化 receipt：输入引用、解析坐标、受影响节点、生成命令和诊断。整个 program、receipt 和 Preview handle 进入现有工具审计记录。

`preserveNodeRefs` 是模型自己声明的计划契约。若同一程序又修改这些节点，编译器返回 `SPATIAL_PROGRAM_PRESERVE_CONFLICT`，要求模型修订自己的计划；这不是系统对模型的永久写权限限制。

`replacesPreviewHandle` 明确本轮基于哪一个结果：

- 缺省：基于 canonical `baseRevision`；
- 提供 handle：基于该 Preview 继续编译，并用新候选替换当前显示的旧候选；最终事务仍以 canonical revision 为基线，可独立回放；
- 主模型可以根据检查反馈选择保留上一步或从 canonical 重做。

## 7. Postconditions 与检查 loop

程序可声明轻量、可计算的后置条件：

- `anchors_coincident`：两个空间引用在相对图幅容差内重合；
- `anchor_at`：节点锚点到达目标位置；
- `nodes_unchanged`：指定节点几何未变化；
- `path_closed`：指定路径保持闭合。

它们产生诊断和分数，不取代独立视觉检查。完整 loop 为：

1. 程序编译后立即向 UI 投影目标、锚点、移动向量和 Preview 差异；
2. 程序做 Drawing IR 有效性与声明后置条件检查；
3. 独立检查者接收同视口的 before/after 拼图、用户指令、结构诊断和本轮计划；
4. 检查结果回到主模型，并明确这是针对哪个 Preview handle；
5. 主模型选择 `commit`、基于该 Preview `revise`，或从 canonical `replace`。

检查者不生成编辑命令，也不复用主模型的隐藏推理。

为防止模型在同一问题上无限生成无改善候选，Runtime 对一次指令设置很小的候选预算，MVP 默认最多复核 3 个语义候选。预算是通用资源边界，不判断对象、动作或方向；达到上限时正式 Drawing IR 保持不变，最后一个 Preview 不会自动提交，UI 明确提示用户重试或追加指令。完整候选与复核历史继续保留在审计中，模型活跃上下文只保留当前候选契约和最新检查结果。

## 8. 动态视觉交互

`preview_spatial_program` 在执行前后都返回统一 `interactionFrame`：

- `target`：模型声明的目标节点描边；
- `anchor`：模型选中的视觉点和解析后的世界点；
- `motion`：起点到目标点的方向向量；
- `interface`：需要重连或校验的端点；
- `delta`：Preview 前后线条。

运行时把这些真实数据逐步推送到画布。UI 不伪造固定步骤，不展示模型名称，只显示当前真实状态。

## 9. 失败与恢复

所有失败返回机器可读 code、阶段、可恢复性和建议下一步：

- `SPATIAL_PROGRAM_INVALID`
- `SPATIAL_REFERENCE_UNRESOLVED`
- `SPATIAL_OBSERVATION_EXPIRED`
- `SPATIAL_OBSERVATION_REVISION_MISMATCH`
- `SPATIAL_FRAME_UNSUPPORTED`
- `SPATIAL_OPERATION_UNSUPPORTED`
- `SPATIAL_PROGRAM_PRESERVE_CONFLICT`

模型可据此补充观察、改用精确节点引用、请求局部候选或降级到底层事务。工具不得在解析失败时静默猜坐标或提交部分结果。

## 10. 性能策略

- 普通任务以一次模型决策 + 一次编译 Preview 为快速路径；
- observation 逆变换、节点锚点、几何运算全部由代码完成；
- 首轮只传 grounded overview 与 Global Map；用户已有选中项或工具产生了活跃节点后，才内联局部 World Model，避免首轮编译和传输整图拓扑；
- 只传任务相关节点、关系、观察索引和紧凑工具 schema；工具目录按 `build → ground → propose` 的真实前置条件逐步开放；
- 同一 revision 的精确 World Model 与完整 Working Set 不在同一轮重复表达；后续无 World Model 投影时再恢复必要节点事实，不能假设模型记得上一轮；
- 新候选替换活跃上下文里的旧候选 receipt，审计日志仍保持追加式完整历史；
- 不强制 Grounding、候选生成、全图拓扑或额外模型轮次；
- 超过 30 秒时 UI 展示真实阶段，但不牺牲原子事务和检查 loop；
- 大图通过 revision-bound 局部工作集和 observation 引用扩展，不把整图坐标逐轮重复传给模型。

## 11. 验收标准

- 模型能用 observation 归一化点表达目标，后端正确转换世界坐标和 Y 轴方向；
- 任意图元平移与开放路径端点修改不依赖对象语义；
- 一个 program 可原子地组合移动、重连、创建与删除；
- 未提及节点保持不变，canonical 在 commit 前不变；
- Preview 包含真实目标、锚点、向量和前后差异；
- 独立检查结果绑定具体 Preview，主模型能选择 revise 或 replace；
- Grounding 候选仅在歧义时使用，不再是每次编辑的必经阶段；
- 生产提示词和代码不存在 test2、手臂、肩膀或打招呼特判；
- 测试覆盖协议、坐标、编译、工具、运行时、检查 loop 和通用重连回归。
