import { describe, expect, it } from 'vitest';
import {
  isAddressBarNavigation,
  isDeliberateCurrentPageCopy,
} from './navigation-intent';

describe('navigation intent', () => {
  it('recognizes typed and pasted address-bar navigations', () => {
    expect(isAddressBarNavigation({ transitionType: 'typed' })).toBe(true);
    expect(
      isAddressBarNavigation({
        transitionQualifiers: ['from_address_bar'],
        transitionType: 'generated',
      }),
    ).toBe(true);
    expect(isAddressBarNavigation({ transitionType: 'keyword_generated' })).toBe(true);
  });

  it('does not classify links or generated external navigations as address-bar input', () => {
    expect(isAddressBarNavigation({ transitionType: 'link' })).toBe(false);
    expect(isAddressBarNavigation({ transitionType: 'generated' })).toBe(false);
  });

  it('preserves only an address copied from the page active before the new tab', () => {
    expect(
      isDeliberateCurrentPageCopy(
        { transitionType: 'typed' },
        'https://example.com/article',
        'https://example.com/article',
      ),
    ).toBe(true);
    expect(
      isDeliberateCurrentPageCopy(
        { transitionType: 'typed' },
        'https://other.example/',
        'https://example.com/article',
      ),
    ).toBe(false);
  });
});
