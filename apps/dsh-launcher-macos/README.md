# DSH macOS Launcher

原生 AppKit/WKWebView 启动器，用于运行本地 DSH `0.1.0-rc.8` 和 VectorAI 第一层插件。它不显示终端窗口，只绑定 `127.0.0.1:3080`；启动前会终止实际监听 3080 的遗留进程，关闭主窗口会终止启动器创建的整个 DSH 进程组。

启动器使用非持久 WKWebView 数据仓库，避免本地服务重启后复用旧插件模块。在启动已缓存的 rc.8 前，它会运行 App bundle 中的 `dsh-inline-workspace-patch.mjs`；版本或代码锚点不匹配时显示错误并拒绝启动。

```bash
pnpm --filter @vectorai/dsh-launcher-macos test
pnpm --filter @vectorai/dsh-launcher-macos build
```

构建产物位于 `Build/DSH.app`，使用本机 ad-hoc 签名。发布签名和公证不属于当前开发构建。
