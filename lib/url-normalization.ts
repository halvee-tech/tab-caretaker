export const DEFAULT_TRACKING_PARAMETERS = [
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'utm_campaign',
  'utm_content',
  'utm_medium',
  'utm_source',
  'utm_term',
] as const;

export type UrlNormalizationOptions = {
  ignoredQueryParameters?: readonly string[];
  stripTrailingSlash?: boolean;
};

const IGNORED_URLS = new Set(['about:blank', 'about:newtab']);

function shouldIgnoreUrl(value: string): boolean {
  const lowerValue = value.toLowerCase();
  return (
    IGNORED_URLS.has(lowerValue) ||
    lowerValue.startsWith('chrome://newtab') ||
    lowerValue.startsWith('edge://newtab')
  );
}

/**
 * Produces a conservative comparison key for duplicate detection.
 * Hashes and non-tracking query parameters are intentionally retained because
 * they can represent meaningful page state.
 */
export function normalizeUrl(
  value?: string,
  options: UrlNormalizationOptions = {},
): string | null {
  const candidate = value?.trim();
  if (!candidate || shouldIgnoreUrl(candidate)) return null;

  try {
    const url = new URL(candidate);
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();

    const ignoredParameters = new Set(
      (options.ignoredQueryParameters ?? DEFAULT_TRACKING_PARAMETERS).map((name) =>
        name.toLowerCase(),
      ),
    );

    for (const name of [...url.searchParams.keys()]) {
      if (ignoredParameters.has(name.toLowerCase())) {
        url.searchParams.delete(name);
      }
    }

    if (
      options.stripTrailingSlash !== false &&
      url.pathname.length > 1 &&
      url.pathname.endsWith('/')
    ) {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }

    return url.toString();
  } catch {
    return candidate;
  }
}

export function getHostname(value?: string): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}
