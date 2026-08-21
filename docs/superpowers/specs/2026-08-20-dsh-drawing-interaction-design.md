# DSH 图纸上传、矢量化、分区与标注交互设计

> 状态：已确认方向，待用户审阅规格
>
> 日期：2026-08-20
>
> 适配基线：DeepSeek Harness `0.1.0-rc.8`
>
> 上位架构：[`VectorAI → DeepSeek Harness 插件迁移方案`](../../dsh-plugin-migration.md)

## 1. 决策摘要

VectorAI 不再拥有独立聊天窗、Agent loop、Human Decision 服务或 Express API。用户只与 DSH 聊天窗和 VectorAI 第一层画布交互。

图纸工作流由四类 DSH 扩展点协作完成：

1. **DSH 附件/引用入口**：接收图片或 VectorAI Source Reference。
2. **Agent pre-step context**：把新来源解析成最小、可信、session-bound 的待导入事实。
3. **VectorAI 工具和提示段**：引导 DSH Agent 首先调用图纸导入/矢量化工具，再根据能力结果决定下一步。
4. **DSH 原生提问 + VectorAI `conversation.view`**：DSH 收集用户选择，VectorAI 画布显示 Drawing、分区和标注 Preview。

两层插件保持如下边界：

- 第一层 `2D Space & Canvas` 拥有来源导入、矢量化、Drawing IR、空间查询、Preview/Commit、画布和本地存储。
- 第二层 `Engineering Annotation` 拥有工程语义识别、分区建议、分区计划、测量、布局、覆盖率和自动标注。
- “是否需要智能分区”由第二层判断是否值得询问，但实际问题通过 DSH `ask_user_question` 提出。
- 第二层是正式、可独立安装的官方插件，不是示例；真正的示例放在 `examples/`。
- 两层先放在同一个 Git monorepo，但分别构建、测试、版本化和发布。

## 2. 设计目标

- 保留原产品“发送图纸后自动开始处理”的体验。
- 自动处理仍表现为 DSH Agent 的可见工具调用，可取消、可审计、可恢复。
- 用户不需要在 DSH 聊天窗与 VectorAI 对话框之间切换。
- 图纸导入完成后，画布立即显示真实 Drawing IR，而不是等待整段 Agent 工作流结束。
- 分区和标注的确认复用 DSH 用户问题，不维护第二套 Human Decision 状态。
- 第一层可以脱离第二层独立工作；第二层卸载后，导入、画布、查询和普通编辑仍正常。
- 相同核心逻辑也可由静态 VectorAI Web/PWA Adapter 使用。

## 3. 非目标

- 不拦截或替换 DSH 整个 `conversation.session`。
- 不把现有 `api/services/drawing-agent/runtime.ts` 平移成 DSH 插件内部 Runtime。
- 不在 Client 插件中执行正式 Drawing Commit。
- 不要求模型直接处理二进制、base64、坐标变换或完整 Drawing Document。
- 不在首版修改 DSH 原生 attachment 包，使其支持任意文件类型。
- 不通过隐藏的自动请求绕过 DSH 工具日志和取消机制。

## 4. 仓库和发布结构

首阶段采用一个 Git monorepo、多个独立 npm 包：

```text
VectorAI/
├── packages/
│   ├── drawing-core
│   ├── spatial-engine
│   ├── local-compute
│   ├── source-artifacts
│   ├── plugin-space-contracts
│   ├── plugin-dsh-space-host
│   ├── plugin-dsh-space-client
│   ├── engineering-annotation
│   └── plugin-dsh-engineering-annotation
└── examples/
    └── minimal-space-consumer
```

发布单元：

```text
@vectorai/dsh-space
@vectorai/dsh-engineering-annotation
```

实现时可以由多个内部包组成，面向用户则提供两个可安装 bundle。

第二层只能从以下包导入第一层能力：

```ts
import type {
  DrawingRef,
  PreviewHandle,
  SpatialQueryService,
  DrawingTransactionService,
  OverlayService,
} from '@vectorai/plugin-space-contracts';
```

禁止第二层深层导入 `plugin-dsh-space-host/src/*`、Client 状态或具体存储实现。CI 将第二层作为“外部消费者”执行依赖边界测试和 `pnpm pack` 安装测试。

## 5. DSH rc.8 的实际约束

### 5.1 原生图片附件

DSH `ctx.attachments` 当前提供不可变图片附件，支持 PNG、JPEG、WebP 和 GIF。图片引用跟随 session 持久化，并由模型 Adapter 读取。

第一层 Host 插件通过注入 DSH attachments seam 读取图片字节，不复制一套图片上传服务。

### 5.2 通用文件附件

DSH rc.8 的原生持久附件尚不支持 DXF、PDF、TXT 等通用文件。第一层插件因此提供自己的 `SourceArtifactStore`，但它是 DSH Host 内的本地能力，不是 VectorAI Express 服务。

浏览器端通过插件 Remote API 上传文件，Host 返回不透明 `SourceArtifactRef`。Client 把该引用作为原子 inline reference 插入普通 DSH composer 文本，使它随用户 prompt 一起进入 DSH session。

### 5.3 聊天与画布扩展

- 第一层 Client 插件向 session-scoped `conversation.view` 注册“图纸”视图。
- 文件选择按钮放在 `conversation.input.left`，较大的上传/处理状态放在 `conversation.input.dock`。
- 不替换 `conversation.session`、header 或完整 composer。
- DSH 原生 Chat 继续显示工具调用、问题、回答和最终总结。

### 5.4 用户问题

DSH `ask_user_question` 会占用原生 composer、阻塞当前工具调用直到用户回答，并把结构化答案返回 Agent。

VectorAI 不再渲染 `HumanDecisionCard`。旧卡片只在 Legacy Web Adapter 过渡期保留，DSH Adapter 不依赖它。

## 6. 来源引用协议

### 6.1 SourceArtifactRef

```ts
export interface SourceArtifactRef {
  sourceId: string;
  digest: `sha256:${string}`;
  mediaType: string;
  displayName: string;
  size: number;
  owner: {
    kind: 'dsh-session' | 'web-project';
    id: string;
  };
}
```

规则：

- `sourceId` 是不透明句柄，不编码文件系统绝对路径。
- Host 每次读取都校验 session/project ownership。
- 来源内容按 digest 不可变；相同内容可以去重，但 ownership 引用独立。
- prompt、session event 和工具结果只携带引用与安全元数据，不携带文件正文。
- 导出项目包时显式选择是否包含来源字节。

### 6.2 Composer 序列化

通用图纸来源使用可解析但不可伪造授权的引用：

```text
@[平面图.dxf](vectorai-source:src_01H...)
```

Client 显示为文件图标和文件名；剪贴板/提交文本保留 canonical reference。Host pre-step resolver 解析它并校验 source 与 session 关系。

用户手写同样格式不能获得权限；无效、跨 session 或已删除引用在 model request 前失败，并显示可操作错误。

### 6.3 图片来源

DSH 原生图片消息不需要转换成 `vectorai-source:` 文本。Layer 1 pre-step resolver 从已接受的 user message 中识别新的 ImageAttachmentRef，仅建立 session-bound pending attachment 投影，方便后续显式导入。这个投影不代表导入意图、不注入路由提示，也不启动矢量化；图片仍是 DSH 的普通多模态上下文。实际字节仍由 DSH attachment service 提供。

## 7. 按需介入 DSH 的方式

插件不能把“消息含图片”解释成“图纸导入”。图片可能是参考照片、错误截图或补充描述。图纸能力只有在用户明确要求导入为可编辑 Drawing，或当前意图明确涉及已激活 Drawing 时才介入。

### 7.1 工具语义与激活边界

第一层不注册“看到图片就先导入”的 system prompt。`drawing_import` 自身的工具描述明确规定：只有用户要求 import、convert 或 vectorize as Drawing 时才能调用；reference/supplemental image 不得调用。已有 Drawing 只获得一个条件式 capability hint，真正的工作流在 `drawing_observe` 后由 Host 状态机逐步展开。

第二层同样不能从上传附件推断分区或标注意图；它只在第一层已经存在 Drawing 且用户请求工程处理后按需激活。

### 7.2 动态 pre-step context

第一层 Host 插件监听 session-scoped `agent/pre-step`，只对当前被接受的 direct user message 做以下处理：

1. 解析 `vectorai-source:` references。
2. 识别新的 DSH image attachment references。
3. 校验 ownership、媒体类型和大小。
4. 折叠已经导入或重复的来源。
5. 只更新 Host 内部 pending attachment；不注入 import context。

DSH 原始用户消息继续携带图片供模型理解。插件既不增加一条 `drawing_import` 指令，也不因为附件存在而压过其他插件的路由。

### 7.3 防止重复处理

Host 维护派生的 `SessionDrawingBinding`：

```ts
export interface SessionDrawingBinding {
  sessionId: string;
  projectId: string;
  activeDrawing?: DrawingRef;
  sources: Array<{
    sourceId: string;
    digest: string;
    state: 'pending' | 'importing' | 'imported' | 'failed';
    drawingId?: string;
  }>;
}
```

它是工作投影，不是 Agent 状态机。真实状态仍分别来自：

- DSH session log：用户、模型、工具、问题和回答。
- Drawing transaction log：正式图纸状态。
- SourceArtifactStore：不可变来源。

相同 digest 在相同 project 已导入时，`drawing_import` 返回幂等结果，不重复矢量化或创建 Drawing。

## 8. 第一层工具协议

### 8.1 drawing_import

```ts
interface DrawingImportInput {
  sourceRefs?: string[];
  mode?: 'auto' | 'replace-active' | 'new-drawing';
}

interface DrawingImportResult {
  drawingRef: DrawingRef;
  sources: Array<{
    sourceRef: string;
    importer: 'dxf' | 'pdf-vector' | 'pdf-raster' | 'image-vectorize';
    status: 'imported' | 'reused';
  }>;
  summary: DrawingSummary;
  capabilities: {
    spatialQuery: true;
    preview: true;
    engineeringInspection: boolean;
  };
  diagnostics: ImportDiagnostic[];
}
```

当 `sourceRefs` 省略时，工具导入当前 session 最新一组已校验、尚未导入的 pending sources。这样模型不必复制长句柄；显式 refs 只用于多图纸选择。

### 8.2 按来源类型处理

| 来源 | 第一层导入路径 |
|---|---|
| DXF | Lossless Manifest → Drawing IR projector；不做无意义栅格矢量化 |
| 矢量 PDF | PDF path/text extraction → Drawing IR |
| 栅格 PDF | 本地 PDF raster → image vectorization → Drawing IR |
| 图片 | decode → clean-line/vectorization → Drawing IR |

“转换成矢量”是用户可理解的统一阶段名；内部根据来源选择正确 importer。

### 8.3 执行与取消

首版 `drawing_import` 是一个可取消的前台 DSH tool call：

- CPU 密集部分在 Worker/WASM 中运行。
- DSH tool `AbortSignal` 传播到 importer 和 Worker。
- Remote progress event 更新画布和 composer dock。
- 取消不提交半成品 Drawing revision。
- 成功后只进行一次原子导入 Commit。

如果真实 PDF/CV 基准超过交互式工具预算，再把内部执行迁到 DSH Jobs；工具协议和 Drawing 状态不变。

### 8.4 进度事件

```ts
type DrawingProgressEvent = {
  sessionId: string;
  operationId: string;
  kind: 'import' | 'partition' | 'annotation';
  stage: string;
  progress?: number;
  drawingRef?: DrawingRef;
  message: string;
};
```

事件用于 UI，不进入模型上下文。最终工具结果才是模型可见的权威摘要。

## 9. 第二层分区与标注介入

### 9.1 engineering_inspect

导入成功后，DSH Agent 在第二层可见时调用：

```ts
interface EngineeringInspectionResult {
  drawingRef: DrawingRef;
  recognizedFacts: EngineeringFactSummary;
  partitionRecommendation:
    | { recommended: false; reason: string }
    | {
        recommended: true;
        reason: string;
        strategy: 'steps' | 'regions' | 'sheets';
        estimatedPartitions: number;
      };
  annotationCapabilities: string[];
  uncertainties: EngineeringUncertainty[];
}
```

第一层可以提供通用 cluster/topology facts，但“这些区域是否构成工程分区、是否值得向用户推荐”属于第二层。

### 9.2 询问是否智能分区

只有 `recommended: true` 时，第二层提示规则要求 Agent 调用 DSH：

```ts
ask_user_question({
  questions: [{
    id: 'engineering_partition',
    header: '智能分区',
    question: '检测到多个工程区域，是否先生成智能分区预览？',
    options: [
      {
        label: '生成分区（推荐）',
        description: '先确认区域边界，再按区域自动标注。',
      },
      {
        label: '跳过分区',
        description: '直接使用整张图纸进行后续操作。',
      },
    ],
  }],
});
```

问题文本可根据真实 inspection 结果调整，但不得在没有 recommendation evidence 时机械询问。

### 9.3 engineering_preview_partition

第二层生成 Partition Plan，随后通过第一层公开服务创建 Preview：

```text
Engineering facts
→ Partition Plan
→ Layer 1 Drawing commands / overlays
→ Layer 1 PreviewHandle
→ conversation.view 显示边界和标签
```

第二层不直接修改 Drawing repository。

### 9.4 确认与修改

- 分区 Preview 显示在第一层画布。
- Agent 使用 DSH `ask_user_question` 询问“确认、修改、取消”。
- 用户选择修改时，答案和补充文本进入同一个 DSH turn，Agent 调用 `engineering_preview_partition` 生成替换 Preview。
- 用户确认后，Agent 调用第一层 `drawing_commit_preview`。
- 分区 Commit 后才进入自动标注阶段。

首版画布只提供查看、选择、缩放和空间指示，不在画布中另设一套“确认”业务按钮。未来若增加画布确认按钮，它也必须响应同一个 DSH pending question，不能创建旁路状态。

### 9.5 自动标注

```text
Committed partitions or whole drawing
→ engineering_plan_annotations
→ engineering_preview_annotations
→ Layer 1 PreviewHandle
→ coverage/collision/validity diagnostics
→ DSH question when confirmation is required
→ drawing_commit_preview
```

确定性导入或用户已明确要求“一键自动标注”时，可以根据配置省略部分确认，但正式 Commit 仍走第一层。

## 10. DSH Chat 与 Canvas 的职责

| 表面 | 展示内容 | 不负责 |
|---|---|---|
| DSH Chat | 用户目标、工具调用、问题、回答、最终摘要 | 逐图元渲染、空间选择 |
| DSH composer dock | 当前导入/分区/标注进度与 pending source chip | 保存正式 Drawing |
| VectorAI Canvas view | Drawing、选择、Overlay、Preview diff、诊断 | Agent loop、模型消息 |
| DSH tool details | 结构化工具结果、诊断、可审计摘要 | Drawing 正式状态 |

用户切回 Chat 不会卸载 Canvas；切回 Canvas 不会复制 session。两者通过 `sessionId + DrawingRef` 关联。

## 11. 工具可见性与安装组合

只安装第一层：

```text
drawing_import
drawing_summarize
drawing_query
drawing_observe
drawing_preview_transaction
drawing_commit_preview
drawing_discard_preview
```

再安装第二层后增加：

```text
engineering_inspect
engineering_preview_partition
engineering_plan_annotations
engineering_preview_annotations
engineering_validate_annotations
```

第二层插件使用 Cordis inject 声明第一层服务是必需依赖。如果第一层不存在，第二层必须在 composition 阶段给出明确缺失依赖错误，不能静默注册一组运行时必失败的工具。

## 12. Web/PWA Adapter 的同构流程

静态网站没有 DSH Agent，因此 Adapter 替换的是编排入口，不是业务能力：

```text
DSH Adapter:
  prompt/reference → pre-step → model tool → ask_user_question

Web Adapter:
  file picker → application action → Web modal/command bar

Shared:
  SourceArtifact → import/vectorize → DrawingRef → partition/annotation Preview
```

Web/PWA 可以保留产品化按钮和向导，但必须调用相同 application contracts。DSH-specific prompt、tool 和 question code 不得进入共享核心。

## 13. 错误处理

| 错误 | 行为 |
|---|---|
| 引用无效或跨 session | pre-step 拒绝本轮并提示重新选择文件 |
| 不支持媒体类型 | `drawing_import` 返回稳定错误码和支持列表 |
| 导入取消 | Worker 停止，不提交 revision，source 回到 pending |
| 导入失败 | source 标记 failed，可在下一轮重试；失败不创建半成品 Drawing |
| revision stale | Preview/Commit 返回 stale，Agent 重新 summarize/query |
| 第二层未安装 | 第一层结果 `engineeringInspection: false`，不建议分区 |
| 第一层未安装 | 第二层 composition 失败并指出所需 package |
| DSH Remote 断线 | Host 继续拥有状态；Client 重连后读取 authoritative projection |
| 模型未遵循导入提示 | 后续 drawing/engineering 工具因无 active Drawing 返回 `DRAWING_REQUIRED`，引导调用 `drawing_import` |

## 14. 安全与隐私

- 所有文件和 Drawing 数据默认只存本机。
- Remote API 只接受当前连接/session 有权访问的 source/drawing handles。
- Tool 输入不接受任意 Host 绝对路径；本地 workspace 文件走 DSH file reference/权限体系。
- Source ref、Drawing ref 和 Preview handle 都不可作为跨 session 权限凭证。
- 日志不保存文件正文、base64、模型密钥或完整来源路径。
- Derived raster、Pick map 和 Preview image 是可删除缓存。

## 15. 测试策略

### 15.1 第一层

- 图片附件 → pending source → `drawing_import`。
- DXF/PDF Remote upload → canonical reference → pre-step validation。
- 相同 digest 幂等导入。
- 取消导入不产生 revision。
- Tool result 与 Canvas Remote projection 使用相同 DrawingRef。
- 插件 dispose 后 Worker、listener 和 Remote subscription 全部释放。

### 15.2 第二层

- 无推荐时不要求分区。
- 有推荐时生成结构化 question intent。
- 用户跳过分区时不生成 Partition Preview。
- 用户确认/修改分别走 Commit/replace Preview。
- 第二层源码没有第一层内部 deep import。
- 卸载第二层后第一层 E2E 仍通过。

### 15.3 DSH 集成

- 新图片 prompt 的第一项 Drawing 动作是 `drawing_import`。
- 原生 ask-user composer takeover 可回答分区问题。
- Chat 工具状态与 Canvas 进度一致。
- session reload 后 Drawing binding 可恢复。
- DSH `0.1.0-rc.8` mount/dispose smoke test。

### 15.4 Web Adapter

- 无 Express 时，文件导入、Preview、保存、重开和导出可用。
- DSH 和 Web 对同一 fixture 产生相同 Drawing/Partition/Annotation digest。

## 16. 分阶段实现

### Slice 1：图片纵向闭环

```text
DSH image attachment
→ pre-step pending source
→ drawing_import
→ in-memory Drawing repository
→ conversation.view canvas
→ drawing_summarize
```

只支持一张图片和最小矢量化 fixture，用于验证 DSH 介入机制。

### Slice 2：通用文件引用

增加 DXF/PDF 本地 SourceArtifactStore、Remote upload、composer 文件引用和 DXF importer。

### Slice 3：智能分区

安装第二层，完成 `engineering_inspect → ask_user_question → partition Preview → Commit`。

### Slice 4：自动标注

完成 measurement/layout/coverage 工具和 Annotation Preview/Commit。

### Slice 5：静态 Web 对齐

让 Web Adapter 使用同一套 source/import/partition/annotation application contracts，并关闭 Express 验收。

## 17. 验收标准

- 用户在 DSH 发送图片后，Agent 的第一项图纸动作是可见的 `drawing_import`。
- 导入过程可取消，失败或取消不留下半成品 Drawing。
- 导入成功后不等待对话结束即可在“图纸”Tab 看到矢量结果。
- 第二层只在有证据支持时询问智能分区，并使用 DSH 原生问题 UI。
- 分区和标注 Preview 都由第一层生成和提交。
- 只安装第一层时系统仍完整支持导入、画布、查询和普通编辑。
- 第二层可独立安装/卸载，不依赖第一层内部源码。
- DXF/PDF 通用文件由本地 Host 插件保存，不经过 VectorAI 云端或 Express。
- 静态 Web/PWA 使用相同核心，只更换 Adapter。

## 18. 已确认的产品决策

- 采用“DSH Agent 收到图纸后自动调用导入工具”的交互，而不是 Client 隐式后台处理或每次先询问是否矢量化。
- 一个 Git monorepo，两个正式可安装插件，多个独立 npm 包。
- 第二层是官方工程标注插件，不是示例；另设最小外部消费者示例。
- 业务确认优先使用 DSH 原生 `ask_user_question`。
- 第一层画布是附加 `conversation.view`，不替换 DSH Chat。
