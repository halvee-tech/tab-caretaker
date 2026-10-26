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

export function getDomainGroupLabel(hostname: string): string {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
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
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
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
): Map<string, string> {
  const entries = [...new Set(hostnames.map((hostname) => hostname.toLowerCase()))].map(
    (hostname) => ({ baseLabel: getDomainGroupLabel(hostname), hostname }),
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
  ungroupedId = -1,
): DomainGroupPlan[] {
  const buckets = new Map<string, Array<GroupableTab & { id: number }>>();
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    const hostname = getHostname(tab.url);
    if (!hostname) continue;
    const key = `${tab.windowId}:${hostname}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(tab as GroupableTab & { id: number });
    buckets.set(key, bucket);
  }

  const plan: DomainGroupPlan[] = [];
  for (const bucket of buckets.values()) {
    const existingCounts = new Map<number, number>();
    for (const tab of bucket) {
      const groupId = tab.groupId ?? ungroupedId;
      if (groupId === ungroupedId) continue;
      existingCounts.set(groupId, (existingCounts.get(groupId) ?? 0) + 1);
    }
    const targetGroupId = [...existingCounts.entries()].sort(
      ([leftId, leftCount], [rightId, rightCount]) =>
        rightCount - leftCount || leftId - rightId,
    )[0]?.[0];
    const tabIds = bucket
      .filter((tab) => (tab.groupId ?? ungroupedId) !== targetGroupId)
      .map((tab) => tab.id);
    if (!tabIds.length) continue;
    plan.push({
      hostname: getHostname(bucket[0]!.url)!,
      tabIds,
      targetGroupId,
      windowId: bucket[0]!.windowId,
    });
  }
  return plan;
}
