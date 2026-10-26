import type {
  CaretakerState,
  DuplicateIntentExemption,
  TabActivityRecord,
} from './storage-schema';
import { normalizeUrl } from './url-normalization';

export type ObservedTab = {
  active?: boolean;
  id?: number;
  lastAccessed?: number;
  openerTabId?: number;
  title?: string;
  url?: string;
  windowId: number;
};

export function observeTab(
  state: CaretakerState,
  tab: ObservedTab,
  now = Date.now(),
): void {
  if (tab.id === undefined) return;
  const key = String(tab.id);
  const existing = state.tabActivity[key];
  state.tabActivity[key] = {
    createdAt: existing?.createdAt ?? now,
    createdFromUrl: existing?.createdFromUrl,
    createdWithoutUrl: existing?.createdWithoutUrl ?? !normalizeUrl(tab.url),
    duplicateAllowedUntil: existing?.duplicateAllowedUntil,
    lastActivatedAt: tab.active
      ? Math.max(existing?.lastActivatedAt ?? 0, tab.lastAccessed ?? now)
      : existing?.lastActivatedAt,
    lastSeenAt: now,
    openerTabId: tab.openerTabId ?? existing?.openerTabId,
    protectedByUser: existing?.protectedByUser ?? false,
    tabId: tab.id,
    title: tab.title ?? existing?.title,
    url: tab.url ?? existing?.url,
    wasCreatedActive: existing?.wasCreatedActive ?? Boolean(tab.active),
    windowId: tab.windowId,
  };
}

export function observeCreatedTab(
  state: CaretakerState,
  tab: ObservedTab,
  now = Date.now(),
): void {
  const source = Object.values(state.tabActivity)
    .filter(
      (record) =>
        record.tabId !== tab.id &&
        record.windowId === tab.windowId &&
        record.lastActivatedAt !== undefined,
    )
    .sort(
      (left, right) =>
        (right.lastActivatedAt ?? 0) - (left.lastActivatedAt ?? 0),
    )[0];
  observeTab(state, tab, now);
  if (tab.id !== undefined) {
    state.tabActivity[String(tab.id)]!.createdFromUrl = source?.url;
  }
}

export function markTabActivated(
  state: CaretakerState,
  tab: ObservedTab,
  now = Date.now(),
): void {
  observeTab(state, { ...tab, active: true, lastAccessed: now }, now);
}

export function removeTabActivity(state: CaretakerState, tabId: number): void {
  delete state.tabActivity[String(tabId)];
}

export function pruneTabActivity(
  state: CaretakerState,
  liveTabIds: ReadonlySet<number>,
): void {
  for (const record of Object.values(state.tabActivity)) {
    if (!liveTabIds.has(record.tabId)) removeTabActivity(state, record.tabId);
  }
}

export function setManualProtection(
  state: CaretakerState,
  tabId: number,
  protectedByUser: boolean,
): boolean {
  const record = state.tabActivity[String(tabId)];
  if (!record) return false;
  record.protectedByUser = protectedByUser;
  return true;
}

export function addDuplicateIntentExemption(
  state: CaretakerState,
  url: string,
  source: DuplicateIntentExemption['source'],
  now = Date.now(),
  ttlMs = 10_000,
): boolean {
  const normalizedUrl = normalizeUrl(url, {
    ignoredQueryParameters: state.settings.trackingParameters,
  });
  if (!normalizedUrl) return false;
  state.duplicateIntentExemptions.push({
    createdAt: now,
    expiresAt: now + ttlMs,
    normalizedUrl,
    source,
    usesRemaining: 1,
  });
  return true;
}

export function consumeDuplicateIntentExemption(
  state: CaretakerState,
  url: string,
  now = Date.now(),
): boolean {
  const normalizedUrl = normalizeUrl(url, {
    ignoredQueryParameters: state.settings.trackingParameters,
  });
  state.duplicateIntentExemptions = state.duplicateIntentExemptions.filter(
    (item) => item.expiresAt > now && item.usesRemaining > 0,
  );
  if (!normalizedUrl) return false;

  const exemption = state.duplicateIntentExemptions.find(
    (item) => item.normalizedUrl === normalizedUrl,
  );
  if (!exemption) return false;
  exemption.usesRemaining -= 1;
  state.duplicateIntentExemptions = state.duplicateIntentExemptions.filter(
    (item) => item.usesRemaining > 0,
  );
  return true;
}

export function getManuallyProtectedTabIds(
  records: Record<string, TabActivityRecord>,
): Set<number> {
  return new Set(
    Object.values(records)
      .filter((record) => record.protectedByUser)
      .map((record) => record.tabId),
  );
}
