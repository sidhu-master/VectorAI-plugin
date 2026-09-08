// SPDX-License-Identifier: Apache-2.0

export interface DxfLayerStyle {
  name: string;
  color: number;
  lineType?: string;
  lineWeight?: number;
}

export interface DxfTextStyle {
  name: string;
  font: string;
  bigFont?: string;
  height: number;
  widthFactor: number;
  lastHeight?: number;
  obliqueAngle?: number;
  generationFlags?: number;
}

export interface DxfLineType {
  name: string;
  description: string;
  pattern: readonly number[];
}

export interface DxfDimensionStyle {
  name: string;
  overallScale: number;
  arrowSize: number;
  originOffset: number;
  dimensionLineExtension: number;
  extension: number;
  textHeight: number;
  textGap: number;
  textVertical: number;
  zeroSuppression: number;
  dimensionLineColor: number;
  extensionLineColor: number;
  textColor: number;
  decimalPlaces: number;
  angularDecimalPlaces: number;
  /** Picture/native text rotation policy for angular dimensions. */
  angularTextOrientation?: 'horizontal' | 'aligned';
  textStyle?: string;
  suppressOutsideDimensionLines?: boolean;
  forceDimensionLine?: boolean;
  toleranceDecimalPlaces?: number;
  angularZeroSuppression?: number;
}

export interface DxfSemanticLayers {
  contour: string;
  centerline: string;
  sectionHatch: string;
  text: string;
  dimension: string;
  omittedDimension: string;
  symbol: string;
}

export interface DxfExportProfile {
  cadConvention?: 'generic' | 'gb';
  codePage?: string;
  semanticLayers: DxfSemanticLayers;
  layers: readonly DxfLayerStyle[];
  lineTypes: readonly DxfLineType[];
  textStyles: readonly DxfTextStyle[];
  /** Canonical plain TEXT width; defaults to the selected text style. Does not affect MTEXT. */
  plainTextWidthFactor?: number;
  dimensionStyles: readonly DxfDimensionStyle[];
  /** Optional paper proportions for material-removal-required surface texture marks. */
  surfaceTexture?: {
    /** Short and full long arm rise, measured from the tip in multiples of text height. */
    shortRise: number;
    longRise: number;
    /** Interior angle between the two arms, in degrees. */
    includedAngle: number;
    /** Gap from the horizontal bar to the bottom of the text, in text heights. */
    textGap: number;
  };
}

export const DEFAULT_DXF_EXPORT_PROFILE: DxfExportProfile = {
  codePage: 'UTF-8',
  semanticLayers: {
    contour: 'GEOMETRY',
    centerline: 'CENTERLINE',
    sectionHatch: 'SECTION_HATCH',
    text: 'TEXT',
    dimension: 'DIMENSIONS',
    omittedDimension: 'DIMENSIONS_OMITTED',
    symbol: 'SYMBOLS',
  },
  layers: [
    { name: 'GEOMETRY', color: 7 },
    { name: 'CENTERLINE', color: 1, lineType: 'CENTER2' },
    { name: 'SECTION_HATCH', color: 2 },
    { name: 'TEXT', color: 7 },
    { name: 'DIMENSIONS', color: 4 },
    { name: 'DIMENSIONS_OMITTED', color: 4, lineType: 'DASHED2' },
    { name: 'SYMBOLS', color: 4 },
  ],
  lineTypes: [
    { name: 'Continuous', description: 'Solid line', pattern: [] },
    { name: 'CENTER2', description: 'Center line', pattern: [31.75, -6.35, 6.35, -6.35] },
    { name: 'DASHED2', description: 'Dashed line', pattern: [6.35, -3.175] },
  ],
  textStyles: [{ name: 'STANDARD', font: 'txt', height: 0, widthFactor: 1, lastHeight: 2.5 }],
  dimensionStyles: ['GB_LINEAR', 'GB_ANGULAR', 'GB_RADIAL'].map((name) => ({
    name,
    overallScale: 1,
    arrowSize: 2.5,
    originOffset: 0.625,
    dimensionLineExtension: 0,
    extension: 1.25,
    textHeight: 2.5,
    textGap: 0.625,
    textVertical: 1,
    zeroSuppression: 8,
    dimensionLineColor: 0,
    extensionLineColor: 0,
    textColor: 0,
    decimalPlaces: 2,
    angularDecimalPlaces: 2,
  })),
};
