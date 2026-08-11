import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

import type { EditEpisode } from './types.js';

export interface EditEpisodeStore {
  create(episode: EditEpisode): Promise<void>;
  read(runId: string): Promise<EditEpisode | null>;
  save(episode: EditEpisode): Promise<void>;
}

export class FileEditEpisodeStore implements EditEpisodeStore {
  constructor(private readonly input: { rootDirectory: string }) {}

  async create(episode: EditEpisode): Promise<void> {
    validateEpisode(episode);
    if (await this.read(episode.runId)) throw new Error('EPISODE_ALREADY_EXISTS');
    await this.#write(episode);
  }

  async read(runId: string): Promise<EditEpisode | null> {
    try {
      const value = JSON.parse(await readFile(this.#path(runId), 'utf8')) as EditEpisode;
      validateEpisode(value);
      return structuredClone(value);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async save(episode: EditEpisode): Promise<void> {
    validateEpisode(episode);
    const current = await this.read(episode.runId);
    if (!current) throw new Error('EPISODE_NOT_FOUND');
    if (current.id !== episode.id || current.drawingId !== episode.drawingId
      || current.baseRevision !== episode.baseRevision) throw new Error('EPISODE_SCOPE_MISMATCH');
    assertImmutablePrefix(current.feedbackTurns, episode.feedbackTurns, 'EPISODE_FEEDBACK_IMMUTABLE');
    assertVersionEvolution(current.regionVersions, episode.regionVersions);
    assertVersionEvolution(current.selectionVersions, episode.selectionVersions);
    assertVersionEvolution(current.previewVersions, episode.previewVersions);
    await this.#write(episode);
  }

  async #write(episode: EditEpisode): Promise<void> {
    const path = this.#path(episode.runId);
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(episode, null, 2)}\n`, 'utf8');
    await rename(temporary, path);
  }

  #path(runId: string): string {
    if (!runId || runId.includes('/') || runId.includes('..')) throw new Error('EPISODE_RUN_ID_INVALID');
    return join(this.input.rootDirectory, runId, 'episode.json');
  }
}

function validateEpisode(episode: EditEpisode): void {
  if (episode.schemaVersion !== 1 || !episode.id || !episode.runId || !episode.drawingId
    || !episode.baseRevision || !episode.originalGoal) throw new Error('EPISODE_INVALID');
  assertContiguous(episode.regionVersions.map((value) => value.version));
  assertContiguous(episode.selectionVersions.map((value) => value.version));
  assertContiguous(episode.previewVersions.map((value) => value.version));
}

function assertContiguous(versions: number[]): void {
  if (versions.some((version, index) => version !== index + 1)) {
    throw new Error('EPISODE_VERSION_NON_MONOTONIC');
  }
}

function assertImmutablePrefix<T>(current: T[], next: T[], code: string): void {
  if (next.length < current.length || current.some((value, index) => (
    JSON.stringify(value) !== JSON.stringify(next[index])
  ))) throw new Error(code);
}

function assertVersionEvolution<T extends { version: number }>(current: T[], next: T[]): void {
  if (next.length < current.length) throw new Error('EPISODE_VERSION_NON_MONOTONIC');
  assertContiguous(next.map((value) => value.version));
  current.forEach((value, index) => {
    if (value.version !== next[index]?.version) throw new Error('EPISODE_VERSION_NON_MONOTONIC');
  });
}
