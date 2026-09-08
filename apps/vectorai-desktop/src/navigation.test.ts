import { describe, expect, it } from 'vitest';

import { isAllowedInAppNavigation } from './navigation.js';

describe('isAllowedInAppNavigation', () => {
  const ready = new URL('http://127.0.0.1:3080/?token=secret');

  it('allows paths on the exact ready origin', () => {
    expect(isAllowedInAppNavigation(new URL('http://127.0.0.1:3080/session/1'), ready)).toBe(true);
  });

  it('rejects external, alternate-port, file, and javascript destinations', () => {
    expect(isAllowedInAppNavigation(new URL('https://example.com'), ready)).toBe(false);
    expect(isAllowedInAppNavigation(new URL('http://127.0.0.1:3081/'), ready)).toBe(false);
    expect(isAllowedInAppNavigation(new URL('file:///tmp/data'), ready)).toBe(false);
    expect(isAllowedInAppNavigation(new URL('javascript:alert(1)'), ready)).toBe(false);
  });
});
