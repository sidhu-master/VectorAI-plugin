import { describe, expect, it } from 'vitest';
import {
  SpatialCapabilityRegistry,
  type SpatialCapability,
} from '../runtime/capabilities';
import {
  buildRuntimeContext,
  createRuntimeContextLedger,
  recordReceipt,
  recordStageSummary,
} from '../runtime/context';
import type { SpatialToolReceipt } from '../runtime/receipts';

const capabilities: SpatialCapability[] = [
  { name: 'inspect_model', title: '检查模型', available: true },
  { name: 'capture_canvas', title: '画布截图', available: false },
];

function receipt(index: number): SpatialToolReceipt {
  return {
    toolCallId: `call_${index}`,
    toolName: 'inspect_model',
    status: 'success',
    summary: `检查 ${index}`,
    durableFacts: { [`fact_${index}`]: index },
    transientSignals: { lastIndex: index },
    needReplan: false,
  };
}

describe('SpatialCapabilityRegistry', () => {
  it('only exposes currently available capabilities', () => {
    const registry = new SpatialCapabilityRegistry(capabilities);

    expect(registry.catalog()).toEqual([
      { name: 'inspect_model', title: '检查模型', available: true },
    ]);
    expect(registry.has('capture_canvas')).toBe(false);
  });
});

describe('RuntimeContextLedger', () => {
  it('keeps only the latest ten receipts while retaining durable facts', () => {
    let ledger = createRuntimeContextLedger('画两个孔', ['单位使用 mm']);
    for (let index = 0; index < 12; index += 1) ledger = recordReceipt(ledger, receipt(index));

    const built = buildRuntimeContext(ledger);

    expect(built.context.recentReceipts.map((item) => item.toolCallId)).toEqual(
      Array.from({ length: 10 }, (_, index) => `call_${index + 2}`),
    );
    expect(built.context.durableFacts).toMatchObject({ fact_0: 0, fact_11: 11 });
  });

  it('exposes transient signals once and clears them for the next turn', () => {
    const ledger = recordReceipt(
      createRuntimeContextLedger('检查模型', []),
      receipt(1),
    );

    const first = buildRuntimeContext(ledger);
    const second = buildRuntimeContext(first.nextLedger);

    expect(first.context.transientSignals).toEqual({ lastIndex: 1 });
    expect(second.context.transientSignals).toEqual({});
  });

  it('keeps only the latest five completed-stage summaries', () => {
    let ledger = createRuntimeContextLedger('重建工程图', []);
    for (let index = 0; index < 7; index += 1) {
      ledger = recordStageSummary(ledger, `阶段 ${index}`);
    }

    expect(buildRuntimeContext(ledger).context.completedStageSummaries).toEqual([
      '阶段 2', '阶段 3', '阶段 4', '阶段 5', '阶段 6',
    ]);
  });
});
