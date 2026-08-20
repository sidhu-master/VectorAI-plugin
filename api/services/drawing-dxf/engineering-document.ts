export type EngineeringRegionType = 'gear' | 'spline' | 'bearing' | string;

export interface EngineeringRegion {
  type: EngineeringRegionType;
  id: string;
  name?: string;
  centerZ: number;
  width: number;
  outerDiameter?: number;
  properties: Record<string, string | number>;
}

export interface EngineeringDocument {
  drawing: {
    drawingId?: string;
    drawingName?: string;
    unit: 'mm' | 'cm' | 'm';
    axisOrigin: 'left_end' | string;
    orientation: 'auto' | string;
  };
  regions: EngineeringRegion[];
}

interface Section {
  name: string;
  values: Map<string, string>;
}

export function parseEngineeringDocument(source: string): EngineeringDocument {
  const sections = parseSections(source);
  const drawingSection = sections.find((section) => section.name === 'drawing');
  const unit = drawingSection?.values.get('unit') || 'mm';
  if (!['mm', 'cm', 'm'].includes(unit)) {
    throw new Error(`ENGINEERING_DOCUMENT_UNIT_INVALID: ${unit}`);
  }
  const ids = new Set<string>();
  const regions = sections
    .filter((section) => section.name.startsWith('region:'))
    .map((section): EngineeringRegion => {
      const [, type, id] = section.name.split(':');
      if (!type || !id) throw new Error(`ENGINEERING_DOCUMENT_REGION_HEADER_INVALID: ${section.name}`);
      if (ids.has(id)) throw new Error(`ENGINEERING_DOCUMENT_REGION_DUPLICATE: ${id}`);
      ids.add(id);
      const centerZ = requiredNumber(section, 'center_z');
      const width = requiredNumber(section, 'width');
      if (!(width > 0)) throw new Error(`ENGINEERING_DOCUMENT_WIDTH_INVALID: ${id}`);
      const outerDiameter = optionalNumber(section, 'outer_diameter');
      if (outerDiameter !== undefined && !(outerDiameter > 0)) {
        throw new Error(`ENGINEERING_DOCUMENT_DIAMETER_INVALID: ${id}`);
      }
      const reserved = new Set(['name', 'center_z', 'width', 'outer_diameter']);
      const properties = Object.fromEntries([...section.values.entries()]
        .filter(([key, value]) => !reserved.has(key) && value !== '')
        .map(([key, value]) => [key, numericOrString(value)]));
      return {
        type,
        id,
        ...(section.values.get('name') ? { name: section.values.get('name') } : {}),
        centerZ,
        width,
        ...(outerDiameter === undefined ? {} : { outerDiameter }),
        properties,
      };
    });

  return {
    drawing: {
      ...(drawingSection?.values.get('drawing_id')
        ? { drawingId: drawingSection.values.get('drawing_id') }
        : {}),
      ...(drawingSection?.values.get('drawing_name')
        ? { drawingName: drawingSection.values.get('drawing_name') }
        : {}),
      unit: unit as 'mm' | 'cm' | 'm',
      axisOrigin: drawingSection?.values.get('axis_origin') || 'left_end',
      orientation: drawingSection?.values.get('orientation') || 'auto',
    },
    regions,
  };
}

function parseSections(source: string): Section[] {
  const sections: Section[] = [];
  let current: Section | undefined;
  for (const [index, rawLine] of source.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const header = /^\[([^\]]+)]$/.exec(line);
    if (header) {
      current = { name: (header[1] ?? '').trim(), values: new Map() };
      sections.push(current);
      continue;
    }
    const separator = line.indexOf('=');
    if (!current || separator < 1) {
      throw new Error(`ENGINEERING_DOCUMENT_LINE_INVALID: ${index + 1}`);
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (current.values.has(key)) {
      throw new Error(`ENGINEERING_DOCUMENT_KEY_DUPLICATE: ${current.name}.${key}`);
    }
    current.values.set(key, value);
  }
  return sections;
}

function requiredNumber(section: Section, key: string): number {
  const raw = section.values.get(key);
  if (!raw) throw new Error(`ENGINEERING_DOCUMENT_VALUE_REQUIRED: ${section.name}.${key}`);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`ENGINEERING_DOCUMENT_NUMBER_INVALID: ${section.name}.${key}`);
  }
  return parsed;
}

function optionalNumber(section: Section, key: string): number | undefined {
  const raw = section.values.get(key);
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`ENGINEERING_DOCUMENT_NUMBER_INVALID: ${section.name}.${key}`);
  }
  return parsed;
}

function numericOrString(value: string): string | number {
  const parsed = Number(value);
  return value !== '' && Number.isFinite(parsed) ? parsed : value;
}
