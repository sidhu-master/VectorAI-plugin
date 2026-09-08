// SPDX-License-Identifier: Apache-2.0

export interface CadAxialDimensionOffsetInput {
  radialDistance: number;
  lane: number;
  textHeight: number;
  chainOffset?: number;
  candidateOffset?: number;
}

/** Place dimensions in stable drawing-unit lanes independent of the DSH viewport. */
export function cadAxialDimensionOffset(input: CadAxialDimensionOffsetInput): number {
  return input.radialDistance
    + input.textHeight * 3
    + Math.max(0, input.lane) * input.textHeight * 2
    + (input.chainOffset ?? 0)
    + (input.candidateOffset ?? 0);
}
