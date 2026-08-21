// SPDX-License-Identifier: Apache-2.0

import { defineTool, type JsonValue } from '@deepseek-ai/dsh-tools';
import { planEngineeringAnnotations } from '@vectorai/engineering-annotation';
import type { DrawingSpaceHostService } from '@vectorai/plugin-dsh-space-host';

type DrawingExtensionHost = Pick<DrawingSpaceHostService, 'getSnapshot' | 'runExtensionProgram'>;

export function createEngineeringAnnotationTool(host: DrawingExtensionHost) {
  return defineTool({
    name: 'drawing_auto_annotate',
    description: 'Plan deterministic engineering dimensions from confirmed local geometry and run the plan through the first-layer Preview, evaluation, auto-safe commit, and Undo-capable history.',
    parameters: {},
    output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(_args, exec) {
      const agent = exec.agent;
      if (!agent) throw new Error('DRAWING_SESSION_REQUIRED');
      const snapshot = host.getSnapshot(agent);
      if (!snapshot) throw new Error('DRAWING_REQUIRED');
      const plan = planEngineeringAnnotations({
        document: snapshot.document,
        ref: snapshot.ref,
        objective: '工程图纸自动标注',
      });
      if (!plan.program) return {
        status: 'no-effect',
        pending: plan.pending,
        suppressed: plan.suppressed,
      } as unknown as JsonValue;
      const workflow = await host.runExtensionProgram(agent, {
        targetNodeIds: plan.targetNodeIds,
        program: plan.program,
      }, exec.signal);
      return {
        status: workflow.result.status,
        annotations: plan.annotations.map(({ id }) => id),
        pending: plan.pending,
        suppressed: plan.suppressed,
        result: workflow.result,
      } as unknown as JsonValue;
    },
  });
}
