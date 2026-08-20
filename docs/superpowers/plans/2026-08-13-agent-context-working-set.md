# Agent 上下文工作集与调用可观测性实施计划

> **目标：** 完成模型链路阶段 1 与阶段 2：先让每次调用可解释、可度量，再把“整图反复发送”迁移为“全局地图 + 局部工作集 + 证据账本”。

**架构原则：** Drawing IR 仍是唯一事实源，模型拥有完整编辑能力；压缩层只改变信息的组织和按需读取方式，不用硬编码业务动作限制模型。视觉图像与向量事实均带 revision/observation 引用，模型需要更多信息时通过工具主动扩展工作集。

**验收基线：** 单轮至多携带一张当前相关图像；同一 `render_drawing` 结果不再同时以 observation、vectorDigest 和历史 tool output 三份进入上下文；模型调用审计包含请求字节、图像数量/像素、TTFB、总耗时、finish reason、request id 和 token usage；`summarize()` 不读取 Commit 列表；复杂图纸上下文由节点总数线性增长改为由工作集上限控制。

---

## Task 1：模型调用遥测与可诊断错误

**Files:**
- Modify: `api/services/ai-gateway.ts`
- Modify: `api/services/ai-gateway-drawing.test.ts`
- Modify: `api/services/drawing-agent/model-loop-adapter.ts`
- Modify: `api/services/drawing-agent/model-loop-runtime.ts`
- Modify: `api/services/drawing-agent/audit-types.ts`
- Test: `api/services/drawing-agent/model-loop-runtime.test.ts`

- [x] 先补失败测试：成功响应上报 request id、finish reason、tokens、请求字节、图像数量、TTFB/总耗时。
- [x] 先补失败测试：HTTP 200 但内容为空时，错误明确区分 `finish_reason=length`，并保留安全遥测。
- [x] 在 gateway 构造序列化 body 后统一计算请求与图像指标，并从响应 headers/body 提取服务端元数据。
- [x] 通过 adapter callback 将每次调用指标写入 run audit，不记录 base64、密钥或原始私密正文。
- [x] 运行：`pnpm vitest run api/services/ai-gateway-drawing.test.ts api/services/drawing-agent/model-loop-runtime.test.ts`

## Task 2：单视觉工作集与 Source 按需策略

**Files:**
- Add: `api/services/drawing-agent/visual-working-set.ts`
- Add: `api/services/drawing-agent/visual-working-set.test.ts`
- Modify: `api/services/drawing-agent/model-loop-runtime.ts`
- Modify: `api/services/drawing-agent/model-loop-adapter.ts`
- Test: `api/services/drawing-agent/model-loop-adapter.test.ts`
- Test: `api/services/drawing-agent/model-loop-runtime.test.ts`

- [x] 先补失败测试：overview、target detail、preview 同时存在时只发送优先级最高且最新的一张。
- [x] 先补失败测试：Source 只在首次需要视觉建立语境时发送；成功建立语境后不在每轮重复发送，失败重试仍可复用。
- [x] 实现 `selectVisualWorkingSet`，用 `preview > target-detail/user-viewport > overview` 和新鲜度选择单个 observation。
- [x] 将 Source 改为 episode 级一次性 bootstrap/显式工具读取，不再与每轮 drawing observation 并发重复。
- [x] 运行：`pnpm vitest run api/services/drawing-agent/visual-working-set.test.ts api/services/drawing-agent/model-loop-adapter.test.ts api/services/drawing-agent/model-loop-runtime.test.ts`

## Task 3：Summary 快路径与历史解耦

**Files:**
- Modify: `api/services/drawing-application/application.ts`
- Modify: `api/services/drawing-application/application.test.ts`

- [x] 先补失败测试：`summarize/query/inspect/render/observe` 不调用 `listCommits()`。
- [x] 为只需要当前 revision 的读操作建立按 drawing ID 定位的 checkpoint 快路径；`open()` 保留包含 Commit 历史的显式语义。
- [x] 确认并发 revision 校验、preview 和 commit 行为不变。
- [x] 运行：`pnpm vitest run api/services/drawing-application/application.test.ts api/services/drawing-application/file-drawing-repository.test.ts`

## Task 4：重叠式多尺度空间索引

**Files:**
- Add: `api/services/drawing-spatial/context-index.ts`
- Add: `api/services/drawing-spatial/context-index.test.ts`
- Modify: `src/drawing/index.ts`（仅在需要导出既有 bounds 工具时）

- [x] 先补失败测试：节点跨区域时可同时出现在重叠查询中，不因硬切块丢失完整图元。
- [x] 先补失败测试：全局地图只暴露 bounds、单位、类型计数、区域统计和拓扑摘要，不枚举全部完整节点。
- [x] 实现只读空间索引：全局 bounds、相对比例 padding、自适应区域树、bounds 查询和邻域扩张。
- [x] 工作集支持由选中节点、最近 affected nodes、空间邻居与显式关系共同扩张，并设置软上限和截断标志。
- [x] 运行：`pnpm vitest run api/services/drawing-spatial/context-index.test.ts`

## Task 5：revision-bound 别名与证据账本

**Files:**
- Add: `api/services/drawing-agent/context-ledger.ts`
- Add: `api/services/drawing-agent/context-ledger.test.ts`
- Modify: `api/services/drawing-agent/model-loop-runtime.ts`
- Modify: `api/services/drawing-agent/model-loop-adapter.ts`
- Test: `api/services/drawing-agent/model-loop-adapter.test.ts`
- Test: `api/services/drawing-agent/model-loop-runtime.test.ts`

- [x] 先补失败测试：长 node id 投影为 revision-bound 短别名，模型返回别名时在工具调用前可靠还原。
- [x] 先补失败测试：revision 改变后失效的节点事实不会继续作为当前事实发送。
- [x] 先补失败测试：`render_drawing` 的 `vectorDigest/views`、重复 observation grounding 和历史全量 output 不再重复进入上下文。
- [x] 实现 append-only evidence receipt；节点检查结果按 node/revision 合并为当前事实，工具调用历史只发送短引用和必要 delta。
- [x] adapter 公共上下文改为 `globalMap + workingSet + evidenceLedger + activeInstructions`，保留诊断与用户决策的短窗口。
- [x] 在 registry 执行前递归解析短别名，不改变工具协议和 Drawing IR。
- [x] 运行：`pnpm vitest run api/services/drawing-agent/context-ledger.test.ts api/services/drawing-agent/model-loop-adapter.test.ts api/services/drawing-agent/model-loop-runtime.test.ts`

## Task 6：上下文预算、回归与文档

**Files:**
- Add: `api/services/drawing-agent/context-budget.test.ts`
- Modify: `docs/tech-architecture.md`
- Modify: `docs/prd.md`

- [x] 建立 100+ 节点、两次 observation、多个 tool result 的回归样本，记录旧/新 JSON 字节数。
- [x] 断言单轮视觉数量 `<= 1`，文本上下文受工作集预算约束，且 exact node facts 仍足够执行编辑。
- [x] 运行阶段 1/2 全部定向测试、`pnpm check` 和现有 agent/application/spatial 回归。
- [x] 对本地真实 drawing 做一次 dry-run/捕获调用测量，报告请求体、模型耗时与上下文构成；不以固定 30 秒作为正确性门槛。
- [x] 更新技术架构与 PRD，注明模型可替换、视觉/纯推理能力分层和按需上下文协议。
