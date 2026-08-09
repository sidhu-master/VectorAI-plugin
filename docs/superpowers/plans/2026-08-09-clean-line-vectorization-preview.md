# Clean Line Vectorization Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `test2.png` 的干净线稿稳定转换为先 Polyline、后规范 CAD 图元的真实增量 Commit，并在本地网页中完整预览。

**Architecture:** Node Agent Runtime 继续拥有 Drawing IR、事务和审计权威；常驻 Python Worker 只返回中心线、笔画链和经过数值验证的解析图元候选。Feedback Loop 在调用模型前执行确定性 bootstrap：逐链提交 Polyline，再用同一稳定 ID 原子替换为通过门限的 Line/Circle/Arc/Ellipse，之后现有 AI loop 只处理残差和歧义。

**Tech Stack:** TypeScript 5.8、Vitest、Node child_process/NDJSON、Python 3.11+、NumPy、OpenCV headless、scikit-image、SciPy、React/SVG Canvas。

## Global Constraints

- 直接在当前 `main` 工作；不创建分支或 worktree。
- 不覆盖当前工作区中与本计划无关的未提交改动。
- Evidence 使用源像素左上原点、y 向下；Drawing IR 使用页面宽 500 mm、y 向上。
- 首个状态目标 1 秒内，`test2` 首批图元目标 5 秒内，完整 Polyline 底稿目标 10 秒内，25 秒内必须有进度。
- CV/AI 只能产生证据和候选；DrawingToolRegistry 的 Preview/Commit 是唯一写入路径。
- 解析提升失败必须保留 Polyline；禁止产生源图不存在的大圆或静默丢线。
- 每个新增生产函数先有失败测试，再写最小实现。

---

### Task 1: Python 中心线与图元拟合引擎

**Files:**
- Create: `python/requirements-vectorization.txt`
- Create: `python/vectorai_vectorizer.py`
- Create: `python/tests/test_vectorai_vectorizer.py`
- Create: `scripts/setup-vectorization-python.sh`

**Interfaces:**
- Consumes: NDJSON `{id, operation:"vectorize", imageBase64, mimeType, sourceId, maxPixels}`。
- Produces: NDJSON `{id, ok:true, value:{sourceId,width,height,analysisScale,medianLineWidthPx,chains}}`。
- `chains[]` 固定包含 `id`、`closed`、`samples`、`simplified`、`bounds`、`candidate`；candidate 类型为 `line|circle|arc|ellipse|null` 并包含误差指标。

- [ ] **Step 1: 写骨架图的失败测试**

```python
def test_vectorize_mask_returns_one_centerline_for_thick_stroke(self):
    mask = np.zeros((80, 120), dtype=np.uint8)
    cv2.line(mask, (10, 40), (110, 40), 9, 255)
    result = vectorize_mask(mask, source_id="synthetic")
    long_chains = [c for c in result["chains"] if c["bounds"][2] > 90]
    self.assertEqual(len(long_chains), 1)
    self.assertEqual(long_chains[0]["candidate"]["type"], "line")
```

- [ ] **Step 2: 在项目 venv 中安装固定依赖并确认测试因接口不存在而失败**

Run: `bash scripts/setup-vectorization-python.sh && .local/vectorai/cv-venv/bin/python -m unittest python.tests.test_vectorai_vectorizer -v`

Expected: FAIL，原因为 `vectorize_mask` 尚不存在，而非依赖或导入错误。

- [ ] **Step 3: 实现二值化、线宽估计、skeletonize 和拓扑链提取**

实现要点：

```python
def vectorize_mask(mask: np.ndarray, source_id: str, source_size=None) -> dict:
    foreground = mask > 0
    skeleton = skeletonize(foreground)
    chains = trace_stroke_chains(skeleton)
    return serialize_result(source_id, foreground, chains, source_size)
```

对相邻非二度节点聚类；显式处理全为二度节点的闭环；对角边在存在正交连接时去重；只裁剪不降低覆盖率的短毛刺。

- [ ] **Step 4: 运行骨架测试至通过**

Run: `.local/vectorai/cv-venv/bin/python -m unittest python.tests.test_vectorai_vectorizer.VectorizerTests.test_vectorize_mask_returns_one_centerline_for_thick_stroke -v`

Expected: PASS。

- [ ] **Step 5: 写 Circle/Arc/Polyline 降级和假大圆保护测试**

```python
def test_closed_ring_promotes_to_circle(self):
    angles = np.linspace(0, 2 * np.pi, 240, endpoint=False)
    points = np.column_stack((60 + 25 * np.cos(angles), 50 + 25 * np.sin(angles)))
    candidate = fit_best_candidate(points, closed=True, median_line_width=5)
    self.assertEqual(candidate["type"], "circle")
    self.assertAlmostEqual(candidate["parameters"]["radius"], 25, delta=0.5)

def test_open_semicircle_promotes_to_arc(self):
    angles = np.linspace(0, np.pi, 120)
    points = np.column_stack((60 + 25 * np.cos(angles), 50 + 25 * np.sin(angles)))
    candidate = fit_best_candidate(points, closed=False, median_line_width=5)
    self.assertEqual(candidate["type"], "arc")
    self.assertGreater(candidate["parameters"]["sweepDegrees"], 170)

def test_low_curvature_chain_does_not_become_huge_circle(self):
    x = np.linspace(0, 100, 100)
    points = np.column_stack((x, 20 + 0.001 * x * x))
    candidate = fit_best_candidate(points, closed=False, median_line_width=3)
    self.assertNotEqual(candidate and candidate["type"], "arc")

def test_unfittable_curve_remains_polyline(self):
    points = np.array([[0, 0], [20, 10], [5, 30], [35, 40], [10, 60]], dtype=float)
    candidate = fit_best_candidate(points, closed=False, median_line_width=2)
    self.assertIsNone(candidate)
```

手工断言候选类型、圆心/半径误差、弧角覆盖和 `fitErrorP95`；错误的大半径候选必须为 `None`。

- [ ] **Step 6: 确认四个新增测试先失败，再实现候选竞争与门限**

候选只在 `fitErrorP95 <= max(1.5, 0.5 * medianLineWidth)`、拓扑合法且不超出 bbox 半径门限时返回。闭环优先 Circle/Ellipse；开放链竞争 Line/Arc；否则 candidate 为 `null`。

- [ ] **Step 7: 实现 NDJSON 常驻进程并跑完整 Python 测试**

Run: `.local/vectorai/cv-venv/bin/python -m unittest discover -s python/tests -v`

Expected: 所有 Python 测试 PASS，stderr 无协议正文。

- [ ] **Step 8: 提交**

```bash
git add python scripts/setup-vectorization-python.sh
git commit -m "feat: add clean line vectorization worker"
```

### Task 2: Node Python Provider 与 Evidence 持久化

**Files:**
- Create: `api/services/drawing-vectorization/types.ts`
- Create: `api/services/drawing-vectorization/python-provider.ts`
- Create: `api/services/drawing-vectorization/python-provider.test.ts`
- Create: `api/services/drawing-vectorization/service.ts`
- Create: `api/services/drawing-vectorization/service.test.ts`

**Interfaces:**
- Produces `CleanLineVectorizationProvider.vectorize(input): Promise<CleanLineVectorizationResult>`。
- `CleanLineVectorizationService.vectorizeSource(input: {sourceId:string; signal:AbortSignal; maxPixels:number})` 读取 StoredSourceCvGateway，调用 Provider，将每条完整采样写入 FileCvEvidenceStore，并返回 evidence handle。

- [ ] **Step 1: 写 Provider 成功、超时、取消和进程退出的失败测试**

测试通过临时可执行 Python fixture 回显 NDJSON，不 mock `child_process`；断言同一进程复用、响应 ID 匹配、AbortSignal 生效、媒体正文不出现在错误信息。

- [ ] **Step 2: 运行测试并确认因 Provider 不存在而失败**

Run: `npx vitest run api/services/drawing-vectorization/python-provider.test.ts`

- [ ] **Step 3: 实现常驻 PythonVectorizationProvider**

Provider 查找顺序：`VECTORAI_CV_PYTHON` → `.local/vectorai/cv-venv/bin/python` → `python3`；启动时执行 `health` 握手，逐行解析 stdout，stderr 仅保留有界诊断，单请求默认 30 秒超时，`close()` 终止进程并拒绝 pending。

- [ ] **Step 4: 运行 Provider 测试至通过**

Run: `npx vitest run api/services/drawing-vectorization/python-provider.test.ts`

- [ ] **Step 5: 写 Service Evidence 测试并确认先失败**

使用真实内存 source/evidence gateway，断言每条 chain 的 handle 可分页读取、点坐标保持源像素空间、相同输入得到相同 handle。

- [ ] **Step 6: 实现 Service 并运行测试**

Run: `npx vitest run api/services/drawing-vectorization/service.test.ts api/services/drawing-vectorization/python-provider.test.ts`

- [ ] **Step 7: 提交**

```bash
git add api/services/drawing-vectorization
git commit -m "feat: add python vectorization provider"
```

### Task 3: Polyline 初稿与规范图元提升计划

**Files:**
- Create: `api/services/drawing-vectorization/build-steps.ts`
- Create: `api/services/drawing-vectorization/build-steps.test.ts`

**Interfaces:**
- Consumes: `PersistedCleanLineVectorizationResult`。
- Produces: `DrawingVectorizationStep[]`，每步含 `kind:"draft"|"promotion"`、`chainId`、`slotEvidence`、`previewNode`、`commands`、`bounds`、`confidence`、`validation`。

- [ ] **Step 1: 写坐标、稳定 ID、初稿和提升的失败测试**

```ts
expect(draft.previewNode).toMatchObject({
  id: stableId, type: 'polyline', closed: true,
  vertices: [{ point: [50, 350] }, { point: [100, 300] }],
});
expect(promotion.commands.map(c => c.type)).toEqual([
  'geometry.delete', 'geometry.create',
]);
expect((promotion.commands[1] as {value:{id:string}}).value.id).toBe(stableId);
```

源图 1000×800 时 `[100,100]` 映射为 `[50,350]`；同一 chain 的 draft/promotion 必须复用同一节点 ID。

- [ ] **Step 2: 运行并确认失败**

Run: `npx vitest run api/services/drawing-vectorization/build-steps.test.ts`

- [ ] **Step 3: 实现 buildVectorizationSteps**

先按 bbox 面积从大到小输出所有 draft，再按候选置信度输出 promotion。Polyline 最多 256 顶点；解析候选必须再次通过 TS 防线：有限数值、P95 门限、Circle 仅闭环、Arc 角覆盖 5°–330°、半径不超过链 bbox 对角线四倍。

- [ ] **Step 4: 增加“错误大圆保留 Polyline”的失败测试并实现**

候选半径为 bbox 对角线 20 倍时，steps 只能包含 draft，不能产生 promotion。

- [ ] **Step 5: 运行测试至通过**

Run: `npx vitest run api/services/drawing-vectorization/build-steps.test.ts`

- [ ] **Step 6: 提交**

```bash
git add api/services/drawing-vectorization/build-steps.ts api/services/drawing-vectorization/build-steps.test.ts
git commit -m "feat: build auditable vectorization steps"
```

### Task 4: Feedback Loop 确定性 Bootstrap 与真实渐进 Commit

**Files:**
- Modify: `api/services/drawing-feedback/loop-controller.ts`
- Modify: `api/services/drawing-feedback/loop-controller.test.ts`

**Interfaces:**
- Constructor 新增可选 `vectorization?: Pick<CleanLineVectorizationService, 'vectorizeSource'>`。
- 首次运行且无 checkpoint 时，先产生 vectorization steps；每步通过 `preview_transaction` 和 `commit_transaction`，输出真实 `proposal`、`drawing_tool`、`commit`、`correction`。
- Bootstrap 后重新计算全图 residual；已收敛直接完成，未收敛才进入现有模型循环。

- [ ] **Step 1: 写失败测试：Polyline 必须先于 Circle 提交**

测试提供一条闭环 chain 和 Circle candidate，收集输出并断言两个 Commit 的文档顺序是 `polyline → circle`，proposal 出现在对应 Commit 前，模型在 bootstrap 完成前未被调用。

- [ ] **Step 2: 运行并确认失败**

Run: `npx vitest run api/services/drawing-feedback/loop-controller.test.ts -t "bootstraps"`

- [ ] **Step 3: 实现 bootstrap 执行器**

每步：安全点检查 → 注册/更新 slot → DrawingTool preview → proposal → commit → slot lineage → correction。单步失败记录 reject 并继续下一 chain；不能让一个坏候选中止整张图。

- [ ] **Step 4: 写暂停和坏 promotion 回退测试并确认失败**

暂停发生在事务前；坏 promotion 被拒绝后文档仍保留相同 ID 的 Polyline；恢复时不重复已提交 draft。

- [ ] **Step 5: 实现 checkpoint 的 vectorization 游标并跑完整 loop 测试**

Run: `npx vitest run api/services/drawing-feedback/loop-controller.test.ts`

- [ ] **Step 6: 提交**

```bash
git add api/services/drawing-feedback/loop-controller.ts api/services/drawing-feedback/loop-controller.test.ts
git commit -m "feat: bootstrap feedback loop from vector strokes"
```

### Task 5: 应用启动、进度展示与本地开发命令

**Files:**
- Modify: `api/app.ts`
- Modify: `api/services/drawing-agent/runtime.ts`
- Modify: `api/services/drawing-agent/runtime.test.ts`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- App 启动时创建一个 PythonVectorizationProvider，并在 `closeAppServices()` 关闭。
- Runtime 对 bootstrap proposal/commit 沿用 `perception_delta` 和 `commit` 事件；任务面板标题使用“正在提取中心线 / 正在绘制矢量底稿 / 正在提升规范图元”，不显示模型名。
- `npm run setup:vectorization` 安装本地 venv；`npm run benchmark:test2` 运行真实基准脚本。

- [ ] **Step 1: 写 Runtime 进度顺序失败测试**

构造反馈输出 `state OBSERVE → proposal polyline → commit → proposal circle → commit → completed`，断言公开进度不包含 modelName，且两个 perception delta 与两个 commit 顺序一致。

- [ ] **Step 2: 运行并确认失败**

Run: `npx vitest run api/services/drawing-agent/runtime.test.ts -t "vectorization"`

- [ ] **Step 3: 实现 App wiring 和中文进度映射**

Python Provider 创建失败时服务器仍可启动并记录一次明确告警，旧 CV/AI loop 作为降级；Provider 可用时将 vectorization service 注入 Feedback Loop。

- [ ] **Step 4: 更新开发命令和 README，运行相关测试**

Run: `npx vitest run api/services/drawing-agent/runtime.test.ts api/services/drawing-feedback/loop-controller.test.ts api/services/drawing-vectorization/*.test.ts`

- [ ] **Step 5: 提交**

```bash
git add api/app.ts api/services/drawing-agent/runtime.ts api/services/drawing-agent/runtime.test.ts package.json README.md
git commit -m "feat: wire progressive vectorization into local runtime"
```

### Task 6: `test2` 真实回归与浏览器验收

**Files:**
- Create: `scripts/benchmark-test2.ts`
- Create: `api/services/drawing-vectorization/test2.integration.test.ts`
- Modify: `docs/superpowers/specs/2026-08-09-clean-line-vectorization-and-primitive-promotion-design.md`

**Interfaces:**
- `npm run benchmark:test2` 读取仓库根目录 `test2.png`，调用真实 Python Worker，输出 `.local/vectorai/baselines/test2/report.json` 和 `result.svg`。
- report 固定包含耗时、chainCount、draftCount、promotionCount、typeCounts、coverage、最大候选半径比和错误列表。

- [ ] **Step 1: 写真实集成测试并确认当前失败**

断言：chain 数大于 20；draft 数等于 chain 数；至少有 Line 和 Circle/Arc promotion；所有源点在边界内；不存在半径超过源图对角线的候选；首批结果不为空。

- [ ] **Step 2: 运行真实 `test2` 测试并修正通用算法**

Run: `.local/vectorai/cv-venv/bin/python -m unittest discover -s python/tests -v && npx vitest run api/services/drawing-vectorization/test2.integration.test.ts`

只允许调整线宽归一化、通用拟合门限和拓扑算法，不允许文件名或坐标特判。

- [ ] **Step 3: 生成 SVG/JSON 基准并目视检查**

Run: `npm run benchmark:test2`

Expected: `report.json` 无 `OUT_OF_BOUNDS`、`FALSE_GIANT_CIRCLE`、`EMPTY_DRAFT`；`result.svg` 方向正确、宽度 500、主体占满合理视口。

- [ ] **Step 4: 运行完整验证**

Run: `npm run check && npm test -- --run && npm run build`

Expected: TypeScript 0 errors；全部测试通过；生产构建成功。

- [ ] **Step 5: 启动本地服务器并用浏览器真实上传 `test2.png`**

Run: `npm run dev`

验收：画布先出现 Polyline，再出现解析图元替换；拖动画布无闪烁，y 方向正确，默认页面宽 500 mm，任务面板有持续进度且不显示模型名。

- [ ] **Step 6: 提交**

```bash
git add scripts/benchmark-test2.ts api/services/drawing-vectorization/test2.integration.test.ts docs/superpowers/specs/2026-08-09-clean-line-vectorization-and-primitive-promotion-design.md
git commit -m "test: establish test2 vectorization preview"
```
