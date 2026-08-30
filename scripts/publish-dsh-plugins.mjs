// SPDX-License-Identifier: Apache-2.0

// Kept as a compatibility command. The guarded release orchestrator owns all
// runtime-first publication, npm scan polling, and clean-profile verification.
const { runRelease } = await import('./release-dsh-plugins.mjs');
await runRelease();
