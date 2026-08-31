// SPDX-License-Identifier: Apache-2.0

import type {
  AnnotationNode,
  DrawingDocument,
  GeometryNode,
  Vec2,
} from '../document';
import {
  DEFAULT_DXF_EXPORT_PROFILE,
  type DxfDimensionStyle,
  type DxfExportProfile,
  type DxfLayerStyle,
  type DxfTextStyle,
} from './dxf-profile';

export type DxfExportLayer = DxfLayerStyle;

export type DxfBlockGraphic =
  | { type: 'line'; layer: string; color?: number; start: Vec2; end: Vec2 }
  | { type: 'arc'; layer: string; color?: number; center: Vec2; radius: number; startAngle: number; endAngle: number }
  | { type: 'polyline'; layer: string; color?: number; points: readonly Vec2[]; closed?: boolean }
  | { type: 'text'; layer: string; color?: number; position: Vec2; content: string; height: number; rotation?: number; alignment?: 'left' | 'center' | 'right' }
  | { type: 'mtext'; layer: string; color?: number; position: Vec2; content: string; height: number; rotation?: number; style?: string; alignment?: number }
  | { type: 'solid-hatch'; layer: string; color?: number; boundary: readonly Vec2[] };

export type DxfExportEntity = DxfBlockGraphic
  | {
    type: 'dimension'; layer: string; dimensionKind: 'linear' | 'angular' | 'diameter' | 'radius';
    definitionPoints: readonly Vec2[]; textPosition: Vec2; text: string; measurement: number;
    style?: 'GB_LINEAR' | 'GB_ANGULAR' | 'GB_RADIAL'; picture: readonly DxfBlockGraphic[];
  }
  | { type: 'block-reference'; layer: string; picture: readonly DxfBlockGraphic[] };

export interface DxfExportOptions {
  layers?: readonly DxfExportLayer[];
  entities?: readonly DxfExportEntity[];
  profile?: DxfExportProfile;
}

interface PreparedDimension {
  entity: Extract<DxfExportEntity, { type: 'dimension' }>;
  blockName: string;
}

interface PreparedBlockReference {
  entity: Extract<DxfExportEntity, { type: 'block-reference' }>;
  blockName: string;
}

/** Export the visible canonical drawing as an AutoCAD 2013 UTF-8 ASCII DXF document. */
export function exportDrawingDxf(document: DrawingDocument, options: DxfExportOptions = {}): string {
  const profile = options.profile ?? DEFAULT_DXF_EXPORT_PROFILE;
  const nativeDimensions: PreparedDimension[] = [];
  let nextDimensionBlock = 1;
  for (const node of document.annotations) {
    if (!node.visible || node.type !== 'dimension') continue;
    nativeDimensions.push({ entity: canonicalDimensionEntity(node, profile), blockName: `*D${nextDimensionBlock++}` });
  }
  for (const value of options.entities ?? []) {
    if (value.type === 'dimension') nativeDimensions.push({ entity: value, blockName: `*D${nextDimensionBlock++}` });
  }
  const blockReferences = (options.entities ?? [])
    .filter((value): value is Extract<DxfExportEntity, { type: 'block-reference' }> => value.type === 'block-reference')
    .map((entity, index): PreparedBlockReference => ({ entity, blockName: `*VAI${index + 1}` }));
  const blockNames = [...nativeDimensions.map((value) => value.blockName), ...blockReferences.map((value) => value.blockName)];
  const blockRecordHandles = new Map(
    ['*Model_Space', '*Paper_Space', ...blockNames].map((name, index) => [name, (0x40 + index).toString(16).toUpperCase()]),
  );
  const writer = new DxfWriter();
  writer.section('HEADER', () => {
    writer.pair(9, '$ACADVER');
    writer.pair(1, 'AC1027');
    writer.pair(9, '$DWGCODEPAGE');
    writer.pair(3, profile.codePage ?? 'UTF-8');
    writer.pair(9, '$INSUNITS');
    writer.pair(70, insertionUnit(document.unitSystem.length));
  });
  writer.section('TABLES', () => {
    writeLineTypeTable(writer, profile.lineTypes);
    writer.pair(0, 'TABLE');
    writer.pair(2, 'LAYER');
    writer.pair(5, '11');
    writer.pair(330, '0');
    writer.pair(100, 'AcDbSymbolTable');
    const layers = uniqueLayers([
      ...document.geometry.filter((node) => node.visible).map((node) => standardLayer(geometryLayer(node, profile))),
      ...document.annotations.filter((node) => node.visible).map((node) => standardLayer(annotationLayer(node, profile))),
      ...(options.entities ?? []).map((entity) => standardLayer(entity.layer)),
      ...profile.layers,
      ...(options.layers ?? []),
    ]);
    writer.pair(70, layers.length);
    layers.forEach((layer, index) => writeLayer(writer, layer, (0x20 + index).toString(16).toUpperCase()));
    writer.pair(0, 'ENDTAB');
    const textStyleHandles = writeStyleTable(writer, profile.textStyles);
    writeDimensionStyleTable(writer, profile.dimensionStyles, textStyleHandles);
    writeBlockRecordTable(writer, blockRecordHandles);
  });
  writer.section('BLOCKS', () => {
    writeEmptyLayoutBlock(writer, '*Model_Space', blockRecordHandles.get('*Model_Space')!);
    writeEmptyLayoutBlock(writer, '*Paper_Space', blockRecordHandles.get('*Paper_Space')!);
    for (const value of nativeDimensions) writePictureBlock(writer, value.blockName, value.entity.layer, value.entity.picture, false, blockRecordHandles.get(value.blockName)!);
    for (const value of blockReferences) writePictureBlock(writer, value.blockName, value.entity.layer, value.entity.picture, true, blockRecordHandles.get(value.blockName)!);
  });
  writer.section('ENTITIES', () => {
    writer.withOwner(blockRecordHandles.get('*Model_Space')!, () => {
    for (const node of document.geometry) {
      if (node.visible) writeGeometry(writer, node, geometryLayer(node, profile));
    }
    for (const node of document.annotations) {
      if (node.visible && node.type !== 'dimension') writeAnnotation(writer, node, profile);
    }
    for (const extra of options.entities ?? []) {
      if (extra.type !== 'dimension' && extra.type !== 'block-reference') writeExtraEntity(writer, extra);
    }
    for (const value of nativeDimensions) writeNativeDimension(writer, value);
    for (const value of blockReferences) writeBlockReference(writer, value);
    });
  });
  writer.pair(0, 'EOF');
  return writer.toString();
}

function uniqueLayers(layers: readonly DxfExportLayer[]): DxfExportLayer[] {
  return [...new Map(layers.map((layer) => [layer.name, layer])).values()];
}

function geometryLayer(node: GeometryNode, profile: DxfExportProfile): string {
  const sourceLayer = node.sourceRef?.layer?.trim();
  return !sourceLayer || sourceLayer.toUpperCase() === 'GEOMETRY' ? profile.semanticLayers.contour : sourceLayer;
}

function annotationLayer(node: AnnotationNode, profile: DxfExportProfile): string {
  const sourceLayer = node.sourceRef?.layer?.trim();
  if (sourceLayer && !['ANNOTATIONS', 'ANNOTATION'].includes(sourceLayer.toUpperCase())) return sourceLayer;
  if (node.type === 'section-hatch') return profile.semanticLayers.sectionHatch;
  if (node.type === 'centerline') return profile.semanticLayers.centerline;
  if (node.type === 'text') return profile.semanticLayers.text;
  return profile.semanticLayers.dimension;
}

function standardLayer(name: string): DxfExportLayer {
  if (name === '0') return { name, color: 7 };
  if (name.includes('中心线')) return { name, color: 1, lineType: 'CENTER2' };
  if (name.includes('虚线') || name.includes('缺省')) return { name, color: 6, lineType: 'DASHED2' };
  if (name.includes('剖面线')) return { name, color: 2 };
  if (name.includes('文字')) return { name, color: 3 };
  if (name.includes('符号标注')) return { name, color: 31 };
  if (name.includes('标注')) return { name, color: 4 };
  return { name, color: 7 };
}

function writeExtraEntity(writer: DxfWriter, value: DxfExportEntity): void {
  switch (value.type) {
    case 'line':
      writeLine(writer, value.start, value.end, value.layer);
      return;
    case 'polyline':
      writePolyline(writer, value.points, value.closed ?? false, value.layer);
      return;
    case 'text':
      writeText(writer, value.position, value.content, value.height, value.rotation ?? 0, value.alignment ?? 'center', 'middle', value.layer);
      return;
    case 'dimension':
    case 'block-reference':
      return;
  }
}

class DxfWriter {
  readonly #lines: string[] = [];
  #nextHandle = 0x1000;
  #owner: string | undefined;

  pair(code: number, value: string | number): void {
    this.#lines.push(String(code), typeof value === 'number' ? formatNumber(value) : value);
  }

  handle(): void {
    this.pair(5, (this.#nextHandle++).toString(16).toUpperCase());
    if (this.#owner !== undefined) this.pair(330, this.#owner);
  }

  withOwner(owner: string, write: () => void): void {
    const previous = this.#owner;
    this.#owner = owner;
    try { write(); } finally { this.#owner = previous; }
  }

  section(name: string, write: () => void): void {
    this.pair(0, 'SECTION');
    this.pair(2, name);
    write();
    this.pair(0, 'ENDSEC');
  }

  toString(): string {
    return `${this.#lines.join('\r\n')}\r\n`;
  }
}

function writeLayer(writer: DxfWriter, layer: DxfExportLayer, handle: string): void {
  writer.pair(0, 'LAYER');
  writer.pair(5, handle);
  writer.pair(330, '11');
  writer.pair(100, 'AcDbSymbolTableRecord');
  writer.pair(100, 'AcDbLayerTableRecord');
  writer.pair(2, layer.name);
  writer.pair(70, 0);
  writer.pair(62, layer.color);
  writer.pair(6, layer.lineType ?? 'Continuous');
  writer.pair(370, layer.lineWeight ?? 18);
}

function writeLineTypeTable(writer: DxfWriter, lineTypes: DxfExportProfile['lineTypes']): void {
  writer.pair(0, 'TABLE');
  writer.pair(2, 'LTYPE');
  writer.pair(5, '10');
  writer.pair(330, '0');
  writer.pair(100, 'AcDbSymbolTable');
  writer.pair(70, lineTypes.length);
  lineTypes.forEach((lineType) => writePatternLineType(writer, lineType.name, lineType.description, lineType.pattern));
  writer.pair(0, 'ENDTAB');
}

function writePatternLineType(writer: DxfWriter, name: string, description: string, pattern: readonly number[]): void {
  writer.pair(0, 'LTYPE');
  writer.handle();
  writer.pair(330, '10');
  writer.pair(100, 'AcDbSymbolTableRecord');
  writer.pair(100, 'AcDbLinetypeTableRecord');
  writer.pair(2, name);
  writer.pair(70, 0);
  writer.pair(3, description);
  writer.pair(72, 65);
  writer.pair(73, pattern.length);
  writer.pair(40, pattern.reduce((total, item) => total + Math.abs(item), 0));
  pattern.forEach((item) => writer.pair(49, item));
}

function writeStyleTable(writer: DxfWriter, styles: readonly DxfTextStyle[]): ReadonlyMap<string, string> {
  const handles = new Map(styles.map((style, index) => [style.name, (0x160 + index).toString(16).toUpperCase()]));
  writer.pair(0, 'TABLE');
  writer.pair(2, 'STYLE');
  writer.pair(5, '12');
  writer.pair(330, '0');
  writer.pair(100, 'AcDbSymbolTable');
  writer.pair(70, styles.length);
  styles.forEach((style, index) => {
    writer.pair(0, 'STYLE');
    writer.pair(5, handles.get(style.name)!);
    writer.pair(330, '12');
    writer.pair(100, 'AcDbSymbolTableRecord');
    writer.pair(100, 'AcDbTextStyleTableRecord');
    writer.pair(2, style.name);
    writer.pair(70, 0);
    writer.pair(40, style.height);
    writer.pair(41, style.widthFactor);
    writer.pair(50, style.obliqueAngle ?? 0);
    writer.pair(71, style.generationFlags ?? 0);
    writer.pair(42, style.lastHeight ?? 3.5);
    writer.pair(3, style.font);
    writer.pair(4, style.bigFont ?? '');
  });
  writer.pair(0, 'ENDTAB');
  return handles;
}

function writeDimensionStyleTable(
  writer: DxfWriter,
  styles: readonly DxfDimensionStyle[],
  textStyleHandles: ReadonlyMap<string, string>,
): void {
  writer.pair(0, 'TABLE');
  writer.pair(2, 'DIMSTYLE');
  writer.pair(5, '13');
  writer.pair(330, '0');
  writer.pair(100, 'AcDbSymbolTable');
  writer.pair(70, styles.length);
  for (const [index, style] of styles.entries()) {
    writer.pair(0, 'DIMSTYLE');
    writer.pair(105, (0xA1 + index).toString(16).toUpperCase());
    writer.pair(330, '13');
    writer.pair(100, 'AcDbSymbolTableRecord');
    writer.pair(100, 'AcDbDimStyleTableRecord');
    writer.pair(2, style.name);
    writer.pair(70, 0);
    writer.pair(3, '');
    writer.pair(4, '');
    writer.pair(5, '');
    writer.pair(6, '');
    writer.pair(7, '');
    writer.pair(40, style.overallScale);
    writer.pair(41, style.arrowSize);
    writer.pair(42, style.originOffset);
    writer.pair(43, 10);
    writer.pair(44, style.extension);
    writer.pair(45, 0);
    writer.pair(46, 7);
    writer.pair(47, 0);
    writer.pair(48, 0);
    writer.pair(49, 2.5);
    writer.pair(140, style.textHeight);
    writer.pair(141, 0);
    writer.pair(142, 0);
    writer.pair(143, 0.04);
    writer.pair(144, 1);
    writer.pair(145, 0);
    writer.pair(146, 0.71);
    writer.pair(147, style.textGap);
    writer.pair(148, 0);
    writer.pair(77, style.textVertical);
    writer.pair(78, style.zeroSuppression);
    writer.pair(79, style.angularZeroSuppression ?? 0);
    writer.pair(172, style.forceDimensionLine ? 1 : 0);
    writer.pair(175, style.suppressOutsideDimensionLines ? 1 : 0);
    writer.pair(176, style.dimensionLineColor);
    writer.pair(177, style.extensionLineColor);
    writer.pair(178, style.textColor);
    writer.pair(271, style.decimalPlaces);
    writer.pair(272, style.toleranceDecimalPlaces ?? style.decimalPlaces);
    writer.pair(275, style.angularDecimalPlaces);
    const textStyleHandle = style.textStyle ? textStyleHandles.get(style.textStyle) : undefined;
    if (textStyleHandle) writer.pair(340, textStyleHandle);
  }
  writer.pair(0, 'ENDTAB');
}

function writeBlockRecordTable(writer: DxfWriter, handles: ReadonlyMap<string, string>): void {
  writer.pair(0, 'TABLE');
  writer.pair(2, 'BLOCK_RECORD');
  writer.pair(5, '14');
  writer.pair(330, '0');
  writer.pair(100, 'AcDbSymbolTable');
  writer.pair(70, handles.size);
  handles.forEach((handle, name) => {
    writer.pair(0, 'BLOCK_RECORD');
    writer.pair(5, handle);
    writer.pair(330, '14');
    writer.pair(100, 'AcDbSymbolTableRecord');
    writer.pair(100, 'AcDbBlockTableRecord');
    writer.pair(2, name);
    writer.pair(70, 0);
  });
  writer.pair(0, 'ENDTAB');
}

function writeEmptyLayoutBlock(writer: DxfWriter, name: string, owner: string): void {
  writer.withOwner(owner, () => {
    writeBlockStart(writer, name, '0');
    writeBlockEnd(writer, '0');
  });
}

function writePictureBlock(
  writer: DxfWriter,
  name: string,
  layer: string,
  graphics: readonly DxfBlockGraphic[],
  multilineText: boolean,
  owner: string,
): void {
  writer.withOwner(owner, () => {
    writeBlockStart(writer, name, layer);
    graphics.forEach((graphic) => writeBlockGraphic(writer, graphic, multilineText));
    writeBlockEnd(writer, layer);
  });
}

function writeBlockStart(writer: DxfWriter, name: string, layer: string): void {
  writer.pair(0, 'BLOCK');
  writer.handle();
  writer.pair(100, 'AcDbEntity');
  writer.pair(8, layer);
  writer.pair(100, 'AcDbBlockBegin');
  writer.pair(2, name);
  writer.pair(70, name.startsWith('*') ? 1 : 0);
  point(writer, 10, [0, 0]);
  writer.pair(3, name);
  writer.pair(1, '');
}

function writeBlockEnd(writer: DxfWriter, layer: string): void {
  writer.pair(0, 'ENDBLK');
  writer.handle();
  writer.pair(100, 'AcDbEntity');
  writer.pair(8, layer);
  writer.pair(100, 'AcDbBlockEnd');
}

function writeBlockGraphic(writer: DxfWriter, value: DxfBlockGraphic, multilineText: boolean): void {
  if (value.type === 'line') writeLine(writer, value.start, value.end, value.layer, undefined, value.color);
  else if (value.type === 'arc') writeArc(writer, value.center, value.radius, value.startAngle, value.endAngle, value.layer, value.color);
  else if (value.type === 'polyline') writePolyline(writer, value.points, value.closed ?? false, value.layer, value.color);
  else if (value.type === 'mtext') writeMText(writer, value.position, value.content, value.height, value.rotation ?? 0, value.layer, value.style, value.alignment, value.color);
  else if (value.type === 'solid-hatch') writeSolidHatch(writer, value.boundary, value.layer, value.color);
  else if (multilineText) writeMText(writer, value.position, value.content, value.height, value.rotation ?? 0, value.layer, undefined, undefined, value.color);
  else writeText(writer, value.position, value.content, value.height, value.rotation ?? 0, value.alignment ?? 'center', 'middle', value.layer, value.color);
}

function canonicalDimensionEntity(
  node: Extract<AnnotationNode, { type: 'dimension' }>,
  profile: DxfExportProfile,
): Extract<DxfExportEntity, { type: 'dimension' }> {
  const genericLabel = dimensionLabel(node);
  const label = profile.cadConvention === 'gb' ? gbDimensionPictureText(node, genericLabel) : genericLabel;
  const points = node.definitionPoints;
  const measurement = node.observedValue ?? node.computedValue ?? dimensionMeasurement(node.dimensionKind, points);
  const kind: Extract<DxfExportEntity, { type: 'dimension' }>['dimensionKind'] =
    node.dimensionKind === 'angular' ? 'angular'
      : node.dimensionKind === 'radius' ? 'radius'
        : 'linear';
  const style = kind === 'angular' ? 'GB_ANGULAR' : kind === 'radius' ? 'GB_RADIAL' : 'GB_LINEAR';
  const dimensionStyle = profile.dimensionStyles.find(({ name }) => name === style);
  const textHeight = dimensionStyle?.textHeight ?? annotationTextHeight(node);
  const arrowSize = dimensionStyle?.arrowSize ?? textHeight;
  return {
    type: 'dimension',
    layer: annotationLayer(node, profile),
    dimensionKind: kind,
    definitionPoints: points,
    textPosition: node.textPosition,
    text: profile.cadConvention === 'gb' ? gbDimensionOverride(node) : dimensionOverride(node, label),
    measurement,
    style,
    picture: canonicalDimensionPicture(
      node, annotationLayer(node, profile), label, textHeight, arrowSize, dimensionStyle?.textStyle,
      profile.cadConvention === 'gb' ? 3 : undefined,
    ),
  };
}

function writeNativeDimension(writer: DxfWriter, value: PreparedDimension): void {
  const item = value.entity;
  const points = item.definitionPoints;
  const first = points[0] ?? [0, 0];
  const second = points[1] ?? first;
  const definition = item.dimensionKind === 'angular'
    ? angularDimensionDefinitionPoint(points, item.measurement, item.textPosition)
    : points.at(-1) ?? item.textPosition;
  writer.pair(0, 'DIMENSION');
  writer.handle();
  writer.pair(100, 'AcDbEntity');
  writer.pair(8, item.layer);
  writer.pair(100, 'AcDbDimension');
  writer.pair(2, value.blockName);
  point(writer, 10, definition);
  point(writer, 11, item.textPosition);
  writer.pair(70, 32 + 128 + dimensionType(item.dimensionKind));
  writer.pair(42, item.measurement);
  writer.pair(1, dxfText(item.text));
  writer.pair(3, item.style ?? defaultDimensionStyle(item.dimensionKind));
  if (item.dimensionKind === 'angular') {
    writer.pair(100, 'AcDb2LineAngularDimension');
    point(writer, 13, first);
    point(writer, 14, second);
    point(writer, 15, first);
    point(writer, 16, points[2] ?? second);
  } else if (item.dimensionKind === 'radius') {
    writer.pair(100, 'AcDbRadialDimension');
    point(writer, 15, first);
    writer.pair(40, item.measurement);
  } else if (item.dimensionKind === 'diameter') {
    writer.pair(100, 'AcDbDiametricDimension');
    point(writer, 15, second);
    writer.pair(40, 0);
  } else {
    writer.pair(100, 'AcDbAlignedDimension');
    point(writer, 13, first);
    point(writer, 14, second);
    writer.pair(100, 'AcDbRotatedDimension');
    writer.pair(50, Math.atan2(second[1] - first[1], second[0] - first[0]) * 180 / Math.PI);
  }
}

function canonicalDimensionPicture(
  node: Extract<AnnotationNode, { type: 'dimension' }>,
  layer: string,
  label: string,
  textHeight: number,
  arrowSize: number,
  textStyle?: string,
  textColor?: number,
): DxfBlockGraphic[] {
  const text: DxfBlockGraphic = {
    type: 'mtext', layer, position: node.textPosition,
    content: cadPictureText(label), height: textHeight, style: textStyle, alignment: 5, color: textColor,
  };
  if (node.dimensionKind === 'angular' && node.definitionPoints.length >= 5) {
    const vertex = node.definitionPoints[0]!;
    const firstExtension = node.definitionPoints[1]!;
    const secondExtension = node.definitionPoints[2]!;
    const firstArcPoint = node.definitionPoints[3]!;
    const secondArcPoint = node.definitionPoints[4]!;
    const requestedSweep = Math.abs(node.computedValue ?? node.observedValue ?? 0);
    const { start: arcStart, end: arcEnd } = orderedAngularArc(vertex, firstArcPoint, secondArcPoint, requestedSweep);
    const radius = (Math.hypot(arcStart[0] - vertex[0], arcStart[1] - vertex[1])
      + Math.hypot(arcEnd[0] - vertex[0], arcEnd[1] - vertex[1])) / 2;
    const startTangent = normalizedVector([-(arcStart[1] - vertex[1]), arcStart[0] - vertex[0]]);
    const endTangent = normalizedVector([arcEnd[1] - vertex[1], -(arcEnd[0] - vertex[0])]);
    return [
      { type: 'line', layer, start: vertex, end: firstExtension },
      { type: 'line', layer, start: vertex, end: secondExtension },
      {
        type: 'arc', layer, center: vertex, radius,
        startAngle: pointAngleDegrees(vertex, arcStart),
        endAngle: pointAngleDegrees(vertex, arcEnd),
      },
      arrowHatch(layer, arcStart, startTangent, arrowSize),
      arrowHatch(layer, arcEnd, endTangent, arrowSize),
      text,
    ];
  }
  if (node.dimensionKind === 'diameter' && node.definitionPoints.length >= 2) {
    const [first, second, sourceFirst = first, sourceSecond = second] = node.definitionPoints;
    const direction = normalizedVector([second[0] - first[0], second[1] - first[1]]);
    return [
      { type: 'line', layer, start: sourceFirst, end: first },
      { type: 'line', layer, start: sourceSecond, end: second },
      { type: 'line', layer, start: first, end: second },
      arrowHatch(layer, first, direction, arrowSize),
      arrowHatch(layer, second, [-direction[0], -direction[1]], arrowSize),
      text,
    ];
  }
  if (node.dimensionKind === 'radius' && node.definitionPoints.length >= 2) {
    const center = node.definitionPoints[0]!;
    const edge = node.definitionPoints[1]!;
    const direction = normalizedVector([center[0] - edge[0], center[1] - edge[1]]);
    return [
      { type: 'line', layer, start: edge, end: node.textPosition },
      arrowHatch(layer, edge, direction, arrowSize),
      text,
    ];
  }
  if (node.definitionPoints.length >= 2) {
    const first = node.definitionPoints[0]!;
    const second = node.definitionPoints[1]!;
    const direction = normalizedVector([second[0] - first[0], second[1] - first[1]]);
    return [
      { type: 'line', layer, start: first, end: second },
      arrowHatch(layer, first, direction, arrowSize),
      arrowHatch(layer, second, [-direction[0], -direction[1]], arrowSize),
      text,
    ];
  }
  return [
    { type: 'polyline', layer, points: node.definitionPoints, closed: false },
    text,
  ];
}

function pointAngleDegrees(center: Vec2, point: Vec2): number {
  return Math.atan2(point[1] - center[1], point[0] - center[0]) * 180 / Math.PI;
}

function positiveDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function orderedAngularArc(
  vertex: Vec2,
  first: Vec2,
  second: Vec2,
  requestedSweep: number,
): { start: Vec2; end: Vec2 } {
  const firstAngle = pointAngleDegrees(vertex, first);
  const secondAngle = pointAngleDegrees(vertex, second);
  const forwardSweep = positiveDegrees(secondAngle - firstAngle);
  const reverseSweep = positiveDegrees(firstAngle - secondAngle);
  const reverse = requestedSweep > 0
    && Math.abs(reverseSweep - requestedSweep) < Math.abs(forwardSweep - requestedSweep);
  return reverse ? { start: second, end: first } : { start: first, end: second };
}

function angularDimensionDefinitionPoint(
  points: readonly Vec2[],
  requestedSweep: number,
  fallback: Vec2,
): Vec2 {
  const vertex = points[0];
  const firstArcPoint = points[3];
  const secondArcPoint = points[4];
  if (!vertex || !firstArcPoint || !secondArcPoint) return fallback;
  const { start, end } = orderedAngularArc(vertex, firstArcPoint, secondArcPoint, Math.abs(requestedSweep));
  const startAngle = pointAngleDegrees(vertex, start);
  const sweep = positiveDegrees(pointAngleDegrees(vertex, end) - startAngle);
  const radius = (Math.hypot(start[0] - vertex[0], start[1] - vertex[1])
    + Math.hypot(end[0] - vertex[0], end[1] - vertex[1])) / 2;
  const angle = (startAngle + sweep / 2) * Math.PI / 180;
  return [vertex[0] + Math.cos(angle) * radius, vertex[1] + Math.sin(angle) * radius];
}

function arrowHatch(layer: string, tip: Vec2, direction: Vec2, size: number): DxfBlockGraphic {
  const normal: Vec2 = [-direction[1], direction[0]];
  const base = [tip[0] + direction[0] * size, tip[1] + direction[1] * size] as Vec2;
  const halfWidth = size / 6;
  return {
    type: 'solid-hatch', layer,
    boundary: [
      tip,
      [base[0] + normal[0] * halfWidth, base[1] + normal[1] * halfWidth],
      [base[0] - normal[0] * halfWidth, base[1] - normal[1] * halfWidth],
    ],
  };
}

function normalizedVector(value: Vec2): Vec2 {
  const length = Math.hypot(value[0], value[1]) || 1;
  return [value[0] / length, value[1] / length];
}

function cadPictureText(value: string): string {
  return value.replace(/⌀/g, '%%C');
}

function dimensionOverride(node: Extract<AnnotationNode, { type: 'dimension' }>, label: string): string {
  const hasTolerance = toleranceLabel(node) !== undefined;
  if (node.dimensionKind === 'diameter') return hasTolerance ? cadPictureText(label) : '%%C<>';
  return hasTolerance ? cadPictureText(label) : '';
}

function gbDimensionOverride(node: Extract<AnnotationNode, { type: 'dimension' }>): string {
  const placeholder = node.dimensionKind === 'diameter' ? '%%C<>' : '<>';
  const projection = node.toleranceProjection;
  if (projection && (projection.status === 'resolved' || projection.status === 'confirmed')) {
    if ((projection.mode === 'bilateral' || projection.mode === 'unilateral')
      && (finite(projection.upperDeviation) || finite(projection.lowerDeviation))) {
      const upper = signed(projection.upperDeviation ?? 0);
      const lower = signed(projection.lowerDeviation ?? 0);
      return `\\A1;${placeholder}{\\C2;{\\H0.71x;\\S${upper}^${lower};}}`;
    }
    if (projection.mode === 'limits' && finite(projection.upperLimit) && finite(projection.lowerLimit)) {
      return `\\A1;${placeholder}{\\C2;{\\H0.71x;\\S${textNumber(projection.upperLimit)}^${textNumber(projection.lowerLimit)};}}`;
    }
    if (projection.mode === 'fit' && projection.fitDesignation?.trim()) {
      return `${placeholder}{\\C3;${projection.fitDesignation.trim()}}`;
    }
  }
  const legacy = node.tolerance;
  if (legacy && (finite(legacy.upper) || finite(legacy.lower))) {
    return `\\A1;${placeholder}{\\C2;{\\H0.71x;\\S${signed(legacy.upper ?? 0)}^${signed(legacy.lower ?? 0)};}}`;
  }
  return node.dimensionKind === 'diameter' ? '%%C<>' : '';
}

function gbDimensionPictureText(
  node: Extract<AnnotationNode, { type: 'dimension' }>,
  genericLabel: string,
): string {
  const override = gbDimensionOverride(node);
  if (!override) return genericLabel;
  const numericLabel = baseDimensionLabel(node).replace(/^(?:⌀|%%C)/, '');
  return override.replace('<>', numericLabel);
}

function writeBlockReference(writer: DxfWriter, value: PreparedBlockReference): void {
  writer.pair(0, 'INSERT');
  writer.handle();
  writer.pair(100, 'AcDbEntity');
  writer.pair(8, value.entity.layer);
  writer.pair(100, 'AcDbBlockReference');
  writer.pair(2, value.blockName);
  point(writer, 10, [0, 0]);
}

function dimensionType(kind: Extract<DxfExportEntity, { type: 'dimension' }>['dimensionKind']): number {
  return kind === 'angular' ? 2 : kind === 'diameter' ? 3 : kind === 'radius' ? 4 : 0;
}

function defaultDimensionStyle(kind: Extract<DxfExportEntity, { type: 'dimension' }>['dimensionKind']): 'GB_LINEAR' | 'GB_ANGULAR' | 'GB_RADIAL' {
  return kind === 'angular' ? 'GB_ANGULAR' : kind === 'radius' || kind === 'diameter' ? 'GB_RADIAL' : 'GB_LINEAR';
}

function dimensionMeasurement(kind: string, points: readonly Vec2[]): number {
  const a = points[0];
  const b = points[1];
  if (!a || !b) return 0;
  if (kind === 'angular' && points[2]) {
    const c = points[2];
    const first = Math.atan2(a[1] - c[1], a[0] - c[0]);
    const second = Math.atan2(b[1] - c[1], b[0] - c[0]);
    return Math.abs(second - first) * 180 / Math.PI;
  }
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function writeGeometry(writer: DxfWriter, node: GeometryNode, layer: string): void {
  switch (node.type) {
    case 'point':
      entity(writer, 'POINT', layer);
      writer.pair(100, 'AcDbPoint');
      point(writer, 10, [node.x, node.y]);
      return;
    case 'line':
      writeLine(writer, node.start, node.end, layer);
      return;
    case 'ray':
    case 'xline':
      entity(writer, node.type === 'ray' ? 'RAY' : 'XLINE', layer);
      writer.pair(100, node.type === 'ray' ? 'AcDbRay' : 'AcDbXline');
      point(writer, 10, node.origin);
      point(writer, 11, node.direction);
      return;
    case 'circle':
      entity(writer, 'CIRCLE', layer);
      writer.pair(100, 'AcDbCircle');
      point(writer, 10, node.center);
      writer.pair(40, node.radius);
      return;
    case 'arc': {
      entity(writer, 'ARC', layer);
      writer.pair(100, 'AcDbCircle');
      point(writer, 10, node.center);
      writer.pair(40, node.radius);
      writer.pair(100, 'AcDbArc');
      // DXF arcs always travel counter-clockwise in their object coordinate system.
      writer.pair(50, normalizeDegrees(node.counterClockwise ? node.startAngle : node.endAngle));
      writer.pair(51, normalizeDegrees(node.counterClockwise ? node.endAngle : node.startAngle));
      return;
    }
    case 'ellipse':
      entity(writer, 'ELLIPSE', layer);
      writer.pair(100, 'AcDbEllipse');
      point(writer, 10, node.center);
      point(writer, 11, node.majorAxis);
      writer.pair(40, node.ratio);
      writer.pair(41, node.startParam ?? 0);
      writer.pair(42, node.endParam ?? Math.PI * 2);
      return;
    case 'polyline':
      if (node.vertices.length === 0) return;
      entity(writer, 'LWPOLYLINE', layer);
      writer.pair(100, 'AcDbPolyline');
      writer.pair(90, node.vertices.length);
      writer.pair(70, node.closed ? 1 : 0);
      for (const vertex of node.vertices) {
        writer.pair(10, vertex.point[0]);
        writer.pair(20, vertex.point[1]);
        if (vertex.bulge !== undefined) writer.pair(42, vertex.bulge);
      }
      return;
    case 'spline':
      if (node.controlPoints.length === 0) return;
      entity(writer, 'SPLINE', layer);
      writer.pair(100, 'AcDbSpline');
      writer.pair(70, 8 | (node.closed ? 1 : 0) | (node.periodic ? 2 : 0) | (node.weights ? 4 : 0));
      writer.pair(71, node.degree);
      writer.pair(72, node.knots.length);
      writer.pair(73, node.controlPoints.length);
      writer.pair(74, 0);
      for (const knot of node.knots) writer.pair(40, knot);
      for (const weight of node.weights ?? []) writer.pair(41, weight);
      for (const controlPoint of node.controlPoints) point(writer, 10, controlPoint);
  }
}

function writeAnnotation(writer: DxfWriter, node: AnnotationNode, profile: DxfExportProfile): void {
  const layer = annotationLayer(node, profile);
  switch (node.type) {
    case 'text':
      writeText(
        writer,
        node.position,
        node.content,
        node.height,
        node.rotation,
        node.alignment,
        node.verticalAlignment,
        layer,
      );
      return;
    case 'dimension': {
      writePolyline(writer, node.definitionPoints, false, layer);
      writeText(writer, node.textPosition, dimensionLabel(node), annotationTextHeight(node), 0, 'center', 'middle', layer);
      return;
    }
    case 'leader': {
      writePolyline(writer, node.points, false, layer);
      const textPosition = node.points.at(-1);
      if (textPosition !== undefined) {
        writeText(writer, textPosition, node.content, node.textHeight, 0, 'left', 'baseline', layer);
      }
      return;
    }
    case 'centerline': {
      const [start, end] = extendLine(node.start, node.end, node.extension);
      writeLine(writer, start, end, layer, 'CENTER2');
      return;
    }
    case 'section-hatch':
      if (node.hatch !== undefined) {
        writeHatch(writer, node, layer);
        return;
      }
      for (const segment of node.segments ?? []) {
        writeLine(writer, segment.start, segment.end, layer);
      }
  }
}

function writeHatch(writer: DxfWriter, node: Extract<AnnotationNode, { type: 'section-hatch' }>, layer: string): void {
  const hatch = node.hatch!;
  entity(writer, 'HATCH', layer);
  writer.pair(100, 'AcDbHatch');
  writer.pair(10, 0); writer.pair(20, 0); writer.pair(30, hatch.elevation);
  writer.pair(210, hatch.extrusion[0]); writer.pair(220, hatch.extrusion[1]); writer.pair(230, hatch.extrusion[2]);
  writer.pair(2, node.pattern);
  writer.pair(70, 0);
  writer.pair(71, 0);
  writer.pair(91, hatch.boundaryPaths.length);
  for (const path of hatch.boundaryPaths) {
    writer.pair(92, path.flags & ~2);
    writer.pair(93, path.edges.length);
    for (const edge of path.edges) {
      if (edge.type === 'line') {
        writer.pair(72, 1);
        point2(writer, 10, edge.start);
        point2(writer, 11, edge.end);
      } else if (edge.type === 'arc') {
        writer.pair(72, 2);
        point2(writer, 10, edge.center);
        writer.pair(40, edge.radius);
        writer.pair(50, edge.startAngle);
        writer.pair(51, edge.endAngle);
        writer.pair(73, edge.counterClockwise ? 1 : 0);
      } else if (edge.type === 'ellipse') {
        writer.pair(72, 3);
        point2(writer, 10, edge.center);
        point2(writer, 11, edge.majorAxis);
        writer.pair(40, edge.axisRatio);
        writer.pair(50, edge.startParameter);
        writer.pair(51, edge.endParameter);
        writer.pair(73, edge.counterClockwise ? 1 : 0);
      } else {
        writer.pair(72, 4);
        writer.pair(94, edge.degree);
        writer.pair(73, edge.rational ? 1 : 0);
        writer.pair(74, edge.periodic ? 1 : 0);
        writer.pair(95, edge.knots.length);
        writer.pair(96, edge.controlPoints.length);
        for (const knot of edge.knots) writer.pair(40, knot);
        edge.controlPoints.forEach((controlPoint, index) => {
          point2(writer, 10, controlPoint);
          if (edge.rational) writer.pair(42, edge.weights?.[index] ?? 1);
        });
        writer.pair(97, edge.fitPoints?.length ?? 0);
        for (const fitPoint of edge.fitPoints ?? []) point2(writer, 11, fitPoint);
      }
    }
    writer.pair(97, 0);
  }
  writer.pair(75, { normal: 0, outer: 1, ignore: 2 }[hatch.style]);
  writer.pair(76, 0);
  writer.pair(52, hatch.patternAngle);
  writer.pair(41, hatch.patternScale);
  writer.pair(77, hatch.double ? 1 : 0);
  writer.pair(78, hatch.patternLines.length);
  for (const line of hatch.patternLines) {
    writer.pair(53, line.angle);
    writer.pair(43, line.base[0]); writer.pair(44, line.base[1]);
    writer.pair(45, line.offset[0]); writer.pair(46, line.offset[1]);
    writer.pair(79, line.dashLengths.length);
    for (const dash of line.dashLengths) writer.pair(49, dash);
  }
  writer.pair(98, 0);
}

function entity(writer: DxfWriter, type: string, layer: string, color?: number): void {
  writer.pair(0, type);
  writer.handle();
  writer.pair(100, 'AcDbEntity');
  writer.pair(8, layer);
  if (color !== undefined) writer.pair(62, color);
}

function point(writer: DxfWriter, xCode: number, value: Vec2): void {
  writer.pair(xCode, value[0]);
  writer.pair(xCode + 10, value[1]);
  writer.pair(xCode + 20, 0);
}

function point2(writer: DxfWriter, xCode: number, value: Vec2): void {
  writer.pair(xCode, value[0]);
  writer.pair(xCode + 10, value[1]);
}

function writeLine(
  writer: DxfWriter,
  start: Vec2,
  end: Vec2,
  layer: string,
  lineType?: string,
  color?: number,
): void {
  entity(writer, 'LINE', layer, color);
  writer.pair(100, 'AcDbLine');
  if (lineType !== undefined) writer.pair(6, lineType);
  point(writer, 10, start);
  point(writer, 11, end);
}

function writeArc(
  writer: DxfWriter,
  center: Vec2,
  radius: number,
  startAngle: number,
  endAngle: number,
  layer: string,
  color?: number,
): void {
  entity(writer, 'ARC', layer, color);
  writer.pair(100, 'AcDbCircle');
  point(writer, 10, center);
  writer.pair(40, Math.max(radius, Number.EPSILON));
  writer.pair(100, 'AcDbArc');
  writer.pair(50, normalizeDegrees(startAngle));
  writer.pair(51, normalizeDegrees(endAngle));
}

function writePolyline(writer: DxfWriter, points: readonly Vec2[], closed: boolean, layer: string, color?: number): void {
  if (points.length === 0) return;
  entity(writer, 'LWPOLYLINE', layer, color);
  writer.pair(100, 'AcDbPolyline');
  writer.pair(90, points.length);
  writer.pair(70, closed ? 1 : 0);
  for (const value of points) {
    writer.pair(10, value[0]);
    writer.pair(20, value[1]);
  }
}

function writeText(
  writer: DxfWriter,
  position: Vec2,
  content: string,
  height: number,
  rotation: number,
  alignment: 'left' | 'center' | 'right',
  verticalAlignment: 'baseline' | 'bottom' | 'middle' | 'top',
  layer = '0',
  color?: number,
): void {
  entity(writer, 'TEXT', layer, color);
  writer.pair(100, 'AcDbText');
  point(writer, 10, position);
  writer.pair(40, Math.max(height, Number.EPSILON));
  writer.pair(1, dxfText(content));
  writer.pair(50, rotation);
  writer.pair(72, { left: 0, center: 1, right: 2 }[alignment]);
  writer.pair(73, { baseline: 0, bottom: 1, middle: 2, top: 3 }[verticalAlignment]);
  writer.pair(100, 'AcDbText');
  if (alignment !== 'left' || verticalAlignment !== 'baseline') point(writer, 11, position);
}

function writeMText(
  writer: DxfWriter,
  position: Vec2,
  content: string,
  height: number,
  rotation: number,
  layer: string,
  style = 'STANDARD',
  alignment = 5,
  color?: number,
): void {
  writer.pair(0, 'MTEXT');
  writer.handle();
  writer.pair(100, 'AcDbEntity');
  writer.pair(8, layer);
  if (color !== undefined) writer.pair(62, color);
  writer.pair(100, 'AcDbMText');
  point(writer, 10, position);
  writer.pair(40, Math.max(height, Number.EPSILON));
  writer.pair(41, Math.max(height * Math.max(content.length, 1), height));
  writer.pair(71, alignment);
  writer.pair(72, 1);
  writer.pair(1, dxfText(content));
  writer.pair(7, style);
  writer.pair(50, rotation);
}

function writeSolidHatch(writer: DxfWriter, boundary: readonly Vec2[], layer: string, color?: number): void {
  if (boundary.length < 3) return;
  entity(writer, 'HATCH', layer, color);
  writer.pair(100, 'AcDbHatch');
  point(writer, 10, [0, 0]);
  writer.pair(210, 0); writer.pair(220, 0); writer.pair(230, 1);
  writer.pair(2, 'SOLID');
  writer.pair(70, 1);
  writer.pair(71, 0);
  writer.pair(91, 1);
  writer.pair(92, 2);
  writer.pair(72, 0);
  writer.pair(73, 1);
  writer.pair(93, boundary.length);
  for (const vertex of boundary) point2(writer, 10, vertex);
  writer.pair(97, 0);
  writer.pair(75, 0);
  writer.pair(76, 1);
  writer.pair(98, 0);
}

function extendLine(start: Vec2, end: Vec2, extension: number): [Vec2, Vec2] {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  if (!(length > 0) || !(extension > 0)) return [start, end];
  const extendX = dx / length * extension;
  const extendY = dy / length * extension;
  return [
    [start[0] - extendX, start[1] - extendY],
    [end[0] + extendX, end[1] + extendY],
  ];
}

function annotationTextHeight(node: Extract<AnnotationNode, { type: 'dimension' }>): number {
  const points = node.definitionPoints;
  if (points.length < 2) return 2.5;
  return Math.max(Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]) * 0.05, 0.1);
}

function dimensionLabel(node: Extract<AnnotationNode, { type: 'dimension' }>): string {
  const base = baseDimensionLabel(node);
  const tolerance = toleranceLabel(node);
  return tolerance === undefined ? base : `${base} ${tolerance}`;
}

function baseDimensionLabel(node: Extract<AnnotationNode, { type: 'dimension' }>): string {
  if (node.displayText !== undefined) return node.displayText;
  const value = node.observedValue ?? node.computedValue;
  if (value === undefined) return '—';
  return `${node.prefix ?? ''}${value}${node.unit ? ` ${node.unit}` : ''}${node.suffix ?? ''}`;
}

function toleranceLabel(node: Extract<AnnotationNode, { type: 'dimension' }>): string | undefined {
  const projection = node.toleranceProjection;
  if (projection && (projection.status === 'resolved' || projection.status === 'confirmed')) {
    switch (projection.mode) {
      case 'bilateral':
        if (finite(projection.upperDeviation) && finite(projection.lowerDeviation)) {
          return `${signed(projection.upperDeviation)}/${signed(projection.lowerDeviation)}`;
        }
        return undefined;
      case 'unilateral':
        if (finite(projection.upperDeviation) || finite(projection.lowerDeviation)) {
          return `${signed(projection.upperDeviation ?? 0)}/${signed(projection.lowerDeviation ?? 0)}`;
        }
        return undefined;
      case 'limits':
        if (finite(projection.upperLimit) && finite(projection.lowerLimit) && projection.lowerLimit <= projection.upperLimit) {
          return `[${textNumber(projection.upperLimit)}/${textNumber(projection.lowerLimit)}]`;
        }
        return undefined;
      case 'fit':
        return projection.fitDesignation?.trim() || undefined;
      case 'none':
        return undefined;
    }
  }
  const legacy = node.tolerance;
  if (legacy && (finite(legacy.upper) || finite(legacy.lower))) {
    return `${signed(legacy.upper ?? 0)}/${signed(legacy.lower ?? 0)}`;
  }
  return undefined;
}

function finite(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function signed(value: number): string {
  if (Object.is(value, -0) || value === 0) return '0';
  return value > 0 ? `+${textNumber(value)}` : textNumber(value);
}

function textNumber(value: number): string {
  return Object.is(value, -0) ? '0' : String(value);
}

function dxfText(value: string): string {
  return [...value.replace(/\r\n|\r|\n/g, '\\P')]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code >= 32 && code !== 127;
    })
    .join('');
}

function insertionUnit(unit: DrawingDocument['unitSystem']['length']): number {
  return { mm: 4, cm: 5, m: 6 }[unit];
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) throw new TypeError('DXF values must be finite numbers');
  return Object.is(value, -0) ? '0' : String(value);
}
