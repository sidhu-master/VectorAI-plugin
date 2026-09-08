export type DesktopPlatform = 'darwin' | 'win32';
export type DesktopArch = 'arm64' | 'x64';
export type DesktopTargetId = 'darwin-arm64' | 'darwin-x64' | 'win32-x64';

const SPACE_BUNDLE = '@newwe/vectorai-plugin-dsh-space' as const;
const ANNOTATION_BUNDLE = '@newwe/vectorai-plugin-dsh-annotation' as const;
const DSH_ENTRY = 'dsh/node_modules/@deepseek-ai/dsh/lib/bin.js' as const;

export interface DesktopRuntimeManifest {
  schemaVersion: 1;
  vectoraiVersion: string;
  dsh: { version: string; commit: string };
  nodeVersion: '22.19.0';
  profile: 'web';
  bundles: readonly [typeof SPACE_BUNDLE, typeof ANNOTATION_BUNDLE];
  platform: DesktopPlatform;
  arch: DesktopArch;
  entry: typeof DSH_ENTRY;
}

export interface DesktopRuntimeTarget {
  platform: DesktopPlatform;
  arch: DesktopArch;
  id: DesktopTargetId;
}

export function runtimeTarget(platform: NodeJS.Platform, arch: string): DesktopRuntimeTarget {
  if (platform === 'darwin' && (arch === 'arm64' || arch === 'x64')) {
    return { platform, arch, id: `${platform}-${arch}` };
  }
  if (platform === 'win32' && arch === 'x64') {
    return { platform, arch, id: 'win32-x64' };
  }
  throw new Error(`DESKTOP_RUNTIME_TARGET_UNSUPPORTED:${platform}-${arch}`);
}

export function parseDesktopRuntimeManifest(value: unknown): DesktopRuntimeManifest {
  if (!isRecord(value)) throw new Error('DESKTOP_RUNTIME_MANIFEST_INVALID');

  const bundles = value.bundles;
  if (!Array.isArray(bundles)
    || bundles.length !== 2
    || bundles[0] !== SPACE_BUNDLE
    || bundles[1] !== ANNOTATION_BUNDLE) {
    throw new Error('DESKTOP_RUNTIME_BUNDLE_ORDER_INVALID');
  }

  if (value.schemaVersion !== 1) throw new Error('DESKTOP_RUNTIME_SCHEMA_VERSION_INVALID');
  if (!isNonEmptyString(value.vectoraiVersion)) throw new Error('DESKTOP_RUNTIME_VECTORAI_VERSION_INVALID');
  if (!isRecord(value.dsh)
    || !isNonEmptyString(value.dsh.version)
    || !/^[a-f0-9]{40}$/u.test(String(value.dsh.commit))) {
    throw new Error('DESKTOP_RUNTIME_DSH_INVALID');
  }
  if (value.nodeVersion !== '22.19.0') throw new Error('DESKTOP_RUNTIME_NODE_VERSION_INVALID');
  if (value.profile !== 'web') throw new Error('DESKTOP_RUNTIME_PROFILE_INVALID');
  if (value.entry !== DSH_ENTRY) throw new Error('DESKTOP_RUNTIME_ENTRY_INVALID');

  const target = runtimeTarget(value.platform as NodeJS.Platform, String(value.arch));
  if (target.platform !== value.platform || target.arch !== value.arch) {
    throw new Error('DESKTOP_RUNTIME_TARGET_INVALID');
  }
  return value as unknown as DesktopRuntimeManifest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
