import type {
  DrawingAssertion,
  DrawingCommand,
  DrawingId,
  DrawingSelector,
  PerceptionPreviewDelta,
  RevisionId,
} from '@/drawing';

export type { PerceptionPreviewDelta };

export type DrawingAgentProgressEventType =
  | 'accepted'
  | 'planning'
  | 'model_started'
  | 'model_finished'
  | 'tool_started'
  | 'tool_finished'
  | 'validation'
  | 'commit'
  | 'observing'
  | 'grounding'
  | 'region_overlay'
  | 'search_envelope_rejected'
  | 'topology_resolved'
  | 'split_materialized'
  | 'designing'
  | 'generating'
  | 'vectorizing'
  | 'previewing'
  | 'verifying'
  | 'revising'
  | 'committed'
  | 'perception_delta'
  | 'heartbeat'
  | 'paused'
  | 'resumed'
  | 'stopped'
  | 'completed'
  | 'failed';

export interface DrawingAgentProgressEvent {
  id: string;
  runId: string;
  type: DrawingAgentProgressEventType;
  title: string;
  detail?: string;
  perceptionDelta?: PerceptionPreviewDelta;
  overlay?: DrawingAgentCanvasOverlay;
  candidateAttempt?: number;
  maxCandidateAttempts?: number;
  timestamp: number;
  elapsedMs: number;
}

/** Ephemeral evidence the model is currently inspecting; never an edit authorization. */
export type DrawingAgentCanvasOverlay =
  | { kind: 'nodes'; nodeIds: string[]; role: 'observed' | 'considered' | 'changed' }
  | { kind: 'paths'; paths: Array<{ id: string; nodeIds: string[]; points?: readonly [number, number][] }>; role: 'candidate' | 'inspected' }
  | { kind: 'points'; points: Array<{ id: string; point: readonly [number, number]; role?: string }> }
  | { kind: 'preview'; previewHandle: string; affectedNodeIds: string[] }
  | { kind: 'diagnostics'; nodeIds: string[]; codes: string[] }
  | { kind: 'clear' };

export type DrawingAgentRunStatus =
  | 'planning'
  | 'running'
  | 'waiting_for_user'
  | 'pause_requested'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'completed'
  | 'failed';

export interface GoalSpec {
  id: string;
  objective: string;
  scope: DrawingSelector;
  acceptanceCriteria: DrawingAssertion[];
  riskPolicy: { candidateAllowed: boolean; maxCommits: number };
}

export type WorkflowNodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked';

export type DrawingWorkflowCapability =
  | 'query_entities'
  | 'inspect_entity'
  | 'edit_entities'
  | 'verify_goal';

export interface WorkflowNode {
  id: string;
  capability: DrawingWorkflowCapability;
  dependsOn: string[];
  completionCriteria: DrawingAssertion[];
  status: WorkflowNodeStatus;
}

export interface DrawingAgentPlan {
  goal: GoalSpec;
  workflow: WorkflowNode[];
  summary: string;
}

export type AgentDecision =
  | { type: 'query'; toolCallId: string; selector: DrawingSelector }
  | { type: 'inspect'; toolCallId: string; nodeId: string }
  | {
      type: 'transact';
      toolCallId: string;
      commands: DrawingCommand[];
      confidence?: number;
    }
  | { type: 'finish'; summary: string };

export const DRAWING_MODEL_TOOL_NAMES = [
  'render_drawing',
  'query_nodes',
  'inspect_nodes',
  'measure_geometry',
  'compare_views',
  'build_topology',
  'trace_paths',
  'find_interfaces',
  'inspect_fragment',
  'materialize_split',
  'preview_transaction',
  'redraw_region',
  'vectorize_image',
  'fit_geometry',
  'recompute_annotations',
  'evaluate_preview',
  'commit_preview',
] as const;

export type DrawingModelToolName = typeof DRAWING_MODEL_TOOL_NAMES[number];

export interface HumanDecisionDraft {
  kind: HumanDecisionKind;
  question: string;
  reason: string;
  options: HumanDecisionOption[];
  recommendedOptionId?: string;
  affectedResources: HumanDecisionAffectedResource[];
  previewHandle?: string;
}

export type DrawingAgentAction =
  | { type: 'tool'; toolCallId: string; tool: DrawingModelToolName; input: unknown }
  | { type: 'request-human-decision'; request: HumanDecisionDraft }
  | { type: 'commit'; previewHandle: string; summary: string; confidence?: number }
  | { type: 'finish'; summary: string };

export type HumanDecisionKind =
  | 'grant-permission'
  | 'choose-option'
  | 'confirm-intent'
  | 'provide-context'
  | 'accept-risk';

export type DecisionEffect =
  | {
      type: 'permission';
      decision: 'allow' | 'deny';
      actions: string[];
      resourceIds: string[];
    }
  | { type: 'option'; value: string }
  | { type: 'intent'; decision: 'confirm' | 'reject' }
  | { type: 'context'; key: string; value?: unknown }
  | { type: 'risk'; decision: 'accept' | 'reject'; riskIds: string[] };

export interface HumanDecisionOption {
  id: string;
  label: string;
  description?: string;
  effect?: DecisionEffect;
}

export interface HumanDecisionAffectedResource {
  plane?: 'geometry' | 'annotation' | 'relation' | 'feature' | 'external';
  ids?: string[];
  action?: string;
}

export interface HumanDecisionRequest {
  id: string;
  episodeId: string;
  revision: RevisionId;
  candidateId?: string;
  transactionDigest?: string;
  kind: HumanDecisionKind;
  question: string;
  reason: string;
  options: HumanDecisionOption[];
  recommendedOptionId?: string;
  affectedResources: HumanDecisionAffectedResource[];
  previewHandle?: string;
  expiresWhenRevisionChanges: true;
}

export interface HumanDecisionResponse {
  requestId: string;
  selectedOptionId: string;
  additionalInstruction?: string;
  decidedAt: number;
}

export interface PermissionGrant {
  id: string;
  requestId: string;
  episodeId: string;
  revision: RevisionId;
  transactionDigest: string;
  actions: string[];
  resourceIds: string[];
  effect: 'allow' | 'deny';
  scope: 'candidate';
}

/** Public run projection. It intentionally carries no document or drawing history. */
export interface DrawingAgentRunView {
  runId: string;
  drawingId: DrawingId;
  revision: RevisionId;
  status: DrawingAgentRunStatus;
  goal: GoalSpec | null;
  workflow: WorkflowNode[];
  currentWorkflowNodeId: string | null;
  commitCount: number;
  analysisSummary: string | null;
  pendingInstructions: string[];
  pendingDecision: HumanDecisionRequest | null;
  /** Current revision-bound candidate. It is a handle, never a second drawing document. */
  currentPreviewHandle?: string | null;
  /** Latest real action shown beside the composer; never contains hidden reasoning. */
  latestActivity?: {
    title: string;
    detail?: string;
    actionKind: 'model' | 'tool' | 'preview' | 'decision' | 'commit';
  } | null;
  error: string | null;
}

export class DrawingAgentProtocolError extends Error {
  constructor(readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'DrawingAgentProtocolError';
  }
}

const WORKFLOW_STATUSES = ['pending', 'running', 'completed', 'failed', 'blocked'] as const;
const WORKFLOW_CAPABILITIES = [
  'query_entities', 'inspect_entity', 'edit_entities', 'verify_goal',
] as const;
const PLANES = ['geometry', 'annotation', 'relation', 'feature'] as const;
const HUMAN_DECISION_KINDS = [
  'grant-permission', 'choose-option', 'confirm-intent', 'provide-context', 'accept-risk',
] as const;
const DECISION_RESOURCE_PLANES = [...PLANES, 'external'] as const;

export function parseHumanDecisionRequest(value: unknown): HumanDecisionRequest {
  const path = 'humanDecisionRequest';
  const request = object(value, path);
  exact(request, [
    'id', 'episodeId', 'revision', 'candidateId', 'transactionDigest', 'kind',
    'question', 'reason', 'options', 'recommendedOptionId', 'affectedResources',
    'previewHandle', 'expiresWhenRevisionChanges',
  ], path);
  const options = array(request.options, `${path}.options`).map((option, index) => (
    parseHumanDecisionOption(option, `${path}.options[${index}]`)
  ));
  if (options.length === 0) fail(`${path}.options`, '至少需要一个选项');
  const optionIds = new Set<string>();
  options.forEach((option, index) => {
    if (optionIds.has(option.id)) fail(`${path}.options[${index}].id`, '选项 ID 重复');
    optionIds.add(option.id);
  });
  const recommendedOptionId = optionalNonEmptyString(
    request.recommendedOptionId,
    `${path}.recommendedOptionId`,
  );
  if (recommendedOptionId !== undefined && !optionIds.has(recommendedOptionId)) {
    fail(`${path}.recommendedOptionId`, '推荐选项不存在');
  }
  const kind = enumValue(request.kind, HUMAN_DECISION_KINDS, `${path}.kind`);
  const expectedEffectType: Record<HumanDecisionKind, DecisionEffect['type']> = {
    'grant-permission': 'permission',
    'choose-option': 'option',
    'confirm-intent': 'intent',
    'provide-context': 'context',
    'accept-risk': 'risk',
  };
  options.forEach((option, index) => {
    if (option.effect && option.effect.type !== expectedEffectType[kind]) {
      fail(`${path}.options[${index}].effect.type`, '效果类型与请求类型不匹配');
    }
  });
  if (request.expiresWhenRevisionChanges !== true) {
    fail(`${path}.expiresWhenRevisionChanges`, '候选请求必须随版本变化失效');
  }
  return {
    id: nonEmptyString(request.id, `${path}.id`),
    episodeId: nonEmptyString(request.episodeId, `${path}.episodeId`),
    revision: nonEmptyString(request.revision, `${path}.revision`) as RevisionId,
    ...(request.candidateId === undefined
      ? {}
      : { candidateId: nonEmptyString(request.candidateId, `${path}.candidateId`) }),
    ...(request.transactionDigest === undefined
      ? {}
      : { transactionDigest: digest(request.transactionDigest, `${path}.transactionDigest`) }),
    kind,
    question: nonEmptyString(request.question, `${path}.question`),
    reason: nonEmptyString(request.reason, `${path}.reason`),
    options,
    ...(recommendedOptionId === undefined ? {} : { recommendedOptionId }),
    affectedResources: array(request.affectedResources, `${path}.affectedResources`)
      .map((resource, index) => parseAffectedResource(
        resource,
        `${path}.affectedResources[${index}]`,
      )),
    ...(request.previewHandle === undefined
      ? {}
      : { previewHandle: nonEmptyString(request.previewHandle, `${path}.previewHandle`) }),
    expiresWhenRevisionChanges: true,
  };
}

export function parseHumanDecisionResponse(value: unknown): HumanDecisionResponse {
  const path = 'humanDecisionResponse';
  const response = object(value, path);
  exact(response, [
    'requestId', 'selectedOptionId', 'additionalInstruction', 'decidedAt',
  ], path);
  const decidedAt = finite(response.decidedAt, `${path}.decidedAt`);
  if (decidedAt < 0) fail(`${path}.decidedAt`, '时间不能小于零');
  return {
    requestId: nonEmptyString(response.requestId, `${path}.requestId`),
    selectedOptionId: nonEmptyString(response.selectedOptionId, `${path}.selectedOptionId`),
    ...(response.additionalInstruction === undefined
      ? {}
      : {
          additionalInstruction: nonEmptyString(
            response.additionalInstruction,
            `${path}.additionalInstruction`,
          ),
        }),
    decidedAt,
  };
}

export function parsePermissionGrant(value: unknown): PermissionGrant {
  const path = 'permissionGrant';
  const grant = object(value, path);
  exact(grant, [
    'id', 'requestId', 'episodeId', 'revision', 'transactionDigest',
    'actions', 'resourceIds', 'effect', 'scope',
  ], path);
  const actions = nonEmptyStringArray(grant.actions, `${path}.actions`);
  const resourceIds = nonEmptyStringArray(grant.resourceIds, `${path}.resourceIds`);
  return {
    id: nonEmptyString(grant.id, `${path}.id`),
    requestId: nonEmptyString(grant.requestId, `${path}.requestId`),
    episodeId: nonEmptyString(grant.episodeId, `${path}.episodeId`),
    revision: nonEmptyString(grant.revision, `${path}.revision`) as RevisionId,
    transactionDigest: digest(grant.transactionDigest, `${path}.transactionDigest`),
    actions,
    resourceIds,
    effect: enumValue(grant.effect, ['allow', 'deny'] as const, `${path}.effect`),
    scope: enumValue(grant.scope, ['candidate'] as const, `${path}.scope`),
  };
}

export function parseDrawingAgentAction(value: unknown): DrawingAgentAction {
  const action = object(value, 'action');
  const type = nonEmptyString(action.type, 'action.type');
  switch (type) {
    case 'tool':
      exact(action, ['type', 'toolCallId', 'tool', 'input'], 'action');
      return {
        type,
        toolCallId: nonEmptyString(action.toolCallId, 'action.toolCallId'),
        tool: enumValue(action.tool, DRAWING_MODEL_TOOL_NAMES, 'action.tool'),
        input: jsonValue(action.input, 'action.input'),
      };
    case 'request-human-decision':
      exact(action, ['type', 'request'], 'action');
      return { type, request: parseHumanDecisionDraft(action.request) };
    case 'commit': {
      exact(action, ['type', 'previewHandle', 'summary', 'confidence'], 'action');
      const actionConfidence = optionalFinite(action.confidence, 'action.confidence');
      if (actionConfidence !== undefined && (actionConfidence < 0 || actionConfidence > 1)) {
        fail('action.confidence', '置信度必须在 0 到 1 之间');
      }
      return {
        type,
        previewHandle: nonEmptyString(action.previewHandle, 'action.previewHandle'),
        summary: nonEmptyString(action.summary, 'action.summary'),
        ...(actionConfidence === undefined ? {} : { confidence: actionConfidence }),
      };
    }
    case 'finish':
      exact(action, ['type', 'summary'], 'action');
      return { type, summary: nonEmptyString(action.summary, 'action.summary') };
    default:
      fail('action.type', `不支持的动作类型 ${type}`);
  }
}

function parseHumanDecisionDraft(value: unknown): HumanDecisionDraft {
  const path = 'action.request';
  const request = object(value, path);
  exact(request, [
    'kind', 'question', 'reason', 'options', 'recommendedOptionId',
    'affectedResources', 'previewHandle',
  ], path);
  const kind = enumValue(request.kind, HUMAN_DECISION_KINDS, `${path}.kind`);
  const options = array(request.options, `${path}.options`).map((option, index) => (
    parseHumanDecisionOption(option, `${path}.options[${index}]`)
  ));
  if (options.length === 0) fail(`${path}.options`, '至少需要一个选项');
  const optionIds = new Set<string>();
  options.forEach((option, index) => {
    if (optionIds.has(option.id)) fail(`${path}.options[${index}].id`, '选项 ID 重复');
    optionIds.add(option.id);
  });
  const expectedEffectType: Record<HumanDecisionKind, DecisionEffect['type']> = {
    'grant-permission': 'permission',
    'choose-option': 'option',
    'confirm-intent': 'intent',
    'provide-context': 'context',
    'accept-risk': 'risk',
  };
  options.forEach((option, index) => {
    if (option.effect && option.effect.type !== expectedEffectType[kind]) {
      fail(`${path}.options[${index}].effect.type`, '效果类型与请求类型不匹配');
    }
  });
  const recommendedOptionId = optionalNonEmptyString(
    request.recommendedOptionId,
    `${path}.recommendedOptionId`,
  );
  if (recommendedOptionId !== undefined && !optionIds.has(recommendedOptionId)) {
    fail(`${path}.recommendedOptionId`, '推荐选项不存在');
  }
  return {
    kind,
    question: nonEmptyString(request.question, `${path}.question`),
    reason: nonEmptyString(request.reason, `${path}.reason`),
    options,
    ...(recommendedOptionId === undefined ? {} : { recommendedOptionId }),
    affectedResources: array(request.affectedResources, `${path}.affectedResources`)
      .map((resource, index) => parseAffectedResource(
        resource,
        `${path}.affectedResources[${index}]`,
      )),
    ...(request.previewHandle === undefined
      ? {}
      : { previewHandle: nonEmptyString(request.previewHandle, `${path}.previewHandle`) }),
  };
}

export function parseAgentPlan(value: unknown): DrawingAgentPlan {
  const plan = object(value, 'plan');
  exact(plan, ['goal', 'workflow', 'summary'], 'plan');
  const goal = parseGoal(plan.goal, 'plan.goal');
  const workflowValues = array(plan.workflow, 'plan.workflow');
  if (workflowValues.length === 0) fail('plan.workflow', '工作流不能为空');
  const workflow = workflowValues.map((node, index) => (
    parseWorkflowNode(node, `plan.workflow[${index}]`)
  ));
  const ids = new Set<string>();
  workflow.forEach((node, index) => {
    if (ids.has(node.id)) fail(`plan.workflow[${index}].id`, '工作流节点 ID 重复');
    ids.add(node.id);
  });
  workflow.forEach((node, index) => node.dependsOn.forEach((dependency, dependencyIndex) => {
    if (!ids.has(dependency) || dependency === node.id) {
      fail(`plan.workflow[${index}].dependsOn[${dependencyIndex}]`, '依赖节点不存在或引用自身');
    }
  }));
  assertAcyclic(workflow);
  return { goal, workflow, summary: nonEmptyString(plan.summary, 'plan.summary') };
}

export function parseAgentDecision(value: unknown): AgentDecision {
  const decision = object(value, 'decision');
  const type = nonEmptyString(decision.type, 'decision.type');
  switch (type) {
    case 'query':
      exact(decision, ['type', 'toolCallId', 'selector'], 'decision');
      return {
        type,
        toolCallId: nonEmptyString(decision.toolCallId, 'decision.toolCallId'),
        selector: parseSelector(decision.selector, 'decision.selector'),
      };
    case 'inspect':
      exact(decision, ['type', 'toolCallId', 'nodeId'], 'decision');
      return {
        type,
        toolCallId: nonEmptyString(decision.toolCallId, 'decision.toolCallId'),
        nodeId: nonEmptyString(decision.nodeId, 'decision.nodeId'),
      };
    case 'transact': {
      exact(decision, ['type', 'toolCallId', 'commands', 'confidence'], 'decision');
      const values = array(decision.commands, 'decision.commands');
      if (values.length === 0) fail('decision.commands', '事务命令不能为空');
      const confidence = optionalFinite(decision.confidence, 'decision.confidence');
      if (confidence !== undefined && (confidence < 0 || confidence > 1)) {
        fail('decision.confidence', '置信度必须在 0 到 1 之间');
      }
      return {
        type,
        toolCallId: nonEmptyString(decision.toolCallId, 'decision.toolCallId'),
        commands: values.map((command, index) => (
          parseCommand(command, `decision.commands[${index}]`)
        )),
        ...(confidence === undefined ? {} : { confidence }),
      };
    }
    case 'finish':
      exact(decision, ['type', 'summary'], 'decision');
      return { type, summary: nonEmptyString(decision.summary, 'decision.summary') };
    default:
      fail('decision.type', `不支持的决策类型 ${type}`);
  }
}

export function parseDrawingToolSelector(
  value: unknown,
  path = 'selector',
): DrawingSelector {
  return parseSelector(value, path);
}

export function parseDrawingToolCommands(
  value: unknown,
  path = 'commands',
): DrawingCommand[] {
  const values = array(value, path);
  if (values.length === 0) fail(path, '事务命令不能为空');
  return values.map((command, index) => parseCommand(command, `${path}[${index}]`));
}

export function parseDrawingToolAssertions(
  value: unknown,
  path = 'assertions',
): DrawingAssertion[] {
  return parseAssertions(value, path);
}

function parseHumanDecisionOption(value: unknown, path: string): HumanDecisionOption {
  const option = object(value, path);
  exact(option, ['id', 'label', 'description', 'effect'], path);
  return {
    id: nonEmptyString(option.id, `${path}.id`),
    label: nonEmptyString(option.label, `${path}.label`),
    ...(option.description === undefined
      ? {}
      : { description: nonEmptyString(option.description, `${path}.description`) }),
    ...(option.effect === undefined ? {} : { effect: parseDecisionEffect(option.effect, `${path}.effect`) }),
  };
}

function parseDecisionEffect(value: unknown, path: string): DecisionEffect {
  const effect = object(value, path);
  const type = nonEmptyString(effect.type, `${path}.type`);
  switch (type) {
    case 'permission':
      exact(effect, ['type', 'decision', 'actions', 'resourceIds'], path);
      return {
        type,
        decision: enumValue(effect.decision, ['allow', 'deny'] as const, `${path}.decision`),
        actions: nonEmptyStringArray(effect.actions, `${path}.actions`),
        resourceIds: nonEmptyStringArray(effect.resourceIds, `${path}.resourceIds`),
      };
    case 'option':
      exact(effect, ['type', 'value'], path);
      return { type, value: nonEmptyString(effect.value, `${path}.value`) };
    case 'intent':
      exact(effect, ['type', 'decision'], path);
      return {
        type,
        decision: enumValue(effect.decision, ['confirm', 'reject'] as const, `${path}.decision`),
      };
    case 'context':
      exact(effect, ['type', 'key', 'value'], path);
      return {
        type,
        key: nonEmptyString(effect.key, `${path}.key`),
        ...(effect.value === undefined ? {} : { value: jsonValue(effect.value, `${path}.value`) }),
      };
    case 'risk':
      exact(effect, ['type', 'decision', 'riskIds'], path);
      return {
        type,
        decision: enumValue(effect.decision, ['accept', 'reject'] as const, `${path}.decision`),
        riskIds: nonEmptyStringArray(effect.riskIds, `${path}.riskIds`),
      };
    default:
      fail(`${path}.type`, `不支持的决定效果 ${type}`);
  }
}

function parseAffectedResource(
  value: unknown,
  path: string,
): HumanDecisionAffectedResource {
  const resource = object(value, path);
  exact(resource, ['plane', 'ids', 'action'], path);
  if (resource.plane === undefined && resource.ids === undefined && resource.action === undefined) {
    fail(path, '影响资源不能为空');
  }
  return {
    ...(resource.plane === undefined
      ? {}
      : { plane: enumValue(resource.plane, DECISION_RESOURCE_PLANES, `${path}.plane`) }),
    ...(resource.ids === undefined ? {} : { ids: nonEmptyStringArray(resource.ids, `${path}.ids`) }),
    ...(resource.action === undefined
      ? {}
      : { action: nonEmptyString(resource.action, `${path}.action`) }),
  };
}

function parseGoal(value: unknown, path: string): GoalSpec {
  const goal = object(value, path);
  exact(goal, ['id', 'objective', 'scope', 'acceptanceCriteria', 'riskPolicy'], path);
  const risk = object(goal.riskPolicy, `${path}.riskPolicy`);
  exact(risk, ['candidateAllowed', 'maxCommits'], `${path}.riskPolicy`);
  const maxCommits = positiveInteger(risk.maxCommits, `${path}.riskPolicy.maxCommits`);
  const acceptanceCriteria = parseAssertions(
    goal.acceptanceCriteria,
    `${path}.acceptanceCriteria`,
  );
  if (acceptanceCriteria.length === 0) {
    fail(`${path}.acceptanceCriteria`, '目标必须包含至少一个验收条件');
  }
  return {
    id: nonEmptyString(goal.id, `${path}.id`),
    objective: nonEmptyString(goal.objective, `${path}.objective`),
    scope: parseSelector(goal.scope, `${path}.scope`),
    acceptanceCriteria,
    riskPolicy: {
      candidateAllowed: boolean(risk.candidateAllowed, `${path}.riskPolicy.candidateAllowed`),
      maxCommits,
    },
  };
}

function assertAcyclic(workflow: WorkflowNode[]): void {
  const nodes = new Map(workflow.map((node) => [node.id, node]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) fail('plan.workflow', '工作流依赖不能形成环');
    if (visited.has(id)) return;
    visiting.add(id);
    nodes.get(id)!.dependsOn.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  };
  workflow.forEach((node) => visit(node.id));
}

function parseWorkflowNode(value: unknown, path: string): WorkflowNode {
  const node = object(value, path);
  exact(node, ['id', 'capability', 'dependsOn', 'completionCriteria', 'status'], path);
  return {
    id: nonEmptyString(node.id, `${path}.id`),
    capability: enumValue(node.capability, WORKFLOW_CAPABILITIES, `${path}.capability`),
    dependsOn: stringArray(node.dependsOn, `${path}.dependsOn`),
    completionCriteria: parseAssertions(node.completionCriteria, `${path}.completionCriteria`),
    status: enumValue(node.status, WORKFLOW_STATUSES, `${path}.status`),
  };
}

function parseSelector(value: unknown, path: string): DrawingSelector {
  const selector = object(value, path);
  exact(selector, [
    'plane', 'ids', 'types', 'qualityStatus', 'bounds', 'relationKind', 'limit',
  ], path);
  const result: DrawingSelector = {};
  if (selector.plane !== undefined) result.plane = enumValue(selector.plane, PLANES, `${path}.plane`);
  if (selector.ids !== undefined) result.ids = stringArray(selector.ids, `${path}.ids`);
  if (selector.types !== undefined) result.types = stringArray(selector.types, `${path}.types`);
  if (selector.qualityStatus !== undefined) {
    result.qualityStatus = enumValue(
      selector.qualityStatus, ['confirmed', 'candidate'] as const, `${path}.qualityStatus`,
    );
  }
  if (selector.relationKind !== undefined) {
    result.relationKind = nonEmptyString(selector.relationKind, `${path}.relationKind`);
  }
  if (selector.limit !== undefined) result.limit = positiveInteger(selector.limit, `${path}.limit`);
  if (selector.bounds !== undefined) {
    const bounds = object(selector.bounds, `${path}.bounds`);
    exact(bounds, ['minX', 'minY', 'maxX', 'maxY'], `${path}.bounds`);
    const parsed = {
      minX: finite(bounds.minX, `${path}.bounds.minX`),
      minY: finite(bounds.minY, `${path}.bounds.minY`),
      maxX: finite(bounds.maxX, `${path}.bounds.maxX`),
      maxY: finite(bounds.maxY, `${path}.bounds.maxY`),
    };
    if (parsed.minX > parsed.maxX || parsed.minY > parsed.maxY) {
      fail(`${path}.bounds`, '边界最小值不能大于最大值');
    }
    result.bounds = parsed;
  }
  return result;
}

function parseAssertions(value: unknown, path: string): DrawingAssertion[] {
  return array(value, path).map((assertion, index) => parseAssertion(assertion, `${path}[${index}]`));
}

function parseAssertion(value: unknown, path: string): DrawingAssertion {
  const assertion = object(value, path);
  const type = nonEmptyString(assertion.type, `${path}.type`);
  switch (type) {
    case 'node.exists':
    case 'node.absent':
      exact(assertion, ['type', 'nodeId'], path);
      return { type, nodeId: nonEmptyString(assertion.nodeId, `${path}.nodeId`) };
    case 'property.equals':
      exact(assertion, ['type', 'nodeId', 'path', 'value'], path);
      return {
        type,
        nodeId: nonEmptyString(assertion.nodeId, `${path}.nodeId`),
        path: nonEmptyString(assertion.path, `${path}.path`),
        value: jsonValue(assertion.value, `${path}.value`),
      };
    case 'document.valid':
      exact(assertion, ['type'], path);
      return { type };
    case 'selection.count':
      exact(assertion, ['type', 'selector', 'equals', 'min'], path);
      {
        const selector = parseSelector(assertion.selector, `${path}.selector`);
        const hasEquals = 'equals' in assertion;
        const hasMin = 'min' in assertion;
        if (hasEquals === hasMin) {
          fail(path, 'selection.count 必须且只能提供 equals 或 min 之一');
        }
        if (hasEquals) {
          return {
            type,
            selector,
            equals: nonNegativeInteger(assertion.equals, `${path}.equals`),
          };
        }
        return {
          type,
          selector,
          min: nonNegativeInteger(assertion.min, `${path}.min`),
        };
      }
    default:
      fail(`${path}.type`, `不支持的断言类型 ${type}`);
  }
}

function parseCommand(value: unknown, path: string): DrawingCommand {
  const command = object(value, path);
  const type = nonEmptyString(command.type, `${path}.type`);
  if (type === 'history.revert') fail(`${path}.type`, 'Agent 不能生成仓库历史命令');
  const match = /^(geometry|annotation|relation|feature)\.(create|update|delete)$/.exec(type);
  if (!match) fail(`${path}.type`, `不支持的命令类型 ${type}`);
  const plane = match[1] as 'geometry' | 'annotation' | 'relation' | 'feature';
  const action = match[2];
  if (action === 'create') {
    exact(command, ['type', 'value'], path);
    return { type, value: parseCreateValue(command.value, plane, `${path}.value`) } as DrawingCommand;
  }
  if (action === 'delete') {
    exact(command, ['type', 'id'], path);
    return { type, id: nonEmptyString(command.id, `${path}.id`) } as DrawingCommand;
  }
  exact(command, ['type', 'id', 'changes', 'expected'], path);
  const changes = jsonObject(command.changes, `${path}.changes`);
  if (Object.keys(changes).length === 0) fail(`${path}.changes`, '修改字段不能为空');
  for (const immutable of ['id', 'type', 'plane']) {
    if (Object.prototype.hasOwnProperty.call(changes, immutable)) {
      fail(`${path}.changes.${immutable}`, '字段不可修改');
    }
  }
  const expected = command.expected === undefined
    ? undefined
    : jsonObject(command.expected, `${path}.expected`);
  return {
    type,
    id: nonEmptyString(command.id, `${path}.id`),
    changes,
    ...(expected === undefined ? {} : { expected }),
  } as DrawingCommand;
}

function parseCreateValue(
  value: unknown,
  plane: 'geometry' | 'annotation' | 'relation' | 'feature',
  path: string,
): never {
  const node = object(value, path);
  const type = nonEmptyString(node.type, `${path}.type`);
  const common = ['id', 'type', 'visible', 'quality'];
  const geometryKeys: Record<string, string[]> = {
    point: ['x', 'y'], line: ['start', 'end'], ray: ['origin', 'direction'],
    xline: ['origin', 'direction'], circle: ['center', 'radius'],
    arc: ['center', 'radius', 'startAngle', 'endAngle', 'counterClockwise'],
    ellipse: ['center', 'majorAxis', 'ratio', 'startParam', 'endParam'],
    polyline: ['vertices', 'closed'],
    spline: ['degree', 'controlPoints', 'knots', 'weights', 'closed', 'periodic'],
  };
  const annotationKeys: Record<string, string[]> = {
    text: ['content', 'position', 'height', 'rotation', 'alignment', 'verticalAlignment', 'maxWidth'],
    dimension: [
      'dimensionKind', 'associationStatus', 'targets', 'candidates', 'observedValue',
      'computedValue', 'displayText', 'unit', 'tolerance', 'prefix', 'suffix',
      'textPosition', 'definitionPoints',
    ],
  };
  if (plane === 'geometry') {
    const specific = geometryKeys[type];
    if (!specific) fail(`${path}.type`, `不支持的几何类型 ${type}`);
    exact(node, [...common, ...specific], path);
    validateGeometryNode(node, type, path);
  } else if (plane === 'annotation') {
    const specific = annotationKeys[type];
    if (!specific) fail(`${path}.type`, `不支持的标注类型 ${type}`);
    exact(node, [...common, ...specific], path);
    validateAnnotationNode(node, type, path);
  } else if (plane === 'relation') {
    validateRelationNode(node, type, path, common);
  } else {
    if (type !== 'feature') fail(`${path}.type`, 'Feature 类型必须是 feature');
    exact(node, [...common, 'semanticType', 'geometryIds', 'annotationIds', 'relationIds', 'properties'], path);
    nonEmptyString(node.semanticType, `${path}.semanticType`);
    stringArray(node.geometryIds, `${path}.geometryIds`);
    stringArray(node.annotationIds, `${path}.annotationIds`);
    stringArray(node.relationIds, `${path}.relationIds`);
    jsonObject(node.properties, `${path}.properties`);
  }
  if (node.id !== undefined) nonEmptyString(node.id, `${path}.id`);
  boolean(node.visible, `${path}.visible`);
  parseQuality(node.quality, `${path}.quality`);
  return structuredClone(node) as never;
}

function validateGeometryNode(node: Record<string, unknown>, type: string, path: string): void {
  switch (type) {
    case 'point': finite(node.x, `${path}.x`); finite(node.y, `${path}.y`); break;
    case 'line': vec2(node.start, `${path}.start`); vec2(node.end, `${path}.end`); break;
    case 'ray':
    case 'xline': vec2(node.origin, `${path}.origin`); vec2(node.direction, `${path}.direction`); break;
    case 'circle': vec2(node.center, `${path}.center`); positive(node.radius, `${path}.radius`); break;
    case 'arc':
      vec2(node.center, `${path}.center`); positive(node.radius, `${path}.radius`);
      finite(node.startAngle, `${path}.startAngle`); finite(node.endAngle, `${path}.endAngle`);
      boolean(node.counterClockwise, `${path}.counterClockwise`); break;
    case 'ellipse':
      vec2(node.center, `${path}.center`); vec2(node.majorAxis, `${path}.majorAxis`);
      positive(node.ratio, `${path}.ratio`);
      optionalFinite(node.startParam, `${path}.startParam`);
      optionalFinite(node.endParam, `${path}.endParam`); break;
    case 'polyline':
      array(node.vertices, `${path}.vertices`).forEach((vertex, index) => {
        const parsed = object(vertex, `${path}.vertices[${index}]`);
        exact(parsed, ['point', 'bulge'], `${path}.vertices[${index}]`);
        vec2(parsed.point, `${path}.vertices[${index}].point`);
        optionalFinite(parsed.bulge, `${path}.vertices[${index}].bulge`);
      });
      boolean(node.closed, `${path}.closed`); break;
    case 'spline':
      positiveInteger(node.degree, `${path}.degree`);
      vec2Array(node.controlPoints, `${path}.controlPoints`);
      numberArray(node.knots, `${path}.knots`);
      if (node.weights !== undefined) numberArray(node.weights, `${path}.weights`);
      boolean(node.closed, `${path}.closed`); boolean(node.periodic, `${path}.periodic`); break;
  }
}

function validateAnnotationNode(node: Record<string, unknown>, type: string, path: string): void {
  if (type === 'text') {
    nonEmptyString(node.content, `${path}.content`); vec2(node.position, `${path}.position`);
    positive(node.height, `${path}.height`); finite(node.rotation, `${path}.rotation`);
    enumValue(node.alignment, ['left', 'center', 'right'] as const, `${path}.alignment`);
    enumValue(node.verticalAlignment, ['baseline', 'bottom', 'middle', 'top'] as const, `${path}.verticalAlignment`);
    optionalFinite(node.maxWidth, `${path}.maxWidth`);
    return;
  }
  enumValue(node.dimensionKind, [
    'linear', 'aligned', 'angular', 'radius', 'diameter', 'ordinate', 'arc-length',
  ] as const, `${path}.dimensionKind`);
  enumValue(node.associationStatus, ['resolved', 'ambiguous', 'conflict'] as const, `${path}.associationStatus`);
  parseDimensionTargets(node.targets, `${path}.targets`);
  if (node.candidates !== undefined) {
    array(node.candidates, `${path}.candidates`).forEach((candidate, index) => {
      const candidatePath = `${path}.candidates[${index}]`;
      const parsed = object(candidate, candidatePath);
      exact(parsed, ['targets', 'score', 'reasons'], candidatePath);
      parseDimensionTargets(parsed.targets, `${candidatePath}.targets`);
      const score = finite(parsed.score, `${candidatePath}.score`);
      if (score < 0 || score > 1) fail(`${candidatePath}.score`, '候选分数必须在 0 到 1 之间');
      stringArray(parsed.reasons, `${candidatePath}.reasons`);
    });
  }
  optionalFinite(node.observedValue, `${path}.observedValue`);
  optionalFinite(node.computedValue, `${path}.computedValue`);
  vec2(node.textPosition, `${path}.textPosition`);
  vec2Array(node.definitionPoints, `${path}.definitionPoints`);
  for (const key of ['displayText', 'prefix', 'suffix'] as const) {
    if (node[key] !== undefined && typeof node[key] !== 'string') fail(`${path}.${key}`, '必须是字符串');
  }
  if (node.unit !== undefined) enumValue(node.unit, ['mm', 'cm', 'm', 'deg'] as const, `${path}.unit`);
  if (node.tolerance !== undefined) {
    const tolerance = object(node.tolerance, `${path}.tolerance`);
    exact(tolerance, ['upper', 'lower'], `${path}.tolerance`);
    optionalFinite(tolerance.upper, `${path}.tolerance.upper`);
    optionalFinite(tolerance.lower, `${path}.tolerance.lower`);
  }
}

function parseDimensionTargets(value: unknown, path: string): void {
  array(value, path).forEach((target, index) => {
    const targetPath = `${path}[${index}]`;
    const parsed = object(target, targetPath);
    exact(parsed, ['geometryId', 'anchor'], targetPath);
    nonEmptyString(parsed.geometryId, `${targetPath}.geometryId`);
    const anchorPath = `${targetPath}.anchor`;
    const anchor = object(parsed.anchor, anchorPath);
    const kind = nonEmptyString(anchor.kind, `${anchorPath}.kind`);
    if (['start', 'end', 'center'].includes(kind)) {
      exact(anchor, ['kind'], anchorPath);
    } else if (kind === 'vertex') {
      exact(anchor, ['kind', 'index'], anchorPath);
      nonNegativeInteger(anchor.index, `${anchorPath}.index`);
    } else if (kind === 'curve-parameter') {
      exact(anchor, ['kind', 'parameter'], anchorPath);
      finite(anchor.parameter, `${anchorPath}.parameter`);
    } else if (kind === 'nearest') {
      exact(anchor, ['kind', 'point'], anchorPath);
      vec2(anchor.point, `${anchorPath}.point`);
    } else {
      fail(`${anchorPath}.kind`, `不支持的锚点类型 ${kind}`);
    }
  });
}

function validateRelationNode(
  node: Record<string, unknown>,
  type: string,
  path: string,
  common: string[],
): void {
  const fields: Record<string, string[]> = {
    topology: ['plane', 'kind', 'nodeIds'],
    constraint: ['plane', 'kind', 'geometryIds', 'value', 'property', 'status'],
    association: ['plane', 'kind', 'annotationId', 'geometryIds'],
    semantic: ['plane', 'kind', 'featureId', 'nodeIds'],
  };
  const specific = fields[type];
  if (!specific) fail(`${path}.type`, `不支持的关系类型 ${type}`);
  exact(node, [...common, ...specific], path);
  if (node.plane !== type) fail(`${path}.plane`, '关系 plane 必须与 type 一致');
  if (type === 'topology') {
    enumValue(node.kind, ['connected', 'closed', 'contains', 'intersects'] as const, `${path}.kind`);
  } else if (type === 'constraint') {
    enumValue(node.kind, [
      'horizontal', 'vertical', 'parallel', 'perpendicular', 'tangent', 'concentric',
      'equal', 'distance', 'radius', 'angle', 'symmetry',
    ] as const, `${path}.kind`);
  } else if (type === 'association') {
    enumValue(node.kind, ['annotation-target'] as const, `${path}.kind`);
  } else {
    enumValue(node.kind, ['feature-member'] as const, `${path}.kind`);
  }
  if (type === 'constraint' || type === 'association') {
    stringArray(node.geometryIds, `${path}.geometryIds`);
  } else stringArray(node.nodeIds, `${path}.nodeIds`);
  if (type === 'association') nonEmptyString(node.annotationId, `${path}.annotationId`);
  if (type === 'semantic') nonEmptyString(node.featureId, `${path}.featureId`);
  if (type === 'constraint') {
    optionalFinite(node.value, `${path}.value`);
    if (node.property !== undefined) nonEmptyString(node.property, `${path}.property`);
    enumValue(node.status, ['defined', 'satisfied', 'violated', 'unsolved'] as const, `${path}.status`);
  }
}

function parseQuality(value: unknown, path: string): void {
  const quality = object(value, path);
  exact(quality, ['status', 'confidence', 'evidenceRefs'], path);
  enumValue(quality.status, ['confirmed', 'candidate'] as const, `${path}.status`);
  const confidence = optionalFinite(quality.confidence, `${path}.confidence`);
  if (confidence !== undefined && (confidence < 0 || confidence > 1)) fail(`${path}.confidence`, '置信度无效');
  stringArray(quality.evidenceRefs, `${path}.evidenceRefs`);
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(path, '必须是对象');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(path, '对象原型无效');
  return value as Record<string, unknown>;
}

function exact(value: Record<string, unknown>, keys: string[], path: string): void {
  const allowed = new Set(keys);
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  if (unknown) fail(`${path}.${unknown}`, '未知字段');
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, '必须是数组');
  return value;
}

function stringArray(value: unknown, path: string): string[] {
  return array(value, path).map((item, index) => nonEmptyString(item, `${path}[${index}]`));
}

function nonEmptyStringArray(value: unknown, path: string): string[] {
  const values = stringArray(value, path);
  if (values.length === 0) fail(path, '不能为空');
  if (new Set(values).size !== values.length) fail(path, '不能包含重复值');
  return values;
}

function numberArray(value: unknown, path: string): number[] {
  return array(value, path).map((item, index) => finite(item, `${path}[${index}]`));
}

function vec2Array(value: unknown, path: string): Array<readonly [number, number]> {
  return array(value, path).map((item, index) => vec2(item, `${path}[${index}]`));
}

function vec2(value: unknown, path: string): readonly [number, number] {
  const values = array(value, path);
  if (values.length !== 2) fail(path, '必须包含两个坐标');
  return [finite(values[0], `${path}[0]`), finite(values[1], `${path}[1]`)];
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) fail(path, '必须是非空字符串');
  return value;
}

function optionalNonEmptyString(value: unknown, path: string): string | undefined {
  return value === undefined ? undefined : nonEmptyString(value, path);
}

function digest(value: unknown, path: string): string {
  const result = nonEmptyString(value, path);
  if (!/^[a-f0-9]{64}$/i.test(result)) fail(path, '必须是 64 位摘要');
  return result;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, '必须是布尔值');
  return value;
}

function finite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, '必须是有限数字');
  return value;
}

function optionalFinite(value: unknown, path: string): number | undefined {
  return value === undefined ? undefined : finite(value, path);
}

function positive(value: unknown, path: string): number {
  const result = finite(value, path);
  if (result <= 0) fail(path, '必须大于零');
  return result;
}

function positiveInteger(value: unknown, path: string): number {
  const result = finite(value, path);
  if (!Number.isInteger(result) || result <= 0) fail(path, '必须是正整数');
  return result;
}

function nonNegativeInteger(value: unknown, path: string): number {
  const result = finite(value, path);
  if (!Number.isInteger(result) || result < 0) fail(path, '必须是非负整数');
  return result;
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  choices: T,
  path: string,
): T[number] {
  if (typeof value !== 'string' || !choices.includes(value)) fail(path, `必须是 ${choices.join(' | ')}`);
  return value as T[number];
}

function jsonObject(value: unknown, path: string): Record<string, unknown> {
  const result = jsonValue(value, path);
  if (result === null || typeof result !== 'object' || Array.isArray(result)) fail(path, '必须是 JSON 对象');
  return result as Record<string, unknown>;
}

function jsonValue(value: unknown, path: string): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return finite(value, path);
  if (Array.isArray(value)) return value.map((item, index) => jsonValue(item, `${path}[${index}]`));
  const record = object(value, path);
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) fail(`${path}.${key}`, '保留字段');
    result[key] = jsonValue(item, `${path}.${key}`);
  }
  return result;
}

function fail(path: string, message: string): never {
  throw new DrawingAgentProtocolError(path, message);
}
