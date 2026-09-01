// SPDX-License-Identifier: Apache-2.0

/**
 * Two maximally escaped fields plus 2 KiB reserved for the tolerance envelope,
 * chunk metadata, application names, and native DSTYLE data remain within the
 * DXF 16 KiB per-entity XDATA ceiling.
 */
export const TOLERANCE_STANDARD_REF_FIELD_MAX_UTF8_BYTES = 3_584;

export function isToleranceStandardRefField(value: string): boolean {
  return value.trim().length > 0
    && !Array.from(value).some((character) => character.charCodeAt(0) <= 0x1f)
    && new TextEncoder().encode(value).byteLength <= TOLERANCE_STANDARD_REF_FIELD_MAX_UTF8_BYTES;
}
