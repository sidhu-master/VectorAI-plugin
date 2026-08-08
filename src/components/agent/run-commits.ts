import type { DrawingCommit } from '@/drawing';

export function commitsForAgentRun(
  commits: readonly DrawingCommit[],
  runId: string | null,
): DrawingCommit[] {
  if (!runId) return [];
  return commits.filter((commit) => commit.actor.type === 'AI' && commit.actor.id === runId);
}
