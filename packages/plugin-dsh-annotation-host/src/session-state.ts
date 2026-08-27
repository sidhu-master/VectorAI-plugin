// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  annotationSessionStateSchema,
  type AnnotationSessionState,
} from '@vectorai/plugin-space-contracts';

export type { AnnotationSessionState } from '@vectorai/plugin-space-contracts';

export type AnnotationWorkflowStatus = AnnotationSessionState['workflow']['status'];

export interface AnnotationSessionStorage {
  load(sessionId: string): unknown | null;
  save(sessionId: string, state: unknown): void;
  delete(sessionId: string): void;
}

export class AnnotationSessionStateStore {
  readonly #memory = new Map<string, AnnotationSessionState>();

  constructor(
    private readonly storage?: AnnotationSessionStorage,
    private readonly ports: { now(): number } = { now: Date.now },
  ) {}

  get(sessionId: string): AnnotationSessionState {
    const current = this.#memory.get(sessionId);
    if (current !== undefined) return structuredClone(current);
    const restored = parseState(this.storage?.load(sessionId));
    const state = restored ?? emptyState();
    this.#memory.set(sessionId, state);
    return structuredClone(state);
  }

  start(sessionId: string, workflowId: string): AnnotationSessionState {
    const previous = this.get(sessionId);
    return this.#set(sessionId, {
      version: 1,
      workspaceClaimed: true,
      activationEpoch: previous.workspaceClaimed ? previous.activationEpoch : this.ports.now(),
      workflow: { status: 'running', workflowId },
    });
  }

  finish(
    sessionId: string,
    status: Exclude<AnnotationWorkflowStatus, 'idle' | 'running' | 'reviewing'>,
    message?: string,
  ): AnnotationSessionState {
    const previous = this.get(sessionId);
    if (!previous.workspaceClaimed) throw new Error('ANNOTATION_WORKSPACE_NOT_CLAIMED');
    return this.#set(sessionId, {
      ...previous,
      workflow: {
        status,
        ...(previous.workflow.workflowId === undefined ? {} : { workflowId: previous.workflow.workflowId }),
        ...(message === undefined ? {} : { message }),
      },
    });
  }

  release(sessionId: string): AnnotationSessionState {
    return this.#set(sessionId, emptyState());
  }

  disposeSession(sessionId: string): void {
    this.#memory.delete(sessionId);
    this.storage?.delete(sessionId);
  }

  #set(sessionId: string, state: AnnotationSessionState): AnnotationSessionState {
    const clone = structuredClone(state);
    this.#memory.set(sessionId, clone);
    this.storage?.save(sessionId, clone);
    return structuredClone(clone);
  }
}

export class FileAnnotationSessionStorage implements AnnotationSessionStorage {
  constructor(private readonly directory: string) {}

  load(sessionId: string): unknown | null {
    const path = this.#path(sessionId);
    if (!existsSync(path)) return null;
    try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
  }

  save(sessionId: string, state: unknown): void {
    mkdirSync(this.directory, { recursive: true });
    writeFileSync(this.#path(sessionId), `${JSON.stringify(state)}\n`, 'utf8');
  }

  delete(sessionId: string): void {
    const path = this.#path(sessionId);
    if (existsSync(path)) unlinkSync(path);
  }

  #path(sessionId: string): string {
    const key = createHash('sha256').update(sessionId).digest('hex');
    return join(this.directory, `${key}.json`);
  }
}

function emptyState(): AnnotationSessionState {
  return {
    version: 1,
    workspaceClaimed: false,
    activationEpoch: 0,
    workflow: { status: 'idle' },
  };
}

function parseState(value: unknown): AnnotationSessionState | null {
  const parsed = annotationSessionStateSchema.safeParse(value);
  return parsed.success ? structuredClone(parsed.data) : null;
}
