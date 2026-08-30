# Repository instructions

For every request containing “打包”, “发布”, “发布新版”, “release”, “publish”, or a DSH plugin version bump, read `docs/releasing-dsh-plugins.md` completely before changing files or running commands. Use only the repository's `runtime:pack`, `pack:dsh-plugins`, and `release:dsh-plugins` workflows; never publish an individual package manually.

Do not publish from a dirty worktree. Do not publish unless the user explicitly requests “发布新版” or an equally explicit publication action. Packaging alone never authorizes publication.

Production image vectorization must resolve the exact platform runtime npm package. Never add fallback execution through `python`, `python3`, a user virtual environment, Homebrew Python, or another system interpreter. `VECTORAI_VECTORIZER_RUNTIME` is a development-only explicit override.

End users install exactly two DSH Bundles in two ordered commands: space first, annotation second. Platform runtime packages are internal optional dependencies and must not be presented as additional user installation steps.
