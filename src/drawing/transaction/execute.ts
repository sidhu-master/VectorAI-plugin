import { compileDrawingCommands, evaluateAssertion } from '../command/compile';
import type { DrawingAssertion } from '../command/types';
import { randomIdFactory, type IdFactory } from '../document/create';
import type { DrawingDocument } from '../document/types';
import { applyDrawingPatch } from '../patch/apply';
import type { DrawingPatchOperation } from '../patch/types';
import { inspectNode } from '../query/query';
import { validateDrawingDocument } from '../validation/document';
import type {
  DrawingError,
  DrawingTransaction,
  GoalOutcomeReport,
  TransactionContext,
  TransactionResult,
} from './types';

const PATCH_ERROR_CODES = new Set(['NODE_NOT_FOUND', 'IMMUTABLE_FIELD']);

export function previewTransaction(
  context: TransactionContext,
  transaction: DrawingTransaction,
  idFactory: IdFactory = randomIdFactory,
): TransactionResult {
  if (transaction.baseRevision !== context.currentRevision) {
    return rejected({
      code: 'STALE_REVISION',
      stage: 'revision',
      retryable: true,
      nodeIds: [],
      message: `事务基于 ${transaction.baseRevision}，当前版本是 ${context.currentRevision}`,
      suggestedAction: 'requery',
    });
  }

  // 仅当没有任何待执行命令时,若后置条件已在当前文档上满足,才短路为 already_satisfied。
  // 若存在实际命令(新建/修改/删除),必须真正应用并校验应用后的结果,不能被宽松断言吞掉。
  if (transaction.commands.length === 0 && transaction.postconditions.length > 0) {
    const currentOutcome = evaluateOutcome(context.document, transaction.postconditions);
    if (currentOutcome.satisfied) return { status: 'already_satisfied', outcome: currentOutcome };
  }

  const failedPreconditions = failedAssertions(context.document, transaction.preconditions);
  if (failedPreconditions.length > 0) {
    return {
      status: 'rejected',
      errors: failedPreconditions.map((assertion) => assertionError(
        assertion,
        'PRECONDITION_FAILED',
        'precondition',
        '事务前置条件不成立',
        'requery',
      )),
    };
  }

  const compilation = compileDrawingCommands(context.document, transaction.commands, idFactory);
  if ('errors' in compilation) {
    return {
      status: 'rejected',
      errors: compilation.errors.map((error): DrawingError => ({
        code: error.code,
        stage: 'compile',
        retryable: error.code === 'NODE_NOT_FOUND',
        nodeIds: [],
        message: error.message,
        suggestedAction: error.code === 'NODE_NOT_FOUND' ? 'requery' : 'replan',
      })),
    };
  }

  const failedGeneratedPreconditions = failedAssertions(
    context.document,
    compilation.preconditions,
  );
  if (failedGeneratedPreconditions.length > 0) {
    return {
      status: 'rejected',
      errors: failedGeneratedPreconditions.map((assertion) => assertionError(
        assertion,
        'PRECONDITION_FAILED',
        'precondition',
        '命令期望的原值不成立',
        'requery',
      )),
    };
  }

  const applied = applyDrawingPatch(context.document, compilation.patch);
  if ('errors' in applied) {
    return {
      status: 'rejected',
      errors: applied.errors.map((error): DrawingError => {
        const isPatchError = PATCH_ERROR_CODES.has(error.code);
        return {
          code: error.code,
          stage: isPatchError ? 'patch' : 'validation',
          retryable: true,
          nodeIds: [],
          message: error.message,
          suggestedAction: isPatchError ? 'requery' : 'repair',
        };
      }),
    };
  }

  const validationReport = validateDrawingDocument(applied.document);
  if (!validationReport.valid) {
    return {
      status: 'rejected',
      errors: validationReport.issues
        .filter((issue) => issue.severity === 'error')
        .map((issue): DrawingError => ({
          code: issue.code,
          stage: 'validation',
          retryable: true,
          nodeIds: issue.nodeIds,
          message: issue.message,
          suggestedAction: 'repair',
        })),
    };
  }

  const outcomeReport = evaluateOutcome(applied.document, transaction.postconditions);
  if (!outcomeReport.satisfied) {
    return {
      status: 'rejected',
      errors: outcomeReport.assertions
        .filter((result) => !result.satisfied)
        .map(({ assertion }) => assertionError(
          assertion,
          'POSTCONDITION_FAILED',
          'postcondition',
          '事务执行结果未满足目标',
          'replan',
        )),
    };
  }

  const affectedNodeIds = collectAffectedNodeIds(
    compilation.patch.operations,
    applied.inversePatch.operations,
  );
  const candidate = validationReport.issues.some((issue) => issue.severity === 'candidate')
    || affectedNodeIds.some((id) => (
      inspectNode(applied.document, id)?.node.quality.status === 'candidate'
    ));

  return {
    status: 'ready',
    preview: {
      transactionId: transaction.id,
      baseRevision: transaction.baseRevision,
      patch: compilation.patch,
      inversePatch: applied.inversePatch,
      affectedNodeIds,
      validationReport,
      outcomeReport,
      candidate,
      ...(transaction.metadata === undefined
        ? {}
        : { metadata: structuredClone(transaction.metadata) }),
    },
    resultingDocument: applied.document,
  };
}

function evaluateOutcome(
  document: DrawingDocument,
  assertions: DrawingAssertion[],
): GoalOutcomeReport {
  const results = assertions.map((assertion) => ({
    assertion,
    satisfied: evaluateAssertion(document, assertion),
  }));
  return { satisfied: results.every((result) => result.satisfied), assertions: results };
}

function failedAssertions(
  document: DrawingDocument,
  assertions: DrawingAssertion[],
): DrawingAssertion[] {
  return assertions.filter((assertion) => !evaluateAssertion(document, assertion));
}

function assertionError(
  assertion: DrawingAssertion,
  code: string,
  stage: DrawingError['stage'],
  message: string,
  suggestedAction: NonNullable<DrawingError['suggestedAction']>,
): DrawingError {
  return {
    code,
    stage,
    retryable: true,
    nodeIds: 'nodeId' in assertion ? [assertion.nodeId] : [],
    message,
    suggestedAction,
  };
}

function collectAffectedNodeIds(
  operations: DrawingPatchOperation[],
  inverseOperations: DrawingPatchOperation[],
): string[] {
  const ids = new Set<string>();
  for (const operation of [...operations, ...inverseOperations]) {
    ids.add('value' in operation ? operation.value.id : operation.id);
  }
  return [...ids];
}

function rejected(error: DrawingError): TransactionResult {
  return { status: 'rejected', errors: [error] };
}
