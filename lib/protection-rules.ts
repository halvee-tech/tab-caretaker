import { getHostname } from './url-normalization';

export type ProtectableTab = {
  active?: boolean;
  audible?: boolean;
  id?: number;
  pinned?: boolean;
  url?: string;
};

export type ProtectionReason =
  | 'active'
  | 'audible'
  | 'domain-allowlist'
  | 'manual'
  | 'pinned'
  | 'restricted-page';

export type ProtectionOptions = {
  domainAllowlist?: readonly string[];
  manuallyProtectedTabIds?: ReadonlySet<number>;
};

function matchesAllowedDomain(hostname: string, rule: string): boolean {
  const normalizedRule = rule.trim().toLowerCase().replace(/^\*\./, '');
  return Boolean(
    normalizedRule &&
      (hostname === normalizedRule || hostname.endsWith(`.${normalizedRule}`)),
  );
}

export function isRestrictedPage(url?: string): boolean {
  if (!url) return true;
  return /^(chrome|chrome-extension|edge|about|devtools|file|view-source):/i.test(url);
}

export function getProtectionReasons(
  tab: ProtectableTab,
  options: ProtectionOptions = {},
): ProtectionReason[] {
  const reasons: ProtectionReason[] = [];
  if (tab.active) reasons.push('active');
  if (tab.pinned) reasons.push('pinned');
  if (tab.audible) reasons.push('audible');
  if (tab.id !== undefined && options.manuallyProtectedTabIds?.has(tab.id)) {
    reasons.push('manual');
  }

  const hostname = getHostname(tab.url);
  if (
    hostname &&
    options.domainAllowlist?.some((rule) => matchesAllowedDomain(hostname, rule))
  ) {
    reasons.push('domain-allowlist');
  }
  if (isRestrictedPage(tab.url)) reasons.push('restricted-page');
  return reasons;
}

export function isTabProtected(
  tab: ProtectableTab,
  options?: ProtectionOptions,
): boolean {
  return getProtectionReasons(tab, options).length > 0;
}
