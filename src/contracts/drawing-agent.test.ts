import { describe, expect, it } from 'vitest';
import {
  DrawingAgentProtocolError,
  parseAgentDecision,
  parseAgentPlan,
  parseHumanDecisionRequest,
  parseHumanDecisionResponse,
  parsePermissionGrant,
} from './drawing-agent';

const validPlan = {
  goal: {
    id: 'goal_1',
    objective: '把选中的圆半径改为 8mm',
    scope: { plane: 'geometry', ids: ['geometry_1'], types: ['circle'], limit: 20 },
    acceptanceCriteria: [
      { type: 'property.equals', nodeId: 'geometry_1', path: 'radius', value: 8 },
      { type: 'document.valid' },
    ],
    riskPolicy: { candidateAllowed: false, maxCommits: 2 },
  },
  workflow: [{
    id: 'node_1',
    capability: 'edit_entities',
    dependsOn: [],
    completionCriteria: [
      { type: 'property.equals', nodeId: 'geometry_1', path: 'radius', value: 8 },
    ],
    status: 'pending',
  }],
  summary: '更新目标圆并验证半径',
};

describe('Drawing Agent shared protocol', () => {
  it.each([
    ['grant-permission', {
      type: 'permission', decision: 'allow',
      actions: ['constraint.delete'], resourceIds: ['constraint_1'],
    }],
    ['choose-option', { type: 'option', value: 'redraw' }],
    ['confirm-intent', { type: 'intent', decision: 'confirm' }],
    ['provide-context', { type: 'context', key: 'design-standard' }],
    ['accept-risk', { type: 'risk', decision: 'accept', riskIds: ['open-endpoint'] }],
  ])('parses an exact %s Human Decision request', (kind, effect) => {
    const input = {
      id: `request_${kind}`,
      episodeId: 'episode_1',
      revision: 'revision_1',
      candidateId: 'candidate_1',
      transactionDigest: 'a'.repeat(64),
      kind,
      question: '请确认本次候选操作',
      reason: '继续需要用户提供一项决定',
      options: [{
        id: 'continue', label: '继续', description: '只作用于当前候选', effect,
      }],
      recommendedOptionId: 'continue',
      affectedResources: [{
        plane: kind === 'provide-context' ? 'external' : 'relation',
        ids: kind === 'provide-context' ? ['design-standard'] : ['constraint_1'],
        action: kind,
      }],
      previewHandle: 'preview_1',
      expiresWhenRevisionChanges: true,
    };

    const parsed = parseHumanDecisionRequest(input);

    expect(parsed).toEqual(input);
    expect(parsed).not.toBe(input);
    expect(parsed.options[0]).not.toBe(input.options[0]);
  });

  it('parses an exact response and candidate-scoped permission grant', () => {
    expect(parseHumanDecisionResponse({
      requestId: 'request_1', selectedOptionId: 'allow_once',
      additionalInstruction: '只处理当前候选', decidedAt: 100,
    })).toEqual({
      requestId: 'request_1', selectedOptionId: 'allow_once',
      additionalInstruction: '只处理当前候选', decidedAt: 100,
    });

    expect(parsePermissionGrant({
      id: 'grant_1', requestId: 'request_1', episodeId: 'episode_1',
      revision: 'revision_1', transactionDigest: 'b'.repeat(64),
      actions: ['constraint.delete'], resourceIds: ['constraint_1'],
      effect: 'allow', scope: 'candidate',
    })).toEqual({
      id: 'grant_1', requestId: 'request_1', episodeId: 'episode_1',
      revision: 'revision_1', transactionDigest: 'b'.repeat(64),
      actions: ['constraint.delete'], resourceIds: ['constraint_1'],
      effect: 'allow', scope: 'candidate',
    });
  });

  it.each([
    ['unknown request field', {
      id: 'request_1', episodeId: 'episode_1', revision: 'revision_1',
      kind: 'confirm-intent', question: '继续吗', reason: '意图不明确',
      options: [{ id: 'yes', label: '继续' }], affectedResources: [],
      expiresWhenRevisionChanges: true, hiddenReasoning: 'secret',
    }, 'humanDecisionRequest.hiddenReasoning'],
    ['empty options', {
      id: 'request_1', episodeId: 'episode_1', revision: 'revision_1',
      kind: 'confirm-intent', question: '继续吗', reason: '意图不明确',
      options: [], affectedResources: [], expiresWhenRevisionChanges: true,
    }, 'humanDecisionRequest.options'],
    ['missing recommended option', {
      id: 'request_1', episodeId: 'episode_1', revision: 'revision_1',
      kind: 'choose-option', question: '选哪个', reason: '有多个方案',
      options: [{ id: 'one', label: '方案一' }], recommendedOptionId: 'missing',
      affectedResources: [], expiresWhenRevisionChanges: true,
    }, 'humanDecisionRequest.recommendedOptionId'],
    ['effect incompatible with request kind', {
      id: 'request_1', episodeId: 'episode_1', revision: 'revision_1',
      kind: 'grant-permission', question: '允许吗', reason: '需要权限',
      options: [{
        id: 'yes', label: '允许',
        effect: { type: 'risk', decision: 'accept', riskIds: ['risk_1'] },
      }],
      affectedResources: [], expiresWhenRevisionChanges: true,
    }, 'humanDecisionRequest.options[0].effect.type'],
  ])('rejects %s', (_name, input, path) => {
    expect(() => parseHumanDecisionRequest(input)).toThrow(expect.objectContaining({
      name: 'DrawingAgentProtocolError', path,
    }));
  });

  it('parses a complete GoalSpec and workflow without sharing input references', () => {
    const parsed = parseAgentPlan(validPlan);

    expect(parsed).toEqual(validPlan);
    expect(parsed).not.toBe(validPlan);
    expect(parsed.goal.scope).not.toBe(validPlan.goal.scope);
  });

  it.each([
    {
      input: {
        type: 'query', toolCallId: 'tool_1',
        selector: { plane: 'geometry', qualityStatus: 'candidate', limit: 10 },
      },
      expectedType: 'query',
    },
    {
      input: { type: 'inspect', toolCallId: 'tool_2', nodeId: 'geometry_1' },
      expectedType: 'inspect',
    },
    {
      input: {
        type: 'transact', toolCallId: 'tool_3', confidence: 0.72,
        commands: [{
          type: 'geometry.update', id: 'geometry_1',
          changes: { radius: 8 }, expected: { radius: 5 },
        }],
      },
      expectedType: 'transact',
    },
    {
      input: { type: 'finish', summary: '目标已满足' },
      expectedType: 'finish',
    },
  ])('parses the $expectedType decision arm', ({ input, expectedType }) => {
    expect(parseAgentDecision(input)).toMatchObject({ type: expectedType });
  });

  it('accepts explicit geometry and annotation creation commands', () => {
    const decision = parseAgentDecision({
      type: 'transact',
      toolCallId: 'tool_create',
      commands: [
        {
          type: 'geometry.create',
          value: {
            id: 'geometry_circle', type: 'circle', center: [0, 0], radius: 5,
            visible: true,
            quality: { status: 'confirmed', evidenceRefs: [] },
          },
        },
        {
          type: 'annotation.create',
          value: {
            id: 'annotation_text', type: 'text', content: 'R5', position: [8, 0],
            height: 2.5, rotation: 0, alignment: 'left',
            verticalAlignment: 'baseline', visible: true,
            quality: { status: 'confirmed', evidenceRefs: [] },
          },
        },
      ],
    });

    expect(decision).toMatchObject({ type: 'transact', commands: [{
      type: 'geometry.create', value: { type: 'circle', radius: 5 },
    }, { type: 'annotation.create', value: { type: 'text', content: 'R5' } }] });
  });

  it.each([
    ['unknown plan key', { ...validPlan, reasoning: 'hidden' }, 'plan.reasoning'],
    ['empty workflow', { ...validPlan, workflow: [] }, 'plan.workflow'],
    ['unsupported workflow capability', {
      ...validPlan,
      workflow: [{ ...validPlan.workflow[0], capability: 'create_geometry' }],
    }, 'plan.workflow[0].capability'],
    ['invalid workflow dependency', {
      ...validPlan,
      workflow: [{ ...validPlan.workflow[0], dependsOn: ['missing_node'] }],
    }, 'plan.workflow[0].dependsOn[0]'],
    ['cyclic workflow', {
      ...validPlan,
      workflow: [
        { ...validPlan.workflow[0], id: 'node_1', dependsOn: ['node_2'] },
        { ...validPlan.workflow[0], id: 'node_2', dependsOn: ['node_1'] },
      ],
    }, 'plan.workflow'],
    ['goal without acceptance criteria', {
      ...validPlan,
      goal: { ...validPlan.goal, acceptanceCriteria: [] },
    }, 'plan.goal.acceptanceCriteria'],
    ['malformed selector', {
      ...validPlan,
      goal: { ...validPlan.goal, scope: { plane: 'geometry', limit: 0 } },
    }, 'plan.goal.scope.limit'],
    ['legacy model payload', { ...validPlan, spatialModel: { entities: [] } }, 'plan.spatialModel'],
  ])('rejects %s', (_name, input, path) => {
    expect(() => parseAgentPlan(input)).toThrow(expect.objectContaining({
      name: 'DrawingAgentProtocolError', path,
    }));
  });

  it.each([
    ['unknown decision key', {
      type: 'finish', summary: '完成', model: 'doubao-seed-2.0-lite',
    }, 'decision.model'],
    ['empty transaction', {
      type: 'transact', toolCallId: 'tool_1', commands: [],
    }, 'decision.commands'],
    ['invalid confidence', {
      type: 'transact', toolCallId: 'tool_1', confidence: 1.2,
      commands: [{ type: 'geometry.delete', id: 'geometry_1' }],
    }, 'decision.confidence'],
    ['immutable update', {
      type: 'transact', toolCallId: 'tool_1',
      commands: [{ type: 'geometry.update', id: 'geometry_1', changes: { type: 'arc' } }],
    }, 'decision.commands[0].changes.type'],
    ['repository-only command', {
      type: 'transact', toolCallId: 'tool_1',
      commands: [{ type: 'history.revert', commitId: 'commit_1' }],
    }, 'decision.commands[0].type'],
    ['malformed query bounds', {
      type: 'query', toolCallId: 'tool_1',
      selector: { bounds: { minX: 10, minY: 0, maxX: 5, maxY: 2 } },
    }, 'decision.selector.bounds'],
    ['unknown dimension target key', {
      type: 'transact', toolCallId: 'tool_1', commands: [{
        type: 'annotation.create', value: {
          type: 'dimension', dimensionKind: 'radius', associationStatus: 'resolved',
          targets: [{
            geometryId: 'geometry_1', anchor: { kind: 'center' }, guessed: true,
          }],
          textPosition: [0, 0], definitionPoints: [], visible: true,
          quality: { status: 'confirmed', evidenceRefs: [] },
        },
      }],
    }, 'decision.commands[0].value.targets[0].guessed'],
    ['unsupported relation kind', {
      type: 'transact', toolCallId: 'tool_1', commands: [{
        type: 'relation.create', value: {
          type: 'constraint', plane: 'constraint', kind: 'near-enough',
          geometryIds: ['geometry_1'], status: 'defined', visible: true,
          quality: { status: 'confirmed', evidenceRefs: [] },
        },
      }],
    }, 'decision.commands[0].value.kind'],
    ['legacy model payload', {
      type: 'query', toolCallId: 'tool_1', selector: {}, spatialModel: {},
    }, 'decision.spatialModel'],
  ])('rejects %s', (_name, input, path) => {
    expect(() => parseAgentDecision(input)).toThrow(expect.objectContaining({
      name: 'DrawingAgentProtocolError', path,
    }));
  });

  it('rejects prototype-like own properties instead of copying them', () => {
    const input = JSON.parse(
      '{"type":"finish","summary":"done","__proto__":{"polluted":true}}',
    );

    expect(() => parseAgentDecision(input)).toThrow(DrawingAgentProtocolError);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
});
