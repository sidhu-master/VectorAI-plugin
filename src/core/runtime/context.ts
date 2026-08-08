import type { SpatialToolReceipt } from './receipts';

const RECENT_RECEIPT_LIMIT = 10;
const STAGE_SUMMARY_LIMIT = 5;

export interface RuntimeContextLedger {
  goal: string;
  stableRules: string[];
  recentReceipts: SpatialToolReceipt[];
  completedStageSummaries: string[];
  durableFacts: Record<string, unknown>;
  nextTransientSignals: Record<string, unknown>;
}

export interface RuntimeContextProjection {
  goal: string;
  stableRules: string[];
  recentReceipts: SpatialToolReceipt[];
  completedStageSummaries: string[];
  durableFacts: Record<string, unknown>;
  transientSignals: Record<string, unknown>;
}

export function createRuntimeContextLedger(
  goal: string,
  stableRules: string[],
): RuntimeContextLedger {
  return {
    goal,
    stableRules: [...stableRules],
    recentReceipts: [],
    completedStageSummaries: [],
    durableFacts: {},
    nextTransientSignals: {},
  };
}

export function recordReceipt(
  ledger: RuntimeContextLedger,
  receipt: SpatialToolReceipt,
): RuntimeContextLedger {
  return {
    ...ledger,
    recentReceipts: [...ledger.recentReceipts, receipt].slice(-RECENT_RECEIPT_LIMIT),
    durableFacts: { ...ledger.durableFacts, ...receipt.durableFacts },
    nextTransientSignals: { ...ledger.nextTransientSignals, ...receipt.transientSignals },
  };
}

export function recordStageSummary(
  ledger: RuntimeContextLedger,
  summary: string,
): RuntimeContextLedger {
  return {
    ...ledger,
    completedStageSummaries: [...ledger.completedStageSummaries, summary].slice(-STAGE_SUMMARY_LIMIT),
  };
}

export function buildRuntimeContext(ledger: RuntimeContextLedger): {
  context: RuntimeContextProjection;
  nextLedger: RuntimeContextLedger;
} {
  return {
    context: {
      goal: ledger.goal,
      stableRules: [...ledger.stableRules],
      recentReceipts: [...ledger.recentReceipts],
      completedStageSummaries: [...ledger.completedStageSummaries],
      durableFacts: { ...ledger.durableFacts },
      transientSignals: { ...ledger.nextTransientSignals },
    },
    nextLedger: { ...ledger, nextTransientSignals: {} },
  };
}
