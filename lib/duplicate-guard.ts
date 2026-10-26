import type { TabActivityRecord } from './storage-schema';

export const DEFAULT_DUPLICATE_GUARD_WINDOW_MS = 15_000;

export function shouldPreserveDuplicate(
  activity: TabActivityRecord | undefined,
  explicitlyAllowed: boolean,
  now = Date.now(),
  guardWindowMs = DEFAULT_DUPLICATE_GUARD_WINDOW_MS,
): boolean {
  if (explicitlyAllowed) return true;
  if (!activity || now - activity.createdAt > guardWindowMs) return true;
  return false;
}

export function isOlderDuplicateCandidate(
  candidate: TabActivityRecord | undefined,
  candidateTabId: number,
  current: TabActivityRecord,
  currentTabId: number,
): boolean {
  // Chrome tab ids increase over time. If an onUpdated event races ahead of the
  // candidate's activity write, use the id as the safe creation-order fallback
  // instead of allowing the older tab to close itself in favor of a newer one.
  if (!candidate) return candidateTabId < currentTabId;
  if (candidate.createdAt !== current.createdAt) {
    return candidate.createdAt < current.createdAt;
  }
  return candidateTabId < currentTabId;
}
