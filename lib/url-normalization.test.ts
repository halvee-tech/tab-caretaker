import { describe, expect, it } from 'vitest';
import { normalizeUrl } from './url-normalization';

describe('normalizeUrl', () => {
  it('normalizes host casing and trailing slashes', () => {
    expect(normalizeUrl('HTTPS://Example.COM/docs/')).toBe('https://example.com/docs');
  });

  it('removes known tracking parameters but preserves meaningful state', () => {
    expect(
      normalizeUrl('https://example.com/item?id=42&utm_source=mail#details'),
    ).toBe('https://example.com/item?id=42#details');
  });

  it('supports a custom ignored parameter list', () => {
    expect(
      normalizeUrl('https://example.com/?ref=campaign&utm_source=mail', {
        ignoredQueryParameters: ['ref'],
      }),
    ).toBe('https://example.com/?utm_source=mail');
  });

  it('ignores empty and new-tab pages', () => {
    expect(normalizeUrl('about:blank')).toBeNull();
    expect(normalizeUrl('chrome://newtab/')).toBeNull();
  });
});
