import { isTabProtected, type ProtectionOptions } from './protection-rules';
import { normalizeUrl } from './url-normalization';

export type DeduplicableTab = {
  active?: boolean;
  audible?: boolean;
  id?: number;
  lastAccessed?: number;
  pinned?: boolean;
  url?: string;
  windowId: number;
};

export type DuplicateCleanupPlan = {
  closeTabIds: number[];
  keeperTabIds: number[];
  skippedProtectedCount: number;
};

function compareKeepPriority(
  left: DeduplicableTab,
  right: DeduplicableTab,
  protectionOptions: ProtectionOptions,
): number {
  const activeDifference = Number(Boolean(right.active)) - Number(Boolean(left.active));
  if (activeDifference) return activeDifference;

  const protectionDifference =
    Number(isTabProtected(right, protectionOptions)) -
    Number(isTabProtected(left, protectionOptions));
  if (protectionDifference) return protectionDifference;

  const accessDifference = (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0);
  if (accessDifference) return accessDifference;
  return (left.id ?? Number.MAX_SAFE_INTEGER) - (right.id ?? Number.MAX_SAFE_INTEGER);
}

export function getDuplicateCleanupPlan(
  tabs: readonly DeduplicableTab[],
  protectionOptions: ProtectionOptions = {},
  ignoredQueryParameters?: readonly string[],
): DuplicateCleanupPlan {
  const groups = new Map<string, DeduplicableTab[]>();
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    const normalizedUrl = normalizeUrl(tab.url, { ignoredQueryParameters });
    if (!normalizedUrl) continue;
    const group = groups.get(normalizedUrl) ?? [];
    group.push(tab);
    groups.set(normalizedUrl, group);
  }

  const closeTabIds: number[] = [];
  const keeperTabIds: number[] = [];
  let skippedProtectedCount = 0;

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const [keeper, ...duplicates] = [...group].sort((left, right) =>
      compareKeepPriority(left, right, protectionOptions),
    );
    if (keeper?.id !== undefined) keeperTabIds.push(keeper.id);
    for (const tab of duplicates) {
      if (tab.id === undefined) continue;
      if (isTabProtected(tab, protectionOptions)) {
        skippedProtectedCount += 1;
      } else {
        closeTabIds.push(tab.id);
      }
    }
  }

  return { closeTabIds, keeperTabIds, skippedProtectedCount };
}
