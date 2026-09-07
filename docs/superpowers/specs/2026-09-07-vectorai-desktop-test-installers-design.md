# VectorAI 跨平台测试安装包设计规格

## 目标

为少量受邀测试者交付可直接安装和启动的 VectorAI 桌面应用。测试者不需要预装 DSH、Node.js、Python 或 pnpm，也不需要手工安装 VectorAI 插件或配置模型。首期支持 Windows x64、macOS Apple Silicon 和 macOS Intel。

产品安装包内置经过 VectorAI 兼容验证的精确 DSH 版本、两个有序 Bundle、当前平台图像矢量化运行时和一个临时火山方舟 API Key。该 Key 仅用于封闭测试，视为可以从安装包中提取；正式公开分发必须改为服务端额度或用户自带 Key。

本阶段只生成测试安装包，不发布新的 npm 包，不公开发布安装包，也不修改 DSH 源码。

## 当前状态与必须保留的行为

仓库当前提供原生 macOS `DSH.app` 启动器，但它是开发机启动器：构建时将完整 DSH 源码运行时安装到构建用户的 `~/Library/Application Support/VectorAI/dsh-runtime/<version>`，`.app` 本身只包含 Swift 启动程序。当前构建产物不能复制到一台全新电脑直接运行。Windows 尚无对应启动器。

桌面安装包改造必须保留以下行为：

- DSH 固定到 `release/dsh-plugins.json` 声明且已经完成 VectorAI 验证的精确版本；
- Space 与 Annotation 仍是两个独立 Bundle，并严格按 Space 在前、Annotation 在后的顺序组装；
- 平台矢量化运行时继续作为 Space 的内部可选依赖，用户不单独安装 Python 或运行时包；
- VectorAI 只使用 DSH 正式插件、服务和 profile 接口，不修改 DSH 源码或编译结果；
- 用户会话、图纸、模型设置和日志位于用户数据目录，应用升级不能覆盖这些数据；
- 关闭桌面窗口会终止由该窗口启动的 DSH 进程组，不遗留后台服务；
- 现有 macOS 开发启动器和 DSH 插件发布流程保持可用，新的桌面产品作为独立应用新增。

有意改变的行为是：测试者从“先准备 DSH，再执行两个插件安装命令”变为安装一个平台应用。构建流水线仍使用仓库规定的 Bundle 打包流程和安装顺序，只是把已经组装好的 profile 随桌面应用一起交付。

## 方案选择

采用 Electron 桌面外壳，而不为 macOS 和 Windows 分别维护 Swift 与 .NET 启动器。Electron 与 DSH 都基于 Node.js，适合统一实现子进程生命周期、启动日志、本地服务就绪检测和桌面窗口。其 Chromium 运行时会增加安装包体积，但测试阶段的实现一致性和排错能力优先于最小包体。

不采用以下方案：

- 安装后从 GitHub 或 npm 下载并构建 DSH：首次启动依赖开发工具和网络供应链，不是完整安装包；
- 内置本地大模型：包体、硬件要求和工程标注质量不满足当前测试目标；
- 在应用中加入一把正式长期 API Key：无法控制泄漏后的成本和影响范围。

## 交付物

原生 CI runner 分别生成：

- `VectorAI-<version>-win-x64-setup.exe`：Windows 10/11 x64 安装器；
- `VectorAI-<version>-mac-arm64.dmg`：macOS 13 或更高版本，Apple Silicon；
- `VectorAI-<version>-mac-x64.dmg`：macOS 13 或更高版本，Intel。

首期不制作同时包含两套原生运行时的 universal DMG，避免安装包无条件携带另一架构的 Node 和矢量化运行时。下载页根据系统提供对应文件。

测试包允许使用 ad-hoc 或未建立信誉的签名，因此 macOS Gatekeeper 和 Windows SmartScreen 可能显示警告。正式公开下载前，macOS 必须接入 Developer ID、Hardened Runtime、公证与 stapling；Windows 必须接入可信 Authenticode/Trusted Signing。

## 桌面应用结构

新增 `apps/vectorai-desktop`，其职责限于：

1. 定位随应用分发的 DSH、Node 和 VectorAI profile；
2. 创建或读取 VectorAI 专用用户数据目录；
3. 向 DSH 子进程提供测试模型凭据；
4. 选择可用本地端口，只绑定 `127.0.0.1`；
5. 启动 DSH web profile并从日志中取得带 token 的就绪 URL；
6. 在 Electron `BrowserWindow` 中加载该 URL；
7. 将外部链接交给系统浏览器，并保留本地文件选择能力；
8. 在窗口退出、启动失败或应用崩溃恢复时清理子进程；
9. 展示不含密钥和请求正文的启动错误与日志路径。

应用不承担工程图识别、标注和导出逻辑。这些能力继续由两个 VectorAI Bundle 和平台矢量化运行时拥有。

## 自包含运行时

每个平台应用包含以下固定版本内容：

- `release/dsh-plugins.json` 指定的 DSH 源码构建产物及生产依赖闭包；
- 满足 DSH `engines` 要求的精确 Node.js 运行时；
- Space Bundle 和 Annotation Bundle；
- 当前平台与架构对应的 VectorAI 矢量化运行时；
- DSH、Node、Electron 和第三方依赖许可证与 notices。

当前开发机 DSH 目录约 1.6 GB，其中大部分是完整 monorepo 开发依赖。正式安装包不得复制该目录；构建阶段只保留运行 web profile 所需的编译产物、生产依赖和许可证。最终体积以三平台真实构建产物为准，不在未完成依赖闭包审计前承诺具体大小。

DSH 与 VectorAI 的本机依赖必须在对应原生 runner 上生成。Windows 包不得使用 macOS 交叉编译产物，macOS Intel 与 Apple Silicon 也不得互相冒充。

## Bundle 组装与版本

桌面构建复用仓库的正式工作流：

1. 从同一干净提交读取一个精确 VectorAI 版本与 DSH 基线；
2. 使用 `runtime:pack` 生成当前平台矢量化运行时；
3. 使用 `build:dsh-space` 和 `build:dsh-annotation` 构建两个 Bundle；
4. 通过 `pack:dsh-plugins` 生成经过审计的 Bundle tarball；
5. 在隔离的暂存 DSH Home 中执行两次正式安装，先 Space、后带既定 `tesseract.js` 构建许可的 Annotation；
6. 校验 profile 顺序、精确依赖版本、平台运行时和基础识别能力；
7. 将暂存后的运行时和 profile 作为只读应用资源封装。

桌面打包不得调用 `npm publish`，也不得单独发布任何平台包。以后只有用户明确要求“发布新版”时，才能进入 `release:dsh-plugins` 的正式发布流程。

## 用户数据与首次启动

桌面应用使用独立的数据根目录：

- macOS：`~/Library/Application Support/VectorAI`；
- Windows：`%LOCALAPPDATA%\\VectorAI`。

目录中包含 DSH Home、会话、附件、设置、日志和可变运行状态。应用资源保持只读。首次启动将经过验证的初始 profile 与模型设置复制到新的 DSH Home；已存在的设置和会话不被覆盖。应用不得读取、迁移或修改用户已有的 `~/.dsh`。

应用每次启动都验证内置运行时清单与平台架构。缺文件、版本不匹配或 profile 顺序错误时，在启动模型请求前失败，并提供本地日志位置。

## 默认模型与临时凭据

测试安装包预置以下非敏感设置：

```yaml
llm-deepseek:
  apiKeyEnv: VECTORAI_TEST_API_KEY
  baseURL: https://ark.cn-beijing.volces.com/api/plan/v3
  models:
    - id: doubao-seed-2.0-lite
      name: 维构 AI

agent-default-model:
  provider: deepseek-official
  model: doubao-seed-2.0-lite
```

`deepseek-official` 是当前 DSH OpenAI 兼容请求适配器的内部路由名，不代表实际调用 DeepSeek 模型。请求实际发送到火山方舟，wire model ID 保持 `doubao-seed-2.0-lite`。主模型选择器向用户显示“维构 AI”；高级设置中仍可能出现 DSH 的内部 provider 路由名，本阶段不通过修改 DSH UI 隐藏它。

临时 Key 的处理规则：

- CI 或本地打包进程只从 `VECTORAI_TEST_API_KEY` 环境变量读取；
- Key 不得写入 Git、设计文档、普通配置模板、命令参数或构建日志；
- 构建器生成一个被安装包携带的测试凭据资源，启动器只把它传给自身创建的 DSH 子进程；
- 日志、错误信息、崩溃报告和诊断清单不得包含 Key；
- 安装包中的 Key 被明确视为可提取，不宣称加密或混淆可以保护它；
- Key 必须来自独立测试项目，并在火山方舟侧设置低预算、有效期和可撤销策略；
- Key 失效时显示可理解的鉴权错误，不回退到其他模型或其他凭据；
- 测试者仍可在 DSH 模型设置中替换为自己的配置，用户设置优先于首次启动模板。

## 更新策略

测试阶段不让桌面应用单独升级 DSH 或某一个 VectorAI Bundle。DSH、两个 Bundle 和平台运行时作为一个经过兼容验证的桌面版本整体更新，避免出现协议和依赖版本错配。

现有 macOS 开发启动器的 DSH 更新能力保持原样；它不参与测试安装包的运行时管理。桌面应用自动更新与差分下载不属于首个可用版本，测试者通过安装新的完整包升级，用户数据目录保持不变。

## 错误处理

- 平台或架构不受支持：安装或启动时明确报告受支持目标；
- 内置运行时损坏：拒绝启动并指出重新安装路径；
- 本地端口不可用：选择另一个可用端口，不终止不属于 VectorAI 的进程；
- DSH 未在超时内就绪：终止本次子进程，展示脱敏日志路径；
- 临时 Key 缺失：构建阶段直接失败，不生成看似可用的测试包；
- API 鉴权失败或额度耗尽：保留会话，显示模型配置错误，不自动切换模型；
- 应用异常退出：下次启动回收由自身记录且仍存活的旧 DSH 子进程；
- 插件或矢量化运行时加载失败：启动验收失败，不进入空白或残缺的工作区。

## 验证策略

普通提交使用不含真实 Key 的本地假模型服务验证配置、请求路由和错误处理。只有手动触发的封闭测试包 workflow 才读取仓库 secret 中的临时 Key，并执行一次最小真实模型调用。

每个平台至少完成：

1. 在没有 Node、Python、pnpm 和 DSH 的干净系统中安装；
2. 首次启动后主模型显示为“维构 AI”；
3. 无需用户设置即可创建会话并完成一轮真实模型调用；
4. 导入真实 DXF 与技术文档，完成识别、分区、标注和确认；
5. 导出 DXF，并用独立 CAD 查看器检查关键实体；
6. 退出应用后端口释放且没有残留 DSH/Node 进程；
7. 重启应用后会话、附件和用户设置仍存在；
8. 覆盖安装新版后用户数据仍存在，内置 DSH 与两个 Bundle 保持同一版本；
9. 扫描源码、Git 历史、普通构建日志和公开 artifact 元数据，确认没有临时 Key；
10. 安装包内许可证和第三方 notices 完整。

真实工程验收继续使用仓库中的 `external-golden-001` 初始图、技术文档和黄金目标图。通过条件是用户完整工作流可用，不以启动器成功打开空白 DSH 页面代替产品验收。

## 首期范围外

- 公开下载和公开发布；
- npm Bundle 新版本发布；
- 服务端模型代理、账号、计费和试用额度；
- 本地大模型；
- 自动更新和增量更新；
- macOS App Store 或 Microsoft Store 上架；
- 移动端和 Linux 桌面包；
- 隐藏或改名 DSH 高级设置中的内部 provider 标识；
- 保证测试 Key 无法从安装包中提取。
