import {
  executeAgentStep,
  planTask,
  type ExecuteStepParams,
  type PlanParams,
} from '../ai-gateway.js';
import type { SpatialIntent } from '../../../src/core/types.js';
import type { TaskPlan } from '../../../src/core/agent.js';
import type {
  AgentExecutorAdapter,
  AgentPlannerAdapter,
  ExecuteStageInput,
  PlanStageInput,
} from './types.js';

type PlanFunction = (input: PlanParams) => Promise<TaskPlan>;
type ExecuteFunction = (input: ExecuteStepParams) => Promise<SpatialIntent>;

export class GatewayPlannerAdapter implements AgentPlannerAdapter {
  constructor(private readonly planFunction: PlanFunction = planTask) {}

  plan(input: PlanStageInput): Promise<TaskPlan> {
    const prompt = input.instruction
      ? `${input.goal}\n用户追加指令：${input.instruction}`
      : input.goal;
    return this.planFunction({ prompt, signal: input.signal });
  }
}

export class GatewayExecutorAdapter implements AgentExecutorAdapter {
  constructor(private readonly executeFunction: ExecuteFunction = executeAgentStep) {}

  execute(input: ExecuteStageInput): Promise<SpatialIntent> {
    return this.executeFunction({
      step: input.step,
      model: input.model,
      plan: input.plan,
      correctionErrors: input.previousErrors,
      signal: input.signal,
    });
  }
}
