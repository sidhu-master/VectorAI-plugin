# DSH 插件打包与发布手册

这是 VectorAI DSH 插件唯一有效的发布流程。不要直接运行 `npm publish`，也不要手工改某一个包的版本号。

## 发布结构

用户始终只安装两个 Bundle：

```bash
dsh plugin --profile web add @newwe/vectorai-plugin-dsh-space@alpha
dsh plugin --profile web add --allow-build=tesseract.js @newwe/vectorai-plugin-dsh-annotation@alpha
```

必须分成两条命令，以稳定保留第一层先安装、第二层再接管专业 UI 的顺序。第二条命令只允许 `tesseract.js` 的无功能性募捐提示脚本通过 DSH 的 pnpm 供应链门禁；不放宽其他依赖。第一层通过 npm `optionalDependencies` 自动选择当前系统的矢量化运行时；用户不需要安装 Python、pip、OpenCV 或虚拟环境。

内部发布物还包括五个平台包：macOS arm64/x64、Linux arm64/x64、Windows x64。它们不是 DSH Bundle，用户也不需要手工安装。

两个 Bundle 只使用 DSH 的正式插件和服务接口，不修改 DSH 源码，也不要求用户创建源码链接。Bundle 的 Host 构建产物实际导入的 DSH 包会作为精确版本的普通依赖随安装解析；`@deepseek-ai/cordis` 始终保留为必需 peer，确保宿主与插件共享同一个 Cordis 上下文。

## 本地打包

贡献者需要 Node.js 22、pnpm 11.7.0，以及 Python 3.13.2。Python 只用于构建发布物，不是最终用户依赖。

```bash
pnpm install
pnpm runtime:pack
pnpm build:dsh-space
pnpm build:dsh-annotation
```

`runtime:pack` 在系统临时目录创建隔离 venv，按带哈希的锁文件安装依赖，运行 Python 测试，生成 PyInstaller onedir 产物，然后在看不到 `python`/`python3` 的 PATH 下执行健康检查和真实图片矢量化。`pack:dsh-plugins` 是版本准备完成后的发布内部步骤，不应在未同步发布版本的源码工作区单独执行。产物位于：

- `dist/vectorizer-runtime/<platform>-<arch>/package/`
- `dist/vectorizer-runtime/<platform>-<arch>/tarballs/`
- `dist/npm/`（两个 DSH Bundle）

本地只验证当前平台。完整五平台产物必须由 `.github/workflows/vectorai-dsh-release.yml` 的原生 runner 矩阵生成，不能交叉编译后冒充目标平台。

## 版本与发布

- 所有平台运行时和两个 Bundle 使用同一个精确 semver。
- alpha 阶段使用 `0.1.0-alpha.N` 和 npm tag `alpha`。
- 发布前工作区必须干净。
- 只有明确收到“发布新版”的指令后才允许执行发布。

在 GitHub Actions 手动触发 `VectorAI DSH release`，填写 version/tag。先保持 `publish=false` 获取全平台审计结果；确认后再以同一提交、同一版本运行 `publish=true`。本地权威命令为：

```bash
pnpm release:dsh-plugins -- --version 0.1.0-alpha.N --tag alpha
```

该命令首先执行只读的 DSH registry 门禁：当前锁定版本的所有运行时依赖和构建 SDK 包必须已在 npm 可用，且 registry SDK 基线必须与目标 DSH 版本一致。任何包缺失都会在改版本、生成 receipt 或发布 VectorAI 包之前退出，并一次性列出缺失包；不允许用旧 API、DSH 源码链接或 Launcher 注入来绕过。当前上游尚未发布完整精确版本时，门禁失败是预期的安全结果。

门禁通过后，命令会一次性同步版本，拒绝 npm 上已存在的版本，并要求五个平台 tarball 全部到齐。发布顺序固定为：

1. 发布五个平台运行时，并逐个等待 npm `dist.integrity`；
2. 在全新 `DSH_HOME` 中，只用 Space、Annotation 两条命令安装尚未发布的本地 Bundle tarball，检查 DSH 精确版本、组合加载和当前平台矢量化运行时；
3. 本地验收成功后才发布 Space，再发布 Annotation，并分别等待 `dist.integrity`；
4. 再用两个公开包的精确版本，在另一个全新 `DSH_HOME` 中重复两条命令验收。

如果本地 Bundle 验收失败，两个 Bundle 都不会发布；已经发布且不可覆盖的平台运行时会留在 registry，并由 receipt 记录供同版本续跑。验收失败的临时 DSH profile 会保留并打印路径，便于定位依赖或组合加载问题。

npm 扫描可能持续数分钟，不要绕过等待或重复发布。发布记录位于 `dist/releases/<version>/release-receipt.json`，并作为 workflow artifact 保存；它用于审计本次发布的顺序、integrity 与安装验证结果。npm 版本不可覆盖，失败恢复前必须先核对 registry 与该 receipt，不能盲目重跑发布。

## npm 授权

优先在 npm 组织中为发布 workflow 配置 Trusted Publisher。每个新平台包首次建立后，都要核对它的 GitHub 仓库、workflow 文件名和环境限制。若首次发布暂时使用自动化 token，只能放在 GitHub Actions secret `NPM_TOKEN`，要求发布所需的最小权限和短有效期；禁止写入仓库、日志、脚本、`.npmrc` 或 receipt。迁移到 Trusted Publisher 后删除 token secret。

## 故障定位

- `Unsupported vectorizer runtime target`：当前 OS/CPU 不在五平台矩阵；不要回退系统 Python，应新增正式 runtime target。
- `Runtime protocol metadata mismatch`：Bundle、平台包或 Python worker 不是同一次发布，重新生成全部产物。
- `Missing runtime artifact`：CI 矩阵没有完整结束，禁止部分发布。
- `DSH_REGISTRY_PACKAGES_UNAVAILABLE`：目标 DSH 精确版本仍有 npm 包未发布；等待上游补齐，不要发布 VectorAI Bundle。
- `DSH_REGISTRY_SDK_BASELINE_STALE`：上游包已齐，但仓库开发 SDK 基线还未同步到目标 DSH 版本；先完成适配和全量回归。
- npm 已上传但 DSH 安装 404：通常仍在扫描，按原命令续跑，不要改版本或重复 publish。
- 新电脑导入图片时报运行时缺失：先核对 space Bundle 的五项 `optionalDependencies`、npm 平台匹配和安装日志；不允许指导用户安装 Python 作为生产修复。
