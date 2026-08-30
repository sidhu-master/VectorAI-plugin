// SPDX-License-Identifier: Apache-2.0

import type { GeometricToleranceEdit, GeometricToleranceIntent } from './types';

export function applyGeometricToleranceEdit(
  intent: GeometricToleranceIntent,
  edit: GeometricToleranceEdit,
): GeometricToleranceIntent {
  const next = structuredClone(intent);
  switch (edit.type) {
    case 'characteristic.set': next.characteristic = edit.characteristic; break;
    case 'controlled-targets.set': next.controlledTargets = structuredClone(edit.targets); break;
    case 'datum-frame.set': next.datumReferenceFrame = structuredClone(edit.references); break;
    case 'zone.set': next.toleranceZone = structuredClone(edit.zone); break;
    case 'override.set':
      if (!Number.isFinite(edit.value) || edit.value <= 0) throw new Error('GDT_VALUE_INVALID');
      next.override = { value: edit.value };
      break;
    case 'override.clear': delete next.override; break;
  }
  if (next.status === 'confirmed') next.status = 'resolved';
  return next;
}
