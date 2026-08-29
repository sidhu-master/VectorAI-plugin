# DSH macOS Launcher

原生 AppKit/WKWebView 启动器，用于运行本地 DSH `0.1.2-alpha.1` 和 VectorAI 插件。它不显示终端窗口，只绑定 `127.0.0.1:3080`；启动前会终止实际监听 3080 的遗留进程，关闭主窗口会终止启动器创建的整个 DSH 进程组。

启动器使用非持久 WKWebView 数据仓库，避免本地服务重启后复用旧插件模块。构建脚本从 DeepSeek Harness 官方仓库安装并校验精确 tag `dsh-v0.1.2-alpha.1`（commit `cd5ef8148158c3a752a658978873241fdf8e2bbc`），运行时保存在 `~/Library/Application Support/VectorAI/dsh-runtime/0.1.2-alpha.1`。布局通过 alpha 正式 `shell.overlay` 扩展位接入，不再修改 DSH 编译产物。

```bash
pnpm --filter @vectorai/dsh-launcher-macos test
pnpm --filter @vectorai/dsh-launcher-macos build
```

构建产物位于 `Build/DSH.app`，使用本机 ad-hoc 签名。发布签名和公证不属于当前开发构建。
