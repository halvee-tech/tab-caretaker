import { describe, expect, it } from 'vitest';
import { isOlderDuplicateCandidate, shouldPreserveDuplicate } from './duplicate-guard';
import type { TabActivityRecord } from './storage-schema';

const base: TabActivityRecord = {
  createdAt: 100,
  createdWithoutUrl: false,
  lastSeenAt: 100,
  protectedByUser: false,
  tabId: 1,
  wasCreatedActive: false,
  windowId: 1,
};

describe('duplicate guard intent', () => {
  it('preserves only duplicates with an explicit exemption', () => {
    expect(shouldPreserveDuplicate(base, true, 110)).toBe(true);
  });

  it('guards a blank tab unless navigation supplied an explicit intent signal', () => {
    expect(
      shouldPreserveDuplicate(
        { ...base, createdWithoutUrl: true, wasCreatedActive: false },
        false,
        110,
      ),
    ).toBe(false);
  });

  it('allows guarding a fresh externally opened duplicate', () => {
    expect(shouldPreserveDuplicate(base, false, 110)).toBe(false);
  });

  it('guards a fresh duplicate opened from another page', () => {
    expect(shouldPreserveDuplicate({ ...base, openerTabId: 2 }, false, 110)).toBe(false);
  });

  it('never closes a long-lived tab that navigates to an existing address', () => {
    expect(shouldPreserveDuplicate(base, false, 20_000)).toBe(true);
  });
});

describe('duplicate keeper ordering', () => {
  const current: TabActivityRecord = { ...base, createdAt: 200, tabId: 20 };

  it('keeps the earlier-created tab even when it finishes loading later', () => {
    expect(
      isOlderDuplicateCandidate({ ...base, createdAt: 100, tabId: 10 }, 10, current, 20),
    ).toBe(true);
    expect(
      isOlderDuplicateCandidate({ ...base, createdAt: 300, tabId: 30 }, 30, current, 20),
    ).toBe(false);
  });

  it('uses the tab id as a deterministic tie-breaker', () => {
    expect(isOlderDuplicateCandidate({ ...current, tabId: 10 }, 10, current, 20)).toBe(true);
    expect(isOlderDuplicateCandidate({ ...current, tabId: 30 }, 30, current, 20)).toBe(false);
  });

  it('uses the tab id when the candidate activity write is still pending', () => {
    expect(isOlderDuplicateCandidate(undefined, 10, current, 20)).toBe(true);
    expect(isOlderDuplicateCandidate(undefined, 30, current, 20)).toBe(false);
  });
});
