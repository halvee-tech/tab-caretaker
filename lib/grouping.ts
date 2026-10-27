import { getHostname } from './url-normalization';

const COMPOUND_PUBLIC_SUFFIXES = new Set([
  'co.jp',
  'co.uk',
  'com.au',
  'com.cn',
  'com.hk',
  'com.sg',
  'com.tw',
]);

const GENERIC_SUBDOMAINS = new Set([
  'accounts',
  'admin',
  'api',
  'app',
  'console',
  'dashboard',
  'developer',
  'docs',
  'help',
  'm',
  'mail',
  'mobile',
  'mp',
  'support',
  'www',
]);

const NON_DESCRIPTIVE_SUBDOMAINS = new Set(['m', 'mobile', 'www']);

export type GroupingMode =
  | 'hostname'
  | 'registrable-domain'
  | 'third-level-domain';

function canonicalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '');
}

export function normalizeGroupingParentDomain(value: string): string {
  return canonicalizeHostname(value).replace(/^\*\./, '');
}

export function isGroupingParentDomain(value: string): boolean {
  const domain = normalizeGroupingParentDomain(value);
  if (!domain || COMPOUND_PUBLIC_SUFFIXES.has(domain)) return false;
  return /^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/i.test(domain);
}

export function normalizeGroupingParentDomains(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of values) {
    if (typeof item !== 'string') continue;
    const domain = normalizeGroupingParentDomain(item);
    if (!isGroupingParentDomain(domain) || seen.has(domain)) continue;
    seen.add(domain);
    result.push(domain);
  }
  return result;
}

export function formatGroupingParentDomains(values: readonly string[]): string {
  return normalizeGroupingParentDomains([...values])
    .map((domain) => `*.${domain}`)
    .join('\n');
}

function getModeGroupingKey(
  hostname: string,
  mode: GroupingMode,
): string {
  if (
    hostname === 'localhost' ||
    hostname === '::1' ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
  ) {
    return hostname;
  }

  const labels = hostname.split('.').filter(Boolean);
  if (labels.length < 2 || mode === 'hostname') return hostname;
  const suffixLength = COMPOUND_PUBLIC_SUFFIXES.has(labels.slice(-2).join('.'))
    ? 2
    : 1;
  const registrableIndex = Math.max(0, labels.length - suffixLength - 1);
  if (mode === 'registrable-domain') {
    return labels.slice(registrableIndex).join('.');
  }
  return labels.slice(Math.max(0, registrableIndex - 1)).join('.');
}

export function getGroupingKey(
  hostname: string,
  parentDomains: readonly string[] = [],
  mode: GroupingMode = 'hostname',
): string {
  const stripped = canonicalizeHostname(hostname).replace(/^www\./, '');
  const matches = normalizeGroupingParentDomains([...parentDomains]).filter(
    (domain) => stripped === domain || stripped.endsWith(`.${domain}`),
  );
  if (matches.length) {
    return matches.reduce((longest, domain) =>
      domain.length > longest.length ? domain : longest,
    );
  }
  return getModeGroupingKey(stripped, mode);
}

export type GroupableTab = {
  groupId?: number;
  id?: number;
  url?: string;
  windowId: number;
};

export type DomainGroupPlan = {
  hostname: string;
  tabIds: number[];
  targetGroupId?: number;
  windowId: number;
};

/**
 * Returns a new automatic title only while the group still has the last title
 * assigned by Tab Caretaker. A different current title belongs to the user.
 */
export function getManagedGroupTitleUpdate(
  currentTitle: string | undefined,
  lastManagedTitle: string | undefined,
  desiredTitle: string,
): string | undefined {
  if (lastManagedTitle === undefined || currentTitle !== lastManagedTitle) {
    return undefined;
  }
  return currentTitle === desiredTitle ? undefined : desiredTitle;
}

export function getDomainGroupLabel(hostname: string): string {
  const normalized = canonicalizeHostname(hostname);
  if (
    normalized === 'localhost' ||
    normalized === '::1' ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalized)
  ) {
    return 'local';
  }

  const labels = normalized.split('.').filter(Boolean);
  if (labels.length < 2) return labels[0] || 'tab';
  const suffixLength = COMPOUND_PUBLIC_SUFFIXES.has(labels.slice(-2).join('.'))
    ? 2
    : 1;
  const registrableIndex = Math.max(0, labels.length - suffixLength - 1);
  const registrableLabel = labels[registrableIndex]!;

  if (registrableLabel.length <= 3) {
    const descriptiveSubdomain = labels
      .slice(0, registrableIndex)
      .reverse()
      .find((label) => !GENERIC_SUBDOMAINS.has(label));
    if (descriptiveSubdomain) return descriptiveSubdomain;
  }
  return registrableLabel;
}

function getCollisionDiscriminator(hostname: string, baseLabel: string): string {
  const normalized = canonicalizeHostname(hostname);
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalized)) {
    return normalized.split('.')[0] || 'ip';
  }
  const labels = normalized.split('.').filter(Boolean);
  if (labels.length < 2) return normalized === 'localhost' ? 'host' : normalized;
  const suffixLength = COMPOUND_PUBLIC_SUFFIXES.has(labels.slice(-2).join('.'))
    ? 2
    : 1;
  const registrableIndex = Math.max(0, labels.length - suffixLength - 1);
  const subdomain = labels
    .slice(0, registrableIndex)
    .reverse()
    .find(
      (label) =>
        label !== baseLabel && !NON_DESCRIPTIVE_SUBDOMAINS.has(label),
    );
  return subdomain || labels.slice(-suffixLength).join('-');
}

export function getDomainGroupLabels(
  hostnames: readonly string[],
  parentDomains: readonly string[] = [],
): Map<string, string> {
  const parentKeys = new Set(normalizeGroupingParentDomains([...parentDomains]));
  const entries = [...new Set(hostnames.map((hostname) => hostname.toLowerCase()))].map(
    (hostname) => ({
      baseLabel: parentKeys.has(hostname) ? hostname : getDomainGroupLabel(hostname),
      hostname,
    }),
  );
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.baseLabel, (counts.get(entry.baseLabel) ?? 0) + 1);
  }

  return new Map(
    entries.map(({ baseLabel, hostname }) => [
      hostname,
      counts.get(baseLabel) === 1
        ? baseLabel
        : `${baseLabel}-${getCollisionDiscriminator(hostname, baseLabel)}`,
    ]),
  );
}

export function getDomainGroupPlan(
  tabs: readonly GroupableTab[],
  parentDomains: readonly string[] = [],
  mode: GroupingMode = 'hostname',
  ungroupedId = -1,
): DomainGroupPlan[] {
  const normalizedParents = normalizeGroupingParentDomains([...parentDomains]);
  const buckets = new Map<
    string,
    {
      groupingKey: string;
      tabs: Array<GroupableTab & { id: number }>;
    }
  >();
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    const hostname = getHostname(tab.url);
    if (!hostname) continue;
    const groupingKey = getGroupingKey(hostname, normalizedParents, mode);
    const key = `${tab.windowId}:${groupingKey}`;
    const bucket = buckets.get(key) ?? { groupingKey, tabs: [] };
    bucket.tabs.push(tab as GroupableTab & { id: number });
    buckets.set(key, bucket);
  }

  const bucketCountsByGroup = new Map<number, Map<string, number>>();
  for (const [bucketKey, bucket] of buckets) {
    for (const tab of bucket.tabs) {
      const groupId = tab.groupId ?? ungroupedId;
      if (groupId === ungroupedId) continue;
      const counts = bucketCountsByGroup.get(groupId) ?? new Map<string, number>();
      counts.set(bucketKey, (counts.get(bucketKey) ?? 0) + 1);
      bucketCountsByGroup.set(groupId, counts);
    }
  }
  const reusableBucketByGroup = new Map<number, string>();
  for (const [groupId, counts] of bucketCountsByGroup) {
    const bucketKey = [...counts].sort(
      ([leftKey, leftCount], [rightKey, rightCount]) =>
        rightCount - leftCount || leftKey.localeCompare(rightKey),
    )[0]?.[0];
    if (bucketKey) reusableBucketByGroup.set(groupId, bucketKey);
  }

  const plan: DomainGroupPlan[] = [];
  for (const [bucketKey, bucket] of buckets) {
    const existingCounts = new Map<number, number>();
    for (const tab of bucket.tabs) {
      const groupId = tab.groupId ?? ungroupedId;
      if (
        groupId === ungroupedId ||
        reusableBucketByGroup.get(groupId) !== bucketKey
      ) {
        continue;
      }
      existingCounts.set(groupId, (existingCounts.get(groupId) ?? 0) + 1);
    }
    const targetGroupId = [...existingCounts.entries()].sort(
      ([leftId, leftCount], [rightId, rightCount]) =>
        rightCount - leftCount || leftId - rightId,
    )[0]?.[0];
    const tabIds = bucket.tabs
      .filter((tab) => (tab.groupId ?? ungroupedId) !== targetGroupId)
      .map((tab) => tab.id);
    if (!tabIds.length) continue;
    plan.push({
      hostname: bucket.groupingKey,
      tabIds,
      targetGroupId,
      windowId: bucket.tabs[0]!.windowId,
    });
  }
  return plan;
}
