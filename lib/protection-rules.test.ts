import { describe, expect, it } from 'vitest';
import { getProtectionReasons, isTabProtected } from './protection-rules';

describe('tab protection', () => {
  it('protects active, pinned, audible and manually protected tabs', () => {
    expect(
      getProtectionReasons(
        { active: true, audible: true, id: 7, pinned: true, url: 'https://example.com' },
        { manuallyProtectedTabIds: new Set([7]) },
      ),
    ).toEqual(['active', 'pinned', 'audible', 'manual']);
  });

  it('matches exact domains and subdomains from the allowlist', () => {
    expect(
      isTabProtected(
        { url: 'https://docs.example.com/guide' },
        { domainAllowlist: ['example.com'] },
      ),
    ).toBe(true);
  });

  it('protects restricted browser pages', () => {
    expect(isTabProtected({ url: 'chrome://settings/' })).toBe(true);
    expect(isTabProtected({ url: 'chrome-extension://extension-id/options.html' })).toBe(true);
    expect(isTabProtected({ url: 'file:///Users/example/notes.html' })).toBe(true);
  });
});
