// SPDX-License-Identifier: Apache-2.0

import type { DxfDimensionStyle, DxfExportProfile } from '@vectorai/drawing-core';

export const CAXA_TEXT_STYLE = 'PC_TEXTSTYLE';

export function encodeCaxaText(value: string): string {
  return `{\\Fisocp,GBCBIG;\\W0.707;${value}}`;
}

export function encodeCaxaGdtSymbol(characteristic: string): string {
  const code = {
    straightness: 'u', flatness: 'c', circularity: 'e', cylindricity: 'g',
    'profile-line': 'k', 'profile-surface': 'd', parallelism: 'f', perpendicularity: 'b', angularity: 'a',
    position: 'j', coaxiality: 'r', symmetry: 'i', 'circular-runout': 'h', 'total-runout': 't',
  }[characteristic];
  return `{\\Famgdt;${code ?? characteristic}}`;
}

export function caxaEncodedTextLength(value: string): number {
  if (value.startsWith('{\\Famgdt;')) return 1;
  return (value.match(/;([^;{}]*)}$/)?.[1] ?? value).length;
}

const standardDimensionStyle = (name: string, options: Partial<DxfDimensionStyle> = {}): DxfDimensionStyle => ({
  name,
  overallScale: 1,
  arrowSize: 3.5,
  originOffset: 0,
  dimensionLineExtension: 0,
  extension: 1,
  textHeight: 3.5,
  textGap: 1.5,
  textVertical: 1,
  zeroSuppression: 8,
  dimensionLineColor: 256,
  extensionLineColor: 0,
  textColor: 3,
  decimalPlaces: 2,
  angularDecimalPlaces: 0,
  textStyle: CAXA_TEXT_STYLE,
  suppressOutsideDimensionLines: true,
  forceDimensionLine: true,
  toleranceDecimalPlaces: 3,
  angularZeroSuppression: 2,
  ...options,
});

const GB_SEMANTIC_LAYERS = {
  contour: '1轮廓实线层',
  centerline: '3中心线层',
  sectionHatch: '5剖面线层',
  text: '6文字层',
  dimension: '7标注层',
  omittedDimension: '7标注缺省层',
  symbol: '8符号标注层',
} as const;

const GB_LINE_TYPES = [
  { name: 'Continuous', description: 'Solid line', pattern: [] },
  { name: 'CENTER2', description: 'Center (.5x)', pattern: [19.04999923706055, -3.174999952316282, 3.174999952316282, -3.174999952316282] },
  { name: 'DIMENSION_CLOSURE', description: 'Dense closure dimension', pattern: [2, -1] },
  { name: 'DASHED2', description: 'Dashed (.5x)', pattern: [6.349999904632567, -3.174999952316282] },
  { name: 'PHANTOM4', description: 'Phantom (.25x)', pattern: [7.9375, -1.587499976158141, 1.587499976158141, -1.587499976158141, 1.587499976158141, -1.587499976158141] },
  { name: '点画线', description: '点画线', pattern: [12, -2, 2, -2] },
  { name: '虚线', description: '虚线', pattern: [1, -1] },
] as const;

const GB_LAYERS = [
  { name: '0', color: 7, lineType: 'Continuous', lineWeight: 18 },
  { name: '中心线层', color: 1, lineType: '点画线', lineWeight: 18 },
  { name: '虚线层', color: 6, lineType: '虚线', lineWeight: 18 },
  { name: '细实线层', color: 7, lineType: 'Continuous', lineWeight: 18 },
  { name: '粗实线层', color: 7, lineType: 'Continuous', lineWeight: 35 },
  { name: '尺寸线层', color: 3, lineType: 'Continuous', lineWeight: 18 },
  { name: '剖面线层', color: 4, lineType: 'Continuous', lineWeight: 18 },
  { name: '隐藏层', color: 7, lineType: 'Continuous', lineWeight: 18 },
  { name: 'FORMAT', color: 7, lineType: 'Continuous', lineWeight: 18 },
  { name: '1轮廓实线层', color: 7, lineType: 'Continuous', lineWeight: 18 },
  { name: '2细线层', color: 4, lineType: 'Continuous', lineWeight: 18 },
  { name: '3中心线层', color: 1, lineType: 'CENTER2', lineWeight: 18 },
  { name: '4虚线层', color: 6, lineType: 'DASHED2', lineWeight: 18 },
  { name: '5剖面线层', color: 2, lineType: 'Continuous', lineWeight: 18 },
  { name: '6文字层', color: 3, lineType: 'Continuous', lineWeight: 18 },
  { name: '7标注层', color: 4, lineType: 'Continuous', lineWeight: 18 },
  { name: '7标注缺省层', color: 4, lineType: 'DIMENSION_CLOSURE', lineWeight: 18 },
  { name: '8符号标注层', color: 31, lineType: 'Continuous', lineWeight: 18 },
  { name: '9双点划线层', color: 6, lineType: 'PHANTOM4', lineWeight: 18 },
] as const;

const gbDimensionStyles = (textStyle: string): DxfDimensionStyle[] => [
  standardDimensionStyle('GB_DIMSTYLE', { textStyle }),
  standardDimensionStyle('GB_LINEAR', { textStyle }),
  standardDimensionStyle('GB_DIAMETER', { textStyle }),
  standardDimensionStyle('GB_RADIAL', { textStyle, angularDecimalPlaces: 0 }),
  standardDimensionStyle('GB_LEADER', { textStyle }),
  standardDimensionStyle('GB_ORDINATE', { textStyle }),
  standardDimensionStyle('GB_ANGULAR', { textStyle, angularDecimalPlaces: 0, angularTextOrientation: 'horizontal' }),
  standardDimensionStyle('GB_BALLOON', { textStyle }),
];

/** Reusable GB engineering-drawing appearance; contains no vendor text encoding. */
export const GB_ENGINEERING_DXF_PROFILE: DxfExportProfile = {
  cadConvention: 'gb',
  codePage: 'UTF-8',
  semanticLayers: GB_SEMANTIC_LAYERS,
  lineTypes: GB_LINE_TYPES,
  layers: GB_LAYERS,
  textStyles: [{ name: 'STANDARD', font: 'txt.shx', height: 0, widthFactor: 1, lastHeight: 3.5 }],
  dimensionStyles: gbDimensionStyles('STANDARD'),
};

/**
 * Compatibility adapter for the CAXA/AutoCAD symbol tables used by the
 * supplied reference drawing. These vendor names are intentionally isolated
 * from semantic annotation and are never the core export default.
 */
export const CAXA_COMPATIBLE_DXF_PROFILE: DxfExportProfile = {
  cadConvention: 'gb',
  plainTextWidthFactor: 0.667,
  // Reference CAXA paper proportions; these are a compatibility style,
  // not a claim that a particular national standard mandates these ratios.
  surfaceTexture: { shortRise: 10 / 7, longRise: 22 / 7, includedAngle: 60, textGap: 0.3 },
  // Browser downloads are UTF-8 byte streams. Declaring ANSI_936 here would
  // make every Chinese symbol-table name
  // mojibake unless the entire download path also emitted GBK bytes.
  codePage: 'UTF-8',
  semanticLayers: GB_SEMANTIC_LAYERS,
  lineTypes: GB_LINE_TYPES,
  layers: [
    ...GB_LAYERS,
    { name: '轮廓虚线层', color: 7, lineType: 'DASHED2', lineWeight: 18 },
    { name: '图框层', color: 7, lineType: 'Continuous', lineWeight: 18 },
    { name: '排图层', color: 5, lineType: 'Continuous', lineWeight: 18 },
    { name: '消隐层', color: 5, lineType: 'Continuous', lineWeight: 18 },
    { name: '用户自定义1', color: 7, lineType: 'Continuous', lineWeight: 18 },
    { name: '用户自定义2', color: 7, lineType: 'Continuous', lineWeight: 18 },
    { name: '用户自定义3', color: 7, lineType: 'Continuous', lineWeight: 18 },
    { name: '1粗实线层', color: 1, lineType: 'Continuous', lineWeight: 18 },
    { name: 'HACH', color: 7, lineType: 'Continuous', lineWeight: 18 },
    { name: '10', color: 7, lineType: 'Continuous', lineWeight: 18 },
  ],
  textStyles: [
    { name: 'Standard', font: 'txt.shx', bigFont: 'gbcbig.shx', height: 0, widthFactor: 1, lastHeight: 3.5 },
    { name: '标准', font: '', height: 0, widthFactor: 0.667, lastHeight: 3.5 },
    { name: 'SLDTEXTSTYLE0', font: 'txt.shx', bigFont: 'gbcbig.shx', height: 0, widthFactor: 0.75, lastHeight: 3.5 },
    { name: 'SLDTEXTSTYLE1', font: 'txt.shx', bigFont: 'gbcbig.shx', height: 0, widthFactor: 0.6864493305940874, lastHeight: 3.5 },
    { name: 'SLDTEXTSTYLE2', font: 'txt.shx', bigFont: 'gbcbig.shx', height: 0, widthFactor: 0.6875, lastHeight: 3.5 },
    { name: 'SLDTEXTSTYLE3', font: 'txt.shx', bigFont: 'bigfont.shx', height: 0, widthFactor: 0.75, lastHeight: 3.5 },
    { name: 'PC_TEXTSTYLE', font: 'isocp.shx', bigFont: 'gbcbig.shx', height: 0, widthFactor: 0.707, lastHeight: 3.5 },
    { name: 'PC_TEXTSTYLE2', font: 'isocp.shx', bigFont: 'gbcbig.shx', height: 0, widthFactor: 0.707, lastHeight: 3.5 },
    { name: 'PC_TEXTSTYLE3', font: 'isocp.shx', bigFont: 'gbcbig.shx', height: 0, widthFactor: 0.707, lastHeight: 3.5 },
    { name: 'PC_TEXTSTYLE4', font: 'isocp.shx', bigFont: 'gbcbig.shx', height: 0, widthFactor: 0.707, lastHeight: 3.5 },
    { name: 'PC_TEXTSTYLE5', font: 'isocp.shx', bigFont: 'gbcbig.shx', height: 0, widthFactor: 0.707, lastHeight: 3.5 },
    { name: 'ZWISOGDT', font: 'isocp.shx', bigFont: 'gbcbig.shx', height: 0, widthFactor: 1, lastHeight: 3.5 },
    { name: 'XW', font: 'xw.shx', bigFont: 'hztxt0.shx', height: 0, widthFactor: 0.8, lastHeight: 3.5 },
    { name: 'HZ0', font: 'sh.shx', bigFont: 'hztxt0.shx', height: 0, widthFactor: 0.75, lastHeight: 3.5 },
  ],
  dimensionStyles: gbDimensionStyles(CAXA_TEXT_STYLE),
};
