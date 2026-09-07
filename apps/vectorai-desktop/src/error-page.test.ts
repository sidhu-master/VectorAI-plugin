import { describe, expect, it } from 'vitest';

import { renderStartupError } from './error-page.js';

describe('renderStartupError', () => {
  it('shows the log path while removing keys and token URLs', () => {
    const html = renderStartupError(
      new Error('key=secret-value http://127.0.0.1:3080/?token=ready-token'),
      '/tmp/<vectorai>.log',
    );
    expect(html).toContain('/tmp/&lt;vectorai&gt;.log');
    expect(html).not.toMatch(/secret-value|ready-token/);
    expect(html).toContain('vectorai://retry');
  });
});
