# 独立第三方预览复核 Loop 设计

> 状态：用户已确认
>
> 日期：2026-08-14

## 1. 决策

语义修改使用一个主模型和一个独立检查模型：

- 主模型理解用户指令、读取二维世界、调用工具、生成 Drawing IR Preview，并最终决定修正、提交、请求用户决定或结束。
- 检查模型不规划、不选图元、不修改图纸，也不决定权限；它只复核当前 Preview 是否满足用户指令。
- Runtime 在后端把修改前和修改后的同视口截图横向拼成一张图，连同用户当前有效指令交给检查模型。
- 检查结果绑定当前 revision、Preview handle 和 transaction digest，作为 Evidence 进入主模型下一轮上下文，而不是提交授权。

## 2. 最小循环

```text
主模型产生 Preview
→ Hard Validator 检查协议、引用、revision 和授权
→ 后端生成同视口 before | after 对照图与确定性诊断
→ 独立检查模型只判断是否满足用户当前指令
→ Review Evidence 返回主模型
→ 主模型修正 / 提交 / 请求用户 / 结束
```

对于图片确定性矢量化批次和自动标注批次，继续使用现有快速路径，不增加检查模型调用。

## 3. Review Packet

检查模型只接收完成判断所需的最小数据：

```ts
interface PreviewReviewPacket {
  objective: string;
  appendedInstructions: string[];
  revision: RevisionId;
  previewHandle: string;
  transactionDigest: string;
  comparisonImage: {
    layout: 'before | after';
    imageDataUrl: string;
  };
  deterministicDiagnostics: DrawingDiagnostic[];
}
```

诊断是辅助事实。检查模型只能结合用户指令判断这些事实是否影响目标达成，不能把某个诊断代码升级为写权限。

## 4. Review Evidence

```ts
interface PreviewReviewEvidence {
  revision: RevisionId;
  previewHandle: string;
  transactionDigest: string;
  status: 'satisfied' | 'needs_revision' | 'unavailable';
  reason: string;
  defects: DrawingPreviewDefect[];
  reviewedAt: number;
}
```

- `satisfied`：检查模型认为当前 Preview 满足指令。
- `needs_revision`：检查模型发现可描述的目标偏差，主模型可修正，也可基于完整上下文决定接受候选。
- `unavailable`：检查模型调用或协议在一次有界纠错后仍不可用。这是模型/供应商能力事实，不清除 Preview，不伪造通过或失败。

## 5. 权限边界

只有以下问题硬阻止 Preview 或 Commit：

1. Drawing IR Schema、数值或引用非法。
2. base revision 或当前 Preview 已过期。
3. 当前修改缺少 Human Decision Grant。

Review Evidence、断点、连接变化、方向、尺度、样式和视觉差异都不能成为额外写授权。主模型可以根据 Review 修正，也可以以低置信度 candidate 提交并标红。

## 6. Preview 生命周期

- 检查结果为 `needs_revision` 时保留当前 Preview，画布继续显示该候选和缺陷 Overlay。
- 主模型产生新 Preview 时，新候选原子替换旧候选。模型可以显式选择从 canonical revision 重做，也可以通过 `revise_preview` 基于当前 handle/digest 只提交纠正。
- 候选修订由程序合成为可独立回放的完整 canonical 事务；它不会把父 Preview 变成第二份正式状态，也不要求模型重复父候选全部命令。
- Commit 只能引用当前 revision 上的当前 Preview handle，防止提交旧候选或旁路候选。
- Review 绑定 Preview digest 仅用于证明主模型看到的是哪次检查结果，不用于决定是否允许提交。

## 7. 删除的机制

迁移后删除：

- `requiresModelAcknowledgement`
- `diagnosticAcknowledgements`
- 诊断触发的 Preview 清除
- `PREVIEW_RECREATE_REQUIRED`
- `PREVIEW_DIAGNOSTIC_ACKNOWLEDGEMENT_REQUIRED`
- “检查模型必须判定通过才能提交”的正向凭证门禁
- 根据某类诊断阈值自动切换检查模型

确定性诊断及其无量纲事实可以保留，但只能作为 Evidence。

## 8. 模型可替换性与能力记录

主模型和检查模型分别配置，不绑定供应商。开发阶段可以使用更强模型或人工复核充当检查者；替换检查者不改变 Drawing IR、工具或事务协议。

审计按角色记录：

- `actor`：Grounding、规划、命令生成和修正能力。
- `reviewer`：目标达成判断和缺陷描述能力。
- `protocol`：结构化输出是否有效。

模型判断错误记录为回归数据，不向生产代码加入对象、动作、方向或样例规则。

## 9. 验收标准

- 每个语义 Preview 自动产生一条绑定准确候选的 Review Evidence。
- before 与 after 使用同一视口，并只作为一张横向拼接图发送。
- Review 无论通过、拒绝或不可用，下一轮主模型都能读取结果。
- `needs_revision` 不清除 Preview，主模型可以修正或提交当前候选。
- 新 Preview 会替换旧 Review；旧候选不能作为当前 Preview 提交。
- 图片确定性矢量化不增加检查模型调用。
- Runtime、Prompt 和生产代码不存在测试对象或动作特例。
