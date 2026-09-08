# VectorAI CAD Preview 设计规格

## 目标

交付一个可安装到 macOS `/Applications` 的独立轻量 DXF 预览应用。用户可以从 Finder 打开或拖入 DXF，使用与现有黄金样本 PNG 相同的 `ezdxf` 绘图链路查看图纸，并把当前完整视图导出为 PNG，用于导出验收和产品录屏。

首版只读。应用不得修改或另存 DXF，也不承担 CAD 编辑、自动标注或工程语义识别。

## 用户流程

1. 用户启动 **VectorAI CAD Preview**，看到空白画布和“打开 DXF”入口。
2. 用户通过文件选择器、拖放，或 Finder 的“打开方式”传入一个 `.dxf` 文件。
3. 应用读取模型空间，执行 DXF audit，并在深色画布上自动缩放到完整图纸。
4. 用户可以缩放、平移、恢复完整视图，并在图层面板中切换图层可见性。
5. 用户点击“导出 PNG”，应用按当前可见图层和完整图纸范围输出 PNG。
6. 当文件无法解析或没有可绘制内容时，应用显示具体错误，不覆盖当前已成功显示的图纸。

## 技术方案

应用使用 Python 3、PySide6、ezdxf 和 Matplotlib：

- PySide6 提供原生 macOS 窗口、菜单、文件选择、拖放和应用文件打开事件。
- ezdxf 负责读取 DXF、audit、图层状态和实体解释。
- `ezdxf.addons.drawing.Frontend`、`RenderContext` 与 `MatplotlibBackend` 负责绘制模型空间。
- Matplotlib 的 Qt 画布负责交互显示，导航工具提供缩放和平移。
- PyInstaller 以 `onedir` 应用包形式生成自包含 `.app`，不依赖用户的 Homebrew Python 或仓库虚拟环境。

渲染入口必须和 `.local/canvas-cad-review/render-real-session.py` 使用相同的 ezdxf Frontend/RenderContext/MatplotlibBackend 组合。应用层只负责选择文件、选择图层、控制视口和保存图片，不复制 DXF 实体绘制逻辑。

## 代码边界

新应用放在 `tools/cad-preview-app/`，与生产 DSH 插件隔离：

- `app.py`：PySide6 应用入口、macOS 文件打开事件和窗口生命周期。
- `window.py`：主窗口、菜单、拖放、图层面板和用户操作。
- `renderer.py`：读取、audit、绘制和 PNG 输出的唯一渲染服务。
- `model.py`：已加载图纸、图层与诊断信息的数据结构。
- `build_app.py`：创建专用构建环境并调用 PyInstaller 的可重复构建入口。
- `VectorAICADPreview.spec`：应用名、图标、Bundle ID、DXF 文档类型和依赖收集配置。
- `tests/`：渲染服务与窗口关键流程测试。
- `README.md`：开发运行、构建、安装和已知限制。

根 `package.json` 只增加一个便捷构建命令 `build:cad-preview-app`。该命令不接入 DSH Bundle 打包或发布流程。

## 界面

主窗口包含三部分：

- 顶部工具栏：打开 DXF、适应窗口、平移、缩放、导出 PNG。
- 中间画布：默认背景 `#10171d`，保持 DXF 解析后的实体颜色和线型。
- 右侧可折叠图层面板：显示图层名、颜色与可见性复选框。

标题栏显示当前文件名。状态栏只显示实体数量、图层数量和 audit 错误/修复数量，不增加与实际流程无关的状态提示。

首版不提供属性检查器、实体选择、测量、标注编辑、布局空间切换或 DWG 支持。

## 渲染规则

- 只渲染 modelspace。
- 首次打开和点击“适应窗口”时按全部可见实体范围缩放，并保留少量边距。
- 使用 ezdxf 的 MTEXT 解释结果，不能把 `\\f...;`、`\\W...;` 等控制串作为可见文字绘制。
- 使用 DXF 的 BYLAYER/BYBLOCK 颜色和线型解析结果；深色背景下不强制把所有实体改成同色。
- 图层切换通过 ezdxf 绘图配置或绘制过滤器实现，不修改源文档的持久状态。
- PNG 导出复用屏幕渲染服务，采用完整图纸范围和当前可见图层，不依赖用户当前缩放区域。
- 字体缺失时使用 Matplotlib/ezdxf 的确定性后备字体，并在状态栏诊断中列出替代情况。首版不宣称复现 CAXA 专有字体字形。

## macOS 集成与安装

- 应用名为 `VectorAI CAD Preview.app`。
- Bundle ID 为 `com.vectorai.cadpreview`。
- Info.plist 声明 `.dxf` 文档类型，使 Finder 的“打开方式”和拖到应用图标可用。
- 构建产物写入 `tools/cad-preview-app/dist/`，安装步骤复制到 `/Applications`。
- 应用包包含 Python 和全部运行依赖；运行时不得调用 Homebrew Python、系统 Python或仓库虚拟环境。
- 本地开发构建使用临时专用虚拟环境，不复用生产图像矢量化运行时。

本任务只构建和本地安装应用，不进行公证、签名证书配置或公开分发。开发机上使用 ad-hoc 签名，确保应用包内容完整且能由 Finder 启动。

## 错误处理

- 文件不存在、不是 DXF、结构损坏或解析失败：显示文件名与具体异常，保留当前画布。
- DXF audit 有修复或错误：允许预览可绘制内容，同时在状态栏和诊断对话框中展示计数与信息。
- 没有 modelspace 可绘制实体：提示“图纸没有可显示的模型空间内容”。
- PNG 写入失败：显示目标路径和系统错误，不改变当前图纸。
- 连续快速打开文件时，后一次成功结果替换前一次；失败结果不清空前一次成功结果。

## 验收标准

使用以下真实文件完成首个端到端验收：

- `/Users/sidhu/Downloads/样本图001.dxf`（黄金样本）；
- `.local/canvas-cad-review/real-session.dxf`（当前真实导出，存在时使用）；
- `/Users/sidhu/Downloads/初始图.dxf`（未标注输入）。

必须满足：

1. 应用能从 Finder 启动并打开三个文件中的现有文件。
2. 画布不显示原始 MTEXT 控制串，如 `\\f`、`\\W`。
3. 黄金样本的尺寸、基准、形位公差、粗糙度、剖面线和中心线均有可见图元。
4. 同一 DXF 由应用导出的 PNG 与原 Python 脚本在相同背景、画幅和 DPI 下生成的 PNG 使用同一渲染路径；关键颜色、实体包围盒和可见文字清单一致。
5. 缩放、平移、适应窗口和图层开关可操作，切换图层不会改写 DXF 文件。
6. 导出的 PNG 能正常打开，内容反映当前图层可见性并覆盖完整图纸范围。
7. `.app` 在未激活开发虚拟环境时能从 `/Applications` 启动。

## 测试策略

- 渲染服务测试：真实 DXF 读取、audit、图层过滤、可见实体统计、PNG 生成和错误输入。
- MTEXT 回归测试：输出文字集合不得包含未解释的格式控制串。
- 窗口测试：打开成功、打开失败保留旧图、拖放筛选和图层切换。
- 打包验收：检查 `.app` 的架构、Bundle ID、DXF 文档类型和自包含 Python 依赖。
- 手工视觉验收：对黄金样本和真实导出分别执行适应窗口，逐项确认尺寸、符号、颜色、剖面线、中心线和文字，而不是仅凭整体相似度通过。

## 已知限制

- 只支持 ezdxf 能读取的 ASCII/Binary DXF，不支持 DWG。
- 只显示模型空间，不显示 paper space 布局。
- CAXA 专有对象若没有标准 DXF 图元代理，只能显示文件中实际存在的标准/代理图元。
- 字体后备能保证文字可读，但无法保证与装有 CAXA 专有字体的目标 CAD 像素一致。
- 该应用用于稳定复现 VectorAI 的 Python 验收预览，不替代 CAXA、AutoCAD 等目标 CAD 的最终兼容性验收。
