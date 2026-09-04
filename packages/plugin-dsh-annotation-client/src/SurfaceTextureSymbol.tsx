// SPDX-License-Identifier: Apache-2.0

import type { EngineeringAnnotationDraft } from '@vectorai/plugin-space-contracts';

type SurfaceTextureIntent = EngineeringAnnotationDraft['surfaceTextures'][number];

/**
 * Standard surface-texture graphical symbol proportions from ISO 21920-1 / GB/T 131.
 * Kept as geometry instead of a font glyph so CAD-style rendering is stable on every host.
 */
export function SurfaceTextureSymbol({ materialRemoval }: {
  materialRemoval: SurfaceTextureIntent['materialRemoval'];
}) {
  return <g className="vai-surface-texture__standard-symbol" aria-label="表面粗糙度符号">
    {materialRemoval === 'required'
      ? <path d="M -12 -16 L 0 2 L 12 -16 Z M 12 -16 L 26 -37" />
      : <path d="M -9 -9 L 0 0 L 18 -28" />}
    {materialRemoval === 'prohibited' && <circle cx={0} cy={0} r={4.5} />}
  </g>;
}
