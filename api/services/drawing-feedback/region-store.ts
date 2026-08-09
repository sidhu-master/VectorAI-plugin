import type { SourcePixelSize } from '../drawing-cv/types.js';
import type { ObservationRegion } from './types.js';

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export class MemoryObservationRegionStore {
  readonly #resolveSourceSize: (sourceId: string) => SourcePixelSize;
  readonly #regions = new Map<string, ObservationRegion>();

  constructor(input: { resolveSourceSize: (sourceId: string) => SourcePixelSize }) {
    this.#resolveSourceSize = input.resolveSourceSize;
  }

  create(input: ObservationRegion): ObservationRegion {
    validateRegion(input);
    if (this.#regions.has(input.id)) throw new Error('OBSERVATION_REGION_EXISTS');
    if (input.parentRegionId) {
      const parent = this.#regions.get(input.parentRegionId);
      if (!parent) throw new Error('OBSERVATION_PARENT_NOT_FOUND');
      if (parent.sourceId !== input.sourceId) throw new Error('OBSERVATION_PARENT_SOURCE_MISMATCH');
    }
    const size = this.#resolveSourceSize(input.sourceId);
    if (input.bounds.x + input.bounds.width > size.width
      || input.bounds.y + input.bounds.height > size.height) {
      throw new Error('OBSERVATION_REGION_OUT_OF_BOUNDS');
    }
    const stored = structuredClone(input);
    this.#regions.set(stored.id, stored);
    return structuredClone(stored);
  }

  read(id: string): ObservationRegion {
    const region = this.#regions.get(id);
    if (!region) throw new Error('OBSERVATION_REGION_NOT_FOUND');
    return structuredClone(region);
  }

  list(sourceId?: string): ObservationRegion[] {
    return [...this.#regions.values()]
      .filter((region) => sourceId === undefined || region.sourceId === sourceId)
      .map((region) => structuredClone(region));
  }
}

function validateRegion(region: ObservationRegion): void {
  if (!SAFE_ID.test(region.id) || !SAFE_ID.test(region.sourceId)
    || region.targetSlotIds.some((id) => !SAFE_ID.test(id))
    || (region.parentRegionId !== undefined && !SAFE_ID.test(region.parentRegionId))) {
    throw new Error('OBSERVATION_REGION_ID_INVALID');
  }
  const { x, y, width, height } = region.bounds;
  if (![x, y, width, height].every(Number.isInteger)
    || x < 0 || y < 0 || width < 1 || height < 1) {
    throw new Error('OBSERVATION_REGION_BOUNDS_INVALID');
  }
  if (!Number.isInteger(region.resolutionLevel) || region.resolutionLevel < 0
    || !Number.isInteger(region.attempt) || region.attempt < 1) {
    throw new Error('OBSERVATION_REGION_VERSION_INVALID');
  }
}
