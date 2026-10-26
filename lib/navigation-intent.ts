import { normalizeUrl } from './url-normalization';

export type NavigationTransition = {
  transitionQualifiers?: readonly string[];
  transitionType?: string;
};

/** Returns true only for navigation signals that originate from the address bar. */
export function isAddressBarNavigation(
  navigation: NavigationTransition,
): boolean {
  return (
    navigation.transitionQualifiers?.includes('from_address_bar') === true ||
    navigation.transitionType === 'typed' ||
    navigation.transitionType === 'keyword' ||
    navigation.transitionType === 'keyword_generated'
  );
}

export function isDeliberateCurrentPageCopy(
  navigation: NavigationTransition,
  createdFromUrl: string | undefined,
  targetUrl: string | undefined,
  ignoredQueryParameters?: readonly string[],
): boolean {
  if (!isAddressBarNavigation(navigation)) return false;
  const options = { ignoredQueryParameters };
  const source = normalizeUrl(createdFromUrl, options);
  const target = normalizeUrl(targetUrl, options);
  return Boolean(source && source === target);
}
