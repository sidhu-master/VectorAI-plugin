// SPDX-License-Identifier: Apache-2.0

import { createRequire } from 'node:module';
import { access, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

export const VECTORIZER_PROTOCOL_VERSION = 'vectorai-vectorizer-1' as const;
export const VECTORIZER_PIPELINE_VERSION = 'clean-line-v5' as const;

const runtimePackages = new Map<string, string>([
  ['darwin-arm64', '@newwe/vectorai-vectorizer-darwin-arm64'],
  ['darwin-x64', '@newwe/vectorai-vectorizer-darwin-x64'],
  ['linux-arm64', '@newwe/vectorai-vectorizer-linux-arm64'],
  ['linux-x64', '@newwe/vectorai-vectorizer-linux-x64'],
  ['win32-x64', '@newwe/vectorai-vectorizer-win32-x64'],
]);

export interface VectorizerRuntimeManifest {
  releaseVersion: string;
  protocolVersion: typeof VECTORIZER_PROTOCOL_VERSION;
  pipelineVersion: typeof VECTORIZER_PIPELINE_VERSION;
  platform: NodeJS.Platform;
  arch: string;
  pythonVersion: string;
  dependencies: {
    numpy: string;
    'opencv-python-headless': string;
    'scikit-image': string;
  };
  executable: string;
  treeSha256: string;
}

export interface ResolvedVectorizerRuntime {
  executablePath: string;
  source: 'package' | 'override';
  packageName?: string;
  manifest?: VectorizerRuntimeManifest;
}

interface ResolveOptions {
  platform?: NodeJS.Platform | string;
  arch?: string;
  environment?: Record<string, string | undefined>;
  resolvePackageJson?: (specifier: string) => string;
}

export function runtimePackageName(platform: NodeJS.Platform | string, arch: string): string {
  const target = `${platform}-${arch}`;
  const packageName = runtimePackages.get(target);
  if (!packageName) throw new Error(`VECTORAI_VECTORIZER_PLATFORM_UNSUPPORTED ${target}`);
  return packageName;
}

export async function resolveVectorizerRuntime(options: ResolveOptions = {}): Promise<ResolvedVectorizerRuntime> {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const environment = options.environment ?? process.env;
  const override = environment.VECTORAI_VECTORIZER_RUNTIME?.trim();
  if (override) {
    const executablePath = resolve(override);
    await requireAccessible(executablePath, 'VECTORAI_VECTORIZER_RUNTIME_EXECUTABLE_MISSING');
    return { executablePath, source: 'override' };
  }

  const packageName = runtimePackageName(platform, arch);
  const resolvePackageJson = options.resolvePackageJson
    ?? ((specifier: string) => createRequire(import.meta.url).resolve(specifier));
  let packageJson: string;
  try {
    packageJson = resolvePackageJson(`${packageName}/package.json`);
  } catch {
    throw new Error(`VECTORAI_VECTORIZER_RUNTIME_MISSING ${packageName}`);
  }
  const packageRoot = dirname(packageJson);
  let manifest: VectorizerRuntimeManifest;
  try {
    manifest = validateManifest(JSON.parse(await readFile(resolve(packageRoot, 'runtime.json'), 'utf8')));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('VECTORAI_')) throw error;
    throw new Error(`VECTORAI_VECTORIZER_RUNTIME_MANIFEST_INVALID ${packageName}`);
  }
  if (manifest.protocolVersion !== VECTORIZER_PROTOCOL_VERSION) {
    throw new Error('VECTORAI_VECTORIZER_PROTOCOL_MISMATCH');
  }
  if (manifest.pipelineVersion !== VECTORIZER_PIPELINE_VERSION) {
    throw new Error('VECTORAI_VECTORIZER_PIPELINE_MISMATCH');
  }
  if (manifest.platform !== platform || manifest.arch !== arch) {
    throw new Error(`VECTORAI_VECTORIZER_RUNTIME_PLATFORM_MISMATCH ${manifest.platform}-${manifest.arch}`);
  }
  if (isAbsolute(manifest.executable)) throw new Error('VECTORAI_VECTORIZER_RUNTIME_EXECUTABLE_INVALID');
  const executablePath = resolve(packageRoot, manifest.executable);
  const pathFromPackage = relative(packageRoot, executablePath);
  if (pathFromPackage.startsWith('..') || isAbsolute(pathFromPackage)) {
    throw new Error('VECTORAI_VECTORIZER_RUNTIME_EXECUTABLE_INVALID');
  }
  await requireAccessible(executablePath, 'VECTORAI_VECTORIZER_RUNTIME_EXECUTABLE_MISSING');
  return { executablePath, source: 'package', packageName, manifest };
}

function validateManifest(value: unknown): VectorizerRuntimeManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('VECTORAI_VECTORIZER_RUNTIME_MANIFEST_INVALID');
  }
  const manifest = value as Record<string, unknown>;
  const dependencies = manifest.dependencies;
  if (
    typeof manifest.releaseVersion !== 'string'
    || typeof manifest.protocolVersion !== 'string'
    || typeof manifest.pipelineVersion !== 'string'
    || typeof manifest.platform !== 'string'
    || typeof manifest.arch !== 'string'
    || typeof manifest.pythonVersion !== 'string'
    || typeof manifest.executable !== 'string'
    || !/^sha256:[a-f0-9]{64}$/.test(String(manifest.treeSha256))
    || !dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)
  ) throw new Error('VECTORAI_VECTORIZER_RUNTIME_MANIFEST_INVALID');
  const versions = dependencies as Record<string, unknown>;
  for (const name of ['numpy', 'opencv-python-headless', 'scikit-image']) {
    if (typeof versions[name] !== 'string' || versions[name] === '') {
      throw new Error('VECTORAI_VECTORIZER_RUNTIME_MANIFEST_INVALID');
    }
  }
  return structuredClone(value) as VectorizerRuntimeManifest;
}

async function requireAccessible(path: string, code: string): Promise<void> {
  try {
    await access(path);
  } catch {
    throw new Error(`${code} ${path}`);
  }
}
