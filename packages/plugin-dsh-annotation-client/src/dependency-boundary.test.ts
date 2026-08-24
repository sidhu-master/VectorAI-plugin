// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('@vectorai/plugin-dsh-annotation-client boundary', () => {
  it('uses only public runtime contracts and never imports first-layer Store or React Context', () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const source = ['client.tsx', 'AnnotationWorkspace.tsx', 'annotation-state-source.ts']
      .map((file) => readFileSync(join(root, file), 'utf8'))
      .join('\n');

    expect(source).not.toMatch(/plugin-dsh-space-client\/(?:src|lib)\//);
    expect(source).not.toMatch(/plugin-dsh-space-host\/(?:src|lib)\//);
    expect(source).not.toContain('DrawingWorkspaceProvider');
    expect(source).not.toContain('useDrawingWorkspace');
    expect(source).not.toContain('createDrawingWorkspaceStore');
    expect(source).not.toContain("conversation.workspace");
  });
});
