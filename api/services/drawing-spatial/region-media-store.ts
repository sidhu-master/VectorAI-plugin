import { createHash } from 'node:crypto';

export class RegionMediaStore {
  readonly #maxItems: number;
  readonly #media = new Map<string, Buffer>();

  constructor(input: { maxItems?: number } = {}) {
    this.#maxItems = Math.max(1, Math.floor(input.maxItems ?? 32));
  }

  put(scope: string, png: Buffer): string {
    if (png.byteLength === 0) throw new Error('REGION_MASK_EMPTY');
    const handle = `region_mask_${createHash('sha256')
      .update(scope)
      .update('\0')
      .update(png)
      .digest('hex')
      .slice(0, 24)}`;
    this.#media.delete(handle);
    this.#media.set(handle, Buffer.from(png));
    while (this.#media.size > this.#maxItems) {
      this.#media.delete(this.#media.keys().next().value!);
    }
    return handle;
  }

  read(handle: string): Buffer | null {
    const value = this.#media.get(handle);
    if (!value) return null;
    this.#media.delete(handle);
    this.#media.set(handle, value);
    return Buffer.from(value);
  }
}
