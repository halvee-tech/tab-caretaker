export const DEFAULT_STALE_AFTER_DAYS = 3;

import { isTabProtected, type ProtectionOptions } from './protection-rules';
import { getHostname, normalizeUrl } from './url-normalization';

export type TabLike = {
  active?: boolean;
  audible?: boolean;
  id?: number;
  lastAccessed?: number;
  pinned?: boolean;
  title?: string;
  url?: string;
  windowId: number;
};

export type TabInsights = {
  duplicateCount: number;
  protectedCount: number;
  staleCount: number;
  tabCount: number;
  windowCount: number;
};

export type TabSuggestion = {
  hostname: string;
  kind: 'duplicate' | 'stale';
  tabId?: number;
  title: string;
  windowId: number;
};

export function getTabInsights(
  tabs: readonly TabLike[],
  now = Date.now(),
  staleAfterDays = DEFAULT_STALE_AFTER_DAYS,
  protectionOptions: ProtectionOptions = {},
  ignoredQueryParameters?: readonly string[],
): TabInsights {
  const seenUrls = new Set<string>();
  const staleBefore = now - staleAfterDays * 24 * 60 * 60 * 1_000;
  let duplicateCount = 0;
  let protectedCount = 0;
  let staleCount = 0;

  for (const tab of tabs) {
    const normalizedUrl = normalizeUrl(tab.url, { ignoredQueryParameters });
    if (normalizedUrl) {
      if (seenUrls.has(normalizedUrl)) duplicateCount += 1;
      else seenUrls.add(normalizedUrl);
    }

    const isProtected = isTabProtected(tab, protectionOptions);
    if (isProtected) protectedCount += 1;
    if (!isProtected && tab.lastAccessed && tab.lastAccessed < staleBefore) {
      staleCount += 1;
    }
  }

  return {
    duplicateCount,
    protectedCount,
    staleCount,
    tabCount: tabs.length,
    windowCount: new Set(tabs.map((tab) => tab.windowId)).size,
  };
}

export function getTabSuggestions(
  tabs: readonly TabLike[],
  now = Date.now(),
  staleAfterDays = DEFAULT_STALE_AFTER_DAYS,
  protectionOptions: ProtectionOptions = {},
  ignoredQueryParameters?: readonly string[],
): TabSuggestion[] {
  const staleBefore = now - staleAfterDays * 24 * 60 * 60 * 1_000;
  const duplicateGroups = new Map<string, TabLike[]>();

  for (const tab of tabs) {
    const key = normalizeUrl(tab.url, { ignoredQueryParameters });
    if (!key) continue;
    const group = duplicateGroups.get(key) ?? [];
    group.push(tab);
    duplicateGroups.set(key, group);
  }

  const duplicateSuggestions: TabSuggestion[] = [];
  for (const group of duplicateGroups.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((left, right) => {
      const protectionDifference =
        Number(isTabProtected(right, protectionOptions)) -
        Number(isTabProtected(left, protectionOptions));
      return protectionDifference || (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0);
    });
    for (const tab of sorted.slice(1)) {
      if (isTabProtected(tab, protectionOptions)) continue;
      duplicateSuggestions.push(toSuggestion(tab, 'duplicate'));
    }
  }

  const duplicateIds = new Set(duplicateSuggestions.map((item) => item.tabId));
  const staleSuggestions = tabs
    .filter(
      (tab) =>
        !duplicateIds.has(tab.id) &&
        !isTabProtected(tab, protectionOptions) &&
        Boolean(tab.lastAccessed && tab.lastAccessed < staleBefore),
    )
    .sort((left, right) => (left.lastAccessed ?? 0) - (right.lastAccessed ?? 0))
    .map((tab) => toSuggestion(tab, 'stale'));

  return [...duplicateSuggestions, ...staleSuggestions];
}

function toSuggestion(tab: TabLike, kind: TabSuggestion['kind']): TabSuggestion {
  return {
    hostname: getHostname(tab.url) ?? '未知页面',
    kind,
    tabId: tab.id,
    title: tab.title?.trim() || getHostname(tab.url) || '未命名标签页',
    windowId: tab.windowId,
  };
}
