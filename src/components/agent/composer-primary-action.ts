import type { AgentUiStatus } from '@/hooks/useStore';

export type ComposerPrimaryAction =
  | 'send'
  | 'pause'
  | 'resume'
  | 'retry'
  | 'waiting'
  | 'disabled';

export function composerPrimaryAction(input: {
  status: AgentUiStatus;
  hasRun: boolean;
  hasContent: boolean;
}): ComposerPrimaryAction {
  if (input.status === 'planning' && !input.hasRun) return 'waiting';
  if (input.status === 'pause_requested' || input.status === 'stopping') return 'waiting';
  if (input.status === 'running' || input.status === 'planning') {
    return input.hasContent ? 'send' : 'pause';
  }
  if (input.status === 'paused') return input.hasContent ? 'send' : 'resume';
  if (input.status === 'error') return input.hasContent ? 'send' : 'retry';
  return input.hasContent ? 'send' : 'disabled';
}
