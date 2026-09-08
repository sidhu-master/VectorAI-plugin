import { describe, expect, it } from 'vitest';

import { findReadyUrl } from './ready-url.js';

describe('findReadyUrl', () => {
  it('accepts only the token URL for the allocated loopback port', () => {
    const output = [
      'dsh web: http://localhost:3080/?token=wrong-host',
      'dsh web: http://127.0.0.1:3079/?token=wrong-port',
      'dsh web: http://127.0.0.1:3080/',
      'dsh web: http://127.0.0.1:3080/?token=ready-token',
    ].join('\n');
    expect(findReadyUrl(output, 3080)?.href).toBe('http://127.0.0.1:3080/?token=ready-token');
  });

  it('rejects extra query parameters and non-http schemes', () => {
    expect(findReadyUrl('dsh web: http://127.0.0.1:3080/?token=a&extra=b', 3080)).toBeUndefined();
    expect(findReadyUrl('dsh web: https://127.0.0.1:3080/?token=a', 3080)).toBeUndefined();
  });
});
