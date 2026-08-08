import {
  PROTOCOL_NAME,
  PROTOCOL_VERSION,
  type SpatialModel,
} from './types';

const MIGRATABLE_VERSIONS = new Set(['0.1', PROTOCOL_VERSION]);

export function migrateModelToCurrent(model: SpatialModel): SpatialModel {
  if (model.protocol !== PROTOCOL_NAME) {
    throw new Error(`不支持的协议: ${model.protocol}`);
  }
  if (!MIGRATABLE_VERSIONS.has(model.version)) {
    throw new Error(`不支持的 Spatial Protocol 版本: ${model.version}`);
  }

  const migrated = structuredClone(model);
  migrated.version = PROTOCOL_VERSION;
  return migrated;
}
