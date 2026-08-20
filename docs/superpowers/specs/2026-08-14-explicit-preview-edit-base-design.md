# 显式 Preview 编辑基线与候选修订设计

> 状态：用户已确认
>
> 日期：2026-08-14

## 1. 决策

主模型拥有两种同等合法的编辑选择，并且每次写入都必须显式说明基于哪一步：

1. **从正式版本重做**：舍弃当前候选，基于当前 canonical revision 创建一个完整的新 Preview。
2. **基于当前候选修订**：保留当前 Preview 已有修改，只提交相对该候选的纠正。

Runtime 不替模型选择策略。它只把两个可用基线、准确句柄和摘要告诉模型，校验模型声明的基线，并把候选修订编译成仍可独立提交的完整事务。

## 2. 当前问题

现有上下文只提供 `currentPreviewHandle`，但 `preview_transaction` 永远从正式 revision 独立计算。模型看到的是上一个候选画面，写入语义却要求它重新输出完整事务。

这会产生一种协议错觉：模型自然地把下一轮当作对当前候选的增量修订，而后端实际把它当作对正式版本的替换。上一候选中未被重复输出的正确修改因此消失。继续强化提示词不能消除这种语义冲突。

## 3. 模型上下文契约

每轮公开上下文增加 `editBaseOptions`。没有候选时只提供正式版本选项：

```ts
editBaseOptions: {
  startFromCanonical: {
    tool: 'preview_transaction';
    baseRevision: RevisionId;
    effect: 'create-current-preview';
  };
}
```

存在当前候选时同时提供两个选项：

```ts
editBaseOptions: {
  startFromCanonical: {
    tool: 'preview_transaction';
    baseRevision: RevisionId;
    replacesPreviewHandle: string;
    effect: 'discard-current-preview-and-replace';
  };
  reviseCurrentPreview: {
    tool: 'revise_preview';
    basePreviewHandle: string;
    baseTransactionDigest: string;
    effect: 'preserve-current-preview-and-apply-corrections';
  };
}
```

`currentPreviewReview` 继续绑定 `revision + previewHandle + transactionDigest`。因此模型能明确知道检查意见针对哪个候选，以及下一步可以基于哪个候选修订。

上下文不发送候选完整 Drawing Document 或不断增长的历史命令。模型只接收基线身份、当前 Preview/Diff 图、受影响节点摘要与 Review Evidence；完整候选状态由 Runtime 保存。

## 4. 写工具契约

### 4.1 `preview_transaction`

用于从正式版本新建或重做候选：

```ts
{
  baseRevision: RevisionId;
  replacesPreviewHandle?: string;
  summary: string;
  commands: DrawingCommand[];
  preconditions: DrawingAssertion[];
  postconditions: DrawingAssertion[];
  evidenceRefs: EvidenceId[];
}
```

- `baseRevision` 必须等于当前正式 revision。
- 当前不存在 Preview 时，不允许提供 `replacesPreviewHandle`。
- 当前存在 Preview 时，必须提供与当前句柄完全一致的 `replacesPreviewHandle`，明确表示模型主动放弃该候选。

### 4.2 `revise_preview`

用于在当前候选结果上继续修改：

```ts
{
  basePreviewHandle: string;
  baseTransactionDigest: string;
  summary: string;
  corrections: DrawingCommand[];
  postconditions?: DrawingAssertion[];
  evidenceRefs: EvidenceId[];
  confidence?: number;
}
```

- 句柄和 digest 必须匹配当前 revision 上的当前 Preview。
- `corrections` 的读取语义基于该 Preview 的 resulting document，而不是 canonical document。
- 模型只需表达需要纠正的部分，不需要重复上一轮已经正确的命令。
- 模型仍可以增删改四个 plane，也可以重绘或替换图元；该工具不限制对象类型和编辑方式。

## 5. 候选修订编译

Runtime/工具层执行以下确定性步骤：

1. 读取并校验父候选的 `revision + handle + digest + episode`。
2. 在父候选 resulting document 上预演 `corrections`，完成 Schema、引用、几何和最终文档校验。
3. 将父候选的完整命令与已验证纠正合成为一个仍以 canonical revision 为基线的完整事务。
4. 再从 canonical document 预演完整事务，并断言结果与步骤 2 的修订结果一致。
5. 创建新的 Preview handle、Counterfactual World 和画布增量。
6. 新候选记录 `parentPreviewHandle + parentTransactionDigest`；父候选保留在本次 Run 的审计内，但不再是当前可提交候选。

修订链只存在于候选与审计层，不建立第二套正式 Drawing 状态。Commit 始终提交一个以 canonical revision 为基线、可独立回放的完整 Drawing Transaction。

## 6. 生命周期与错误

- `PREVIEW_BASE_REVISION_MISMATCH`：模型声明的正式 revision 与当前 revision 不同。
- `PREVIEW_REPLACEMENT_MISMATCH`：模型声明舍弃的不是当前 Preview。
- `PREVIEW_BASE_NOT_CURRENT`：`revise_preview` 引用的不是当前 Preview。
- `PREVIEW_BASE_DIGEST_MISMATCH`：句柄存在但摘要不匹配。
- `PREVIEW_STALE`：正式 revision 已变化。
- `PREVIEW_COMPOSITION_MISMATCH`：候选内纠正结果与 canonical 完整事务回放结果不一致。

这些错误只纠正协议或要求重新规划，不替模型改变设计目标。

## 7. 审计与 UI

每个候选保存：

- `previewHandle`
- `baseRevision`
- `transactionDigest`
- `editBase.kind`
- `parentPreviewHandle/parentTransactionDigest`，或 `replacesPreviewHandle`
- `affectedNodeIds`

UI 只显示真实最新状态，例如“正在基于当前候选修订”或“正在从正式版本重新设计”。画布仍原子替换为最新 Preview，不叠加过期候选。

## 8. 非目标

- 不加入手臂、打招呼、方向或具体图形特例。
- 不让检查者决定使用哪个编辑基线。
- 不把 Review Evidence 变成 Commit 门禁。
- 不建立长期分支、通用版本 DAG 或第二份可写 Drawing Document。
- 不要求模型重复完整候选历史。

## 9. 验收标准

- 模型每轮都能看到准确的正式版本与当前候选两个可选基线。
- 模型显式选择从正式版本重做时，旧候选修改不会意外混入。
- 模型显式选择基于候选修订时，只提交局部纠正也能保留父候选全部正确修改。
- Review Evidence 与修订基线的 handle/digest 一致。
- 非当前、过期或 digest 不匹配的候选不能被修订或提交。
- 修订后的 Preview 可以脱离父候选、从 canonical revision 独立回放和 Commit。
- 候选父子关系进入审计，生产代码不含测试对象或动作特例。
