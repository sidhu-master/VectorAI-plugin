# 工程图图层管理设计

## 状态

2026-08-28 经会话确认。本规格定义第一层二维空间插件的通用图层能力，以及第二层工程标注插件接入右上角图层管理器的方式。

## 目标

- 把分区、开角、尺寸、公差等画布信息的显示控制统一放在画布右上角。
- 区分 DXF 原生 CAD 图层与 VectorAI 插件生成的工作图层，避免显示状态污染图纸语义。
- 让后续插件通过稳定接口注册图层，不在 `AnnotationWorkspace` 中继续堆叠专用开关。
- 保持图层数据、编辑状态与显示状态解耦；隐藏图层不得删除数据、取消流程或改变选择。
- 显示偏好按 DSH 会话隔离并持久化。

## 非目标

- 本轮不修改 `VectorAI-Drawing` 1.0 文档协议。
- 本轮不实现 CAD 图层改名、合并、锁定、打印或导出样式编辑。
- 本轮不把所有现有 Viewer 内部层立即迁入插件注册表。
- 本轮不自动生成新的工程标注。

## 两类图层

### 原始 CAD 图层

DXF 实体当前通过 `DrawingNodeSourceRef.layer` 保留来源图层名。该字段属于导入数据语义，应继续参与 DXF 往返和来源追踪。

第一版右上角管理器预留“原始 CAD 图层”分组，但不提供逐层编辑。后续可从当前 DrawingDocument 的节点派生只读图层目录；若需要锁定、打印和样式等可编辑元数据，再以向后兼容的可选字段扩展 DrawingDocument，而不是复用插件工作图层状态。

### VectorAI 工作图层

工作图层是运行时的可视化贡献，例如：

- 智能分区；
- 开角标注；
- 尺寸标注；
- 公差；
- AI 识别状态；
- 编辑辅助信息。

工作图层的可见性是会话级视图偏好，不写入 DrawingDocument，也不改变图元自身的 `visible` 字段。

## 第一层图层契约

`@vectorai/drawing-surface-api` 提供通用的图层描述、注册表与会话可见性状态：

```ts
type DrawingLayerCategory = 'engineering' | 'cad' | 'assistant' | 'interaction';

interface DrawingLayerDefinition {
  id: string;
  label: string;
  category: DrawingLayerCategory;
  icon?: DrawingLayerIcon;
  order: number;
  defaultVisible: boolean;
}

interface DrawingLayerVisibilityState {
  definitions: readonly DrawingLayerDefinition[];
  availableIds: readonly string[];
  isVisible(id: string): boolean;
  setVisible(id: string, visible: boolean): void;
}

interface DrawingLayerRegistry {
  registerLayer(definition: DrawingLayerDefinition): Disposable;
  getLayers(): readonly DrawingLayerDefinition[];
  subscribe(listener: () => void): () => void;
}

interface DrawingSurfaceRegistry extends DrawingLayerRegistry {
  // 现有工作区注册与选举接口保持不变。
}
```

第一层 `plugin-dsh-space-client` 创建并维护注册表，通过 Cordis 的现有 `drawingSurfaceRegistry` 能力面暴露注册方法，并把只读图层目录传给当前专业工作区。注册随插件生命周期自动释放，不增加进程级全局单例。图层 ID 必须命名空间化，例如 `vectorai.annotation.partition`，避免多插件冲突。

第二层插件在 `apply` 阶段注册“智能分区”，卸载时释放注册。未来开角、尺寸与公差能力按相同方式注册，不需要改动 `AnnotationWorkspace` 的菜单结构。

`DrawingCanvasLayerContribution` 仍负责渲染贡献；图层描述负责发现、排序和显示控制。两者通过同一个 namespaced `id` 关联，但数据契约不强迫渲染层必须来自注册表，便于现有代码渐进迁移。`DrawingWorkspaceContribution` 的组件参数新增可选的 `layerRegistry` 能力，保持 API v1 对已有外部贡献的兼容；第一层 Host 始终传入该能力。

## 右上角图层管理器

`@vectorai/drawing-viewer-react` 提供受控的 `DrawingLayerManager`：

- 固定覆盖在画布右上角，不参与布局，不挤压图纸。
- 折叠状态只显示图层图标。
- 展开后按类别列出当前可用图层，每项使用图标、名称与开关。
- 使用 `aria-expanded`、`aria-pressed` 和明确的中文标签支持键盘及自动化测试。
- 点击画布空白或按 Escape 关闭菜单，但不改变图层可见性。
- 无可用图层时不渲染入口。

第一版第二层工作区只注册“智能分区”。侧边分区面板删除显示开关，只保留查看、模式切换、改名与重新编辑功能。

## 会话状态

第二层插件使用现有会话 ID 保存工作图层偏好：

```text
vectorai:annotation:layer-visibility:<sessionId>
```

值为按图层 ID 索引的布尔映射。读取旧键 `vectorai:annotation:partition-overlay:<sessionId>` 时迁移到新结构，避免升级后用户偏好丢失。未记录的图层使用定义中的 `defaultVisible`，因此以后新增图层不会被旧偏好错误隐藏。

会话切换时重新加载对应状态；插件或会话释放时不删除持久偏好。

## 数据流

```text
第二层图层定义
      |
      v
会话可见性状态 ---> DrawingLayerManager（右上角）
      |
      +-----------> PartitionOverlay / 后续标注渲染层

DrawingDocument.sourceRef.layer ---> 原始 CAD 图层目录（后续）
```

隐藏“智能分区”只停止渲染 `PartitionOverlay`。分区 draft、confirmed revision、Undo/Redo、确认/取消工具栏和侧边检查器保持不变。

## 错误与兼容处理

- `sessionStorage` 不可用或读写异常时回退到默认可见，不阻断画布。
- 重复图层 ID 在开发态抛出明确错误；生产注册表保持首个贡献并记录诊断。
- 未识别的已保存图层 ID被忽略。
- 旧分区开关键只做一次兼容读取，不再继续写入。

## 测试与验收

- 右上角图层按钮可展开并显示“智能分区”。
- 切换后分区框、名称与手柄一起隐藏或恢复。
- 隐藏时分区侧栏、编辑工具栏、确认状态和图纸仍存在。
- 编辑态与确认态共享同一图层开关。
- 分区侧栏不再出现单独的眼睛按钮。
- 同一会话重挂载保持选择，不同会话相互隔离。
- 旧分区可见性偏好可迁移。
- 管理器覆盖在右上角，窗口缩放和侧栏开合不改变其锚点或画布尺寸。
- 全量测试、类型检查、lint、Web 构建与 DSH 标注插件构建通过，并在真实 DSH 窗口完成交互验证。
