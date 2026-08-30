// SPDX-License-Identifier: Apache-2.0

export async function runSharedAnnotationHistory(
  operation: () => Promise<void>,
  refreshPeers: ReadonlyArray<() => Promise<void>>,
): Promise<void> {
  await operation();
  await Promise.all(refreshPeers.map((refresh) => refresh()));
}
