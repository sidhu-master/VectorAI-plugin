# Repository instructions

For every request containing “打包”, “发布”, “发布新版”, “release”, “publish”, or a DSH plugin version bump, read `docs/releasing-dsh-plugins.md` completely before changing files or running commands. Use only the repository's `runtime:pack`, `pack:dsh-plugins`, and `release:dsh-plugins` workflows; never publish an individual package manually.

Do not publish from a dirty worktree. Do not publish unless the user explicitly requests “发布新版” or an equally explicit publication action. Packaging alone never authorizes publication.

Production image vectorization must resolve the exact platform runtime npm package. Never add fallback execution through `python`, `python3`, a user virtual environment, Homebrew Python, or another system interpreter. `VECTORAI_VECTORIZER_RUNTIME` is a development-only explicit override.

End users install exactly two DSH Bundles in two ordered commands: space first, annotation second. Platform runtime packages are internal optional dependencies and must not be presented as additional user installation steps.

## New feature delivery discipline

For every new user-facing feature, optimize first for a complete, observable user workflow rather than for infrastructure breadth or theoretical completeness.

- Define the smallest real user journey before implementation: the real entry point, real input data, visible intermediate state where relevant, the user action, and the persisted or exported result. The first milestone is not complete until this journey works end to end in the actual plugin.
- Use representative production-shaped data in the first vertical slice. A provider interface, placeholder catalog, mock response, or partial reference dataset does not count as a completed feature when the user depends on the full data to use it.
- Build in vertical slices. Implement only the domain logic, Host contract, client UI, persistence, and export behavior required by the current slice; defer generalized infrastructure until a second concrete use case proves it necessary.
- Do not front-load secondary concerns while the primary journey is incomplete. Examples include alternate units, legacy migrations, elaborate recovery state machines, exhaustive DXF round trips, rare concurrency races, and broad compatibility matrices unless they block the agreed acceptance path.
- Match verification effort to product maturity. First prove the happy path with one real end-to-end acceptance scenario, then cover destructive or high-risk failures, and only then expand edge-case coverage. A large passing test suite is not evidence of completion if the user-visible workflow is still unavailable or unusable.
- Subagents and reviewers must work against explicit user-visible acceptance criteria. Review findings may fix correctness, data loss, or regressions inside the approved scope, but must not silently expand the feature into new scenarios or infrastructure.
- At every checkpoint, report what the user can now do in the running product, what remains unavailable, and which parts still use fixtures, partial data, or placeholders. Do not use commit count, line count, architecture depth, or test count as a substitute for product progress.
- Stop and rescope when engineering effort becomes disproportionate to visible progress. If more work is going into hardening or abstraction than into completing the primary journey, pause implementation, identify the minimum blocking work, and return to the vertical slice.
- Treat a feature as complete only after the agreed workflow is available in the built plugin and its result has been inspected against the acceptance example. Internal APIs, UI shells, and passing unit tests alone are intermediate deliverables.
