// SPDX-License-Identifier: Apache-2.0

import type { DxfPair } from './types';

export interface DxfSection {
  name: string;
  pairs: DxfPair[];
}

export interface DxfSections {
  header?: DxfSection;
  tables?: DxfSection;
  blocks?: DxfSection;
  entities?: DxfSection;
}

export function indexDxfSections(pairs: readonly DxfPair[]): DxfSections {
  const sections: DxfSections = {};
  for (let index = 0; index < pairs.length - 1; index += 1) {
    if (pairs[index].code !== 0 || pairs[index].value !== 'SECTION') continue;
    const namePair = pairs[index + 1];
    if (namePair.code !== 2) continue;
    let end = index + 2;
    while (end < pairs.length && !(pairs[end].code === 0 && pairs[end].value === 'ENDSEC')) end += 1;
    const section = { name: namePair.value, pairs: pairs.slice(index + 2, end) };
    if (namePair.value === 'HEADER') sections.header = section;
    else if (namePair.value === 'TABLES') sections.tables = section;
    else if (namePair.value === 'BLOCKS') sections.blocks = section;
    else if (namePair.value === 'ENTITIES') sections.entities = section;
    index = end;
  }
  return sections;
}
