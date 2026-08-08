# VectorAI Agent Workflow v0.1 设计规格

日期：2026-08-08  
状态：已确认，待实施计划

## 1. 目标与范围

VectorAI v0.1 必须交付可运行的 Agent Workflow。产品以二维机械工程图为第一优先级，同时保持协议对建筑平面图的兼容性；建筑领域需要大量专用适配的能力不进入首版。

首版输入包括自然语言、常见图片和 PDF。AI 不重新生成整个模型，而是通过可验证的局部增量操作修改 SpatialModel。Agent 默认自动连续执行，用户可以查看结构化执行轨迹、观察 UI 改动，并随时暂停、继续、立即停止或追加指令。

首版包含：

- Task Planner 和分阶段 Agent Runtime
- Spatial Patch 局部增量协议
- 提交历史、Undo/Redo 与快照接口
- 验证失败后的有限自动修正
- 低置信度结果标红
- 本地审计日志和确定性回放测试
- 图片与 PDF 感知
- SVG 渲染和 DXF 导出

首版不包含：

- Constraint Solver
- 建筑平面图专用识别规则库
- PDF 矢量对象或文字层的原生解析
- STEP/B-Rep/CAD 插件
- 数据库或云端审计存储
- 展示模型内部隐藏推理过程

## 2. 设计原则

1. Spatial Core 保持平台无关，不依赖 React、Express 或具体模型厂商。
2. 所有模型变更必须通过 Spatial Patch，并在临时模型上验证后提交。
3. 每次成功变更形成不可变 SpatialCommit，能够审计、撤销和回放。
4. UI 展示结构化决策摘要与操作轨迹，不存储或展示模型内部推理原文。
5. 在线模型调用与确定性执行分离，使录制响应能够稳定回归。
6. 首版保持简单：本地文件持久化，通过接口为数据库和对象存储预留替换点。
7. 运行时采用单一主脑和显式工具注册表；不得在 Prompt 中宣告运行时未注册的能力。
8. 上下文采用分层压缩，当前步骤只同步读取紧凑摘要；历史压缩和审计写入不得阻塞主执行循环。
9. 用户发起任务后 30 秒内必须至少收到一次可见回执；长调用期间持续发送阶段进度，而不是等待完整任务结束后一次性返回。

## 3. 核心数据结构

### 3.1 Spatial Patch

```typescript
interface SpatialPatch {
  operations: SpatialOperation[];
}

type SpatialOperation =
  | { type: 'entity.add'; entity: GeometryEntity }
  | { type: 'entity.update'; entityId: string; changes: EntityPatch }
  | { type: 'entity.delete'; entityId: string }
  | { type: 'relation.add'; relation: SpatialRelation }
  | { type: 'relation.update'; relationId: string; changes: RelationPatch }
  | { type: 'relation.delete'; relationId: string };
```

`entity.update` 和 `relation.update` 是真正的局部字段修改。Patch 可以为空，以支持只执行检查、不修改模型的 `verify_model` 阶段。

每个操作必须能够生成逆操作。删除操作生成逆操作时保存被删除对象；更新操作保存修改前的字段值。

### 3.2 Spatial Commit

```typescript
interface SpatialCommit {
  id: string;
  runId: string;
  parentCommitId?: string;
  stepId: string;
  source: 'AI' | 'user' | 'system';
  patch: SpatialPatch;
  inversePatch: SpatialPatch;
  validation: ValidationReport;
  confidence?: number;
  timestamp: number;
}
```

提交只有在 Patch 成功应用到临时模型并通过验证后才产生。失败尝试进入审计事件，但不进入提交历史。

### 3.3 运行状态

```typescript
type AgentRunStatus =
  | 'planning'
  | 'running'
  | 'pause_requested'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'completed'
  | 'failed';
```

每个 AgentRun 包含 `runId`、当前计划、当前步骤、基础模型版本、提交列表、待处理用户指令和取消控制器。

## 4. Agent Runtime

运行流程：

```text
输入规范化
  -> Task Planner
  -> 选择下一步骤
  -> 生成 Spatial Patch
  -> Intent/Patch Validator
  -> 在临时模型上应用 Patch
  -> Geometry/Relation Validator
  -> 成功：生成 SpatialCommit、更新 UI、写审计日志
  -> 失败：写失败事件、反馈结构化错误、有限重试
  -> 到达安全点：处理暂停或追加指令
  -> 下一步骤或完成
```

默认自动连续执行。每个模型请求和每个 Patch 提交边界都是安全点。

### 4.1 工具调用与上下文管理

借鉴 HuAHua 已验证的 Agent 架构，VectorAI 使用以下约束：

- 单一 `SpatialAgentRuntime` 负责计划、工具选择、进度评估和卡住检测，不额外叠加多个监督模型。
- `SpatialCapabilityRegistry` 是工具能力的唯一事实来源，Prompt 只包含当前已注册且可用的工具。
- 每次工具调用返回结构化 `SpatialToolReceipt`，区分持久事实、单轮瞬时信号、模型变更和重规划建议。
- Context Manager 使用三层上下文：当前步骤和最近提交的热上下文、已完成阶段的压缩摘要、用户目标/单位/安全约束等稳定规则。
- 热上下文保持有界，不传输完整审计日志、所有历史模型或重复截图。
- 阶段摘要在后台生成；下一轮模型请求使用已有摘要，不等待摘要任务完成。
- 截图只在视觉验证确有价值时生成，并按当前画布版本复用；同一提交版本不得重复编码相同截图。

```typescript
interface SpatialToolReceipt {
  toolCallId: string;
  toolName: string;
  status: 'success' | 'error' | 'cancelled';
  summary: string;
  durableFacts: Record<string, unknown>;
  transientSignals: Record<string, unknown>;
  patch?: SpatialPatch;
  validation?: ValidationReport;
  needReplan: boolean;
}
```

持久事实可以进入后续上下文；`page_changed`、请求耗时、一次性视觉观察等瞬时信号只进入下一轮，不得无限累积。

### 4.2 用户干预

- **暂停**：将状态设为 `pause_requested`，当前原子请求结束后不进入下一阶段。
- **继续**：从暂停时的模型和计划恢复。
- **追加指令**：进入待处理队列；到达安全点后，以当前模型为基础重新规划尚未完成的步骤。
- **立即停止**：取消正在进行的网络请求，丢弃尚未提交的临时 Patch，保留已有提交。
- **Undo**：应用最新提交的 `inversePatch`，并移动历史游标。
- **Redo**：重新应用原提交的 `patch`。

用户追加指令不会改写已有提交历史。重新规划结果以审计事件记录。

### 4.3 验证与自动修正

验证分为：

1. Patch 结构和字段验证
2. 实体与关系引用验证
3. Patch 应用验证
4. 几何合法性验证
5. MVP 可确定检查，例如闭合轮廓检查和关系参数检查

失败时将结构化错误反馈给模型重试。首版每个阶段最多自动修正两次；第三次失败时暂停运行并向用户展示错误。不得提交未通过验证的模型。

低置信度结果可以提交，但实体、关系和对应提交在 UI 中标红，同时记录置信度。后续人工确认机制可以在同一提交门禁上扩展。

## 5. 可审计设计

开发环境默认使用本地服务端文件：

```text
.local/vectorai/runs/<runId>/
├── manifest.json
├── events.jsonl
├── inputs/
│   ├── source.sha256
│   └── source-reference.json
├── commits/
│   └── <commitId>.json
└── final-model.json
```

`.local/` 必须加入 Git 忽略。审计存储通过 `AuditStore` 接口隔离，本地实现为 `FileAuditStore`，后续可以替换为数据库或对象存储。

事件至少包括：

- 输入接收和规范化
- 使用的模型、提示模板版本及非敏感调用参数
- 初始计划和每次重规划
- 阶段开始、结束和失败
- 模型结构化响应
- Patch、逆 Patch 和验证报告
- 自动重试及原因
- 暂停、继续、停止、Undo、Redo 和追加指令
- 最终模型摘要

日志不得包含 API Key、内部令牌或模型隐藏推理。图片和 PDF 默认保存 SHA-256、媒体元数据及受控文件引用，不把 base64 内容写入 JSONL。

## 6. 可回归设计

回归测试复用审计事件格式，分为四层：

1. **Core 单元测试**：Patch 应用、逆操作、验证器和提交历史。
2. **Agent 回放测试**：使用录制的结构化模型响应，不访问真实 LLM，比较计划、提交序列、验证结果和最终模型。
3. **感知黄金样例**：图片/PDF 输入对应期望实体、关系和允许误差。
4. **可选在线评测**：使用真实模型统计成功率、重试率、几何误差和成本，不作为普通 CI 的稳定门禁。

每个回归案例包含固定输入、协议版本、提示模板版本、录制响应和断言。浮点几何比较必须使用明确容差。

现有 `test1` 工程图作为首个感知黄金样例。素材必须放入受版本管理的测试 fixture 目录，例如 `src/core/tests/fixtures/perception/test1.jpg`，不得放在会被 Vite 构建清理的 `dist/` 中；同时保存期望实体、关系、置信度区间和几何容差。

## 7. PDF 感知

首版在服务端引入 `DocumentIngestor` 接口：

```typescript
interface DocumentIngestor {
  supports(mimeType: string): boolean;
  ingest(input: Buffer): Promise<PerceptionPage[]>;
}
```

PDF 实现将页面栅格化为高分辨率图片，保留页码、尺寸和来源哈希，然后复用图片 Vision Pipeline。系统先筛选包含有效工程视图的页面，再按页产生感知结果并合并。

首版接受常见图片和 PDF，设置文件大小、页数和渲染分辨率限制。PDF 矢量对象、内嵌文字层和 OCR 混合解析仅预留扩展接口。

## 8. UI 可观测性

Construction Timeline 展示：

- 当前任务、阶段和运行状态
- 阶段目标与结构化决策摘要
- 即将或已经执行的 Patch 摘要
- 新增、修改和删除实体的画布高亮
- 验证结果、重试次数和置信度
- 提交历史与 Undo/Redo 状态
- 暂停、继续、立即停止和追加指令入口

“AI 思考过程”在产品中统一表述为“执行轨迹”或“决策摘要”，不展示隐藏推理文本。

### 8.1 回执与延迟预算

- 接收请求后立即创建 `runId` 并在 1 秒内返回 `accepted` 事件。
- 规划、模型调用、工具执行、验证和提交开始/结束时发送结构化进度事件。
- 任意运行状态下，两条用户可见事件的间隔不得超过 30 秒；若底层模型仍未返回，发送带已等待时间的 heartbeat。
- 单次模型/视觉/PDF 页面调用拥有独立 deadline 和 AbortSignal；重试共享该阶段的总预算，不能每次重试重新获得完整超时。
- 记录 `queuedMs`、`modelMs`、`toolMs`、`validationMs`、`persistMs` 和端到端耗时，用于回归比较。
- v0.1 推荐通过 Server-Sent Events 输出单向进度流；控制操作继续使用普通 HTTP 命令接口。

30 秒目标是回执 SLA，不代表复杂工程图必须在 30 秒内完成。简单文字任务仍以 30 秒内产生首个有效提交为性能目标。

## 9. 模块边界

建议新增或拆分为：

```text
src/core/
  patch/            Patch 类型、应用、逆操作、验证
  history/          Commit、Undo/Redo、快照接口
  agent/            运行状态机和纯执行逻辑
  perception/       感知结果与来源信息
api/services/
  agent-runtime/    模型调用编排、重试、取消、重规划
  audit/            AuditStore 与本地文件实现
  ingestion/        图片/PDF 输入规范化
  model-router/     模型角色和能力路由
```

React Store 只维护 UI 投影并调用运行服务，不承担 Patch 编译、历史管理或 Agent 编排。AI Gateway 只负责模型供应商适配，不负责业务状态机。

## 10. 完成标准

v0.1 Agent Workflow 满足以下条件才算完成：

- 简单文字任务可自动规划并通过多个增量提交完成。
- 用户能在安全点暂停、继续和追加指令，立即停止不会提交半成品。
- 每个模型变更都可追溯至 Patch、验证报告和提交。
- Undo/Redo 能正确恢复实体与关系。
- 纯验证阶段允许空 Patch。
- 图片和 PDF 能进入统一感知路径，并保留来源页信息。
- 低置信度结果在画布和时间线标红。
- 任一审计运行可在不访问 LLM 的情况下确定性回放。
- Agent、Patch、History、Audit 和 PDF 主流程均有自动化测试。
- 首次 `accepted` 回执不超过 1 秒，长调用期间用户可见进度间隔不超过 30 秒。
- 性能回归记录各阶段耗时，并能发现上下文增长或重复截图导致的退化。

## 11. 模型能力提示约定

常规 UI、数据接线、样式和机械性重构使用标准模型即可。以下任务开始前应提示项目负责人考虑使用更高推理能力模型：

- Spatial Patch 和协议版本的重大演进
- 多视图或标注复杂的工程图重建
- Agent 重规划、验证闭环和复杂错误恢复
- 约束冲突分析与 Constraint Solver
- 语义层到几何层的映射设计
- C++/WASM Spatial Kernel 迁移
