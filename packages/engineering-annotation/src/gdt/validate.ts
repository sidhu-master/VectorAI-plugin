// SPDX-License-Identifier: Apache-2.0

import type { EngineeringDatum, EngineeringDiagnostic } from '../dimension/types';
import type { GeometricCharacteristic, GeometricToleranceIntent } from './types';
import { effectiveGeometricToleranceValue } from './value';

const DATUM_OPTIONAL = new Set<GeometricCharacteristic>([
  'straightness', 'flatness', 'circularity', 'cylindricity',
]);

export function validateGeometricTolerances(input: {
  datums: readonly EngineeringDatum[];
  intents?: readonly GeometricToleranceIntent[];
  geometryIds?: ReadonlySet<string>;
}): EngineeringDiagnostic[] {
  const diagnostics: EngineeringDiagnostic[] = [];
  const datumIds = new Set(input.datums.map(({ id }) => id));
  const datumNames = new Map<string, string>();
  for (const datum of input.datums) {
    const existing = datumNames.get(datum.name);
    if (existing) diagnostics.push(problem('GDT_DATUM_NAME_DUPLICATE', datum.id, `Datum ${datum.name} duplicates ${existing}`));
    else datumNames.set(datum.name, datum.id);
    if (input.geometryIds && !input.geometryIds.has(datum.geometryId)) diagnostics.push(problem('GDT_DATUM_GEOMETRY_UNKNOWN', datum.id, `Datum geometry ${datum.geometryId} is unavailable`));
  }
  const intentIds = new Set<string>();
  for (const intent of input.intents ?? []) {
    if (intentIds.has(intent.id)) diagnostics.push(problem('GDT_ID_DUPLICATE', intent.id, 'Duplicate geometric tolerance ID'));
    intentIds.add(intent.id);
    if (intent.controlledTargets.length === 0) diagnostics.push(problem('GDT_TARGET_REQUIRED', intent.id, 'Controlled feature is required'));
    if (input.geometryIds) for (const target of intent.controlledTargets) {
      if (!input.geometryIds.has(target.geometryId)) diagnostics.push(problem('GDT_TARGET_UNKNOWN', intent.id, `Controlled geometry ${target.geometryId} is unavailable`));
    }
    if (!DATUM_OPTIONAL.has(intent.characteristic) && intent.datumReferenceFrame.length === 0) diagnostics.push(problem('GDT_DATUM_REQUIRED', intent.id, `${intent.characteristic} requires a datum reference`));
    const referenced = new Set<string>();
    for (const reference of intent.datumReferenceFrame) {
      if (!datumIds.has(reference.datumId)) diagnostics.push(problem('GDT_DATUM_UNKNOWN', intent.id, `Unknown datum ${reference.datumId}`));
      if (referenced.has(reference.datumId)) diagnostics.push(problem('GDT_DATUM_REFERENCE_DUPLICATE', intent.id, `Repeated datum ${reference.datumId}`));
      referenced.add(reference.datumId);
    }
    for (const value of [intent.computed.value, intent.override?.value, intent.toleranceZone.projectedZoneLength]) {
      if (value !== undefined && (!Number.isFinite(value) || value <= 0)) diagnostics.push(problem('GDT_VALUE_INVALID', intent.id, 'Tolerance values must be finite and positive'));
    }
    if (intent.computed.status === 'resolved' && intent.computed.value === undefined) diagnostics.push(problem('GDT_COMPUTED_VALUE_REQUIRED', intent.id, 'Resolved calculation requires a value'));
    if (intent.status === 'confirmed' && effectiveGeometricToleranceValue(intent) === undefined) diagnostics.push(problem('GDT_EFFECTIVE_VALUE_REQUIRED', intent.id, 'Confirmed tolerance requires an effective value'));
  }
  return [...new Map(diagnostics.map((item) => [item.id, item])).values()].sort((a, b) => a.id.localeCompare(b.id));
}

function problem(code: string, entityId: string, message: string): EngineeringDiagnostic {
  return { id: `gdt:${code}:${entityId}`, severity: 'error', code, message, entityIds: [entityId] };
}
