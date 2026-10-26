import { describe, expect, it } from 'vitest';
import { getDuplicateCleanupPlan } from './deduplication';

describe('duplicate cleanup planning', () => {
  it('keeps the active duplicate and closes the other copies', () => {
    const plan = getDuplicateCleanupPlan([
      { id: 1, lastAccessed: 300, url: 'https://example.com/article', windowId: 1 },
      { active: true, id: 2, lastAccessed: 100, url: 'https://example.com/article', windowId: 1 },
      { id: 3, lastAccessed: 200, url: 'https://example.com/article', windowId: 2 },
    ]);

    expect(plan.keeperTabIds).toEqual([2]);
    expect(plan.closeTabIds).toEqual([1, 3]);
  });

  it('never closes another protected duplicate', () => {
    const plan = getDuplicateCleanupPlan([
      { active: true, id: 1, url: 'https://example.com', windowId: 1 },
      { id: 2, pinned: true, url: 'https://example.com', windowId: 1 },
      { id: 3, url: 'https://example.com', windowId: 1 },
    ]);

    expect(plan.closeTabIds).toEqual([3]);
    expect(plan.skippedProtectedCount).toBe(1);
  });

  it('uses configured tracking parameters when finding duplicates', () => {
    const plan = getDuplicateCleanupPlan(
      [
        { active: true, id: 1, url: 'https://example.com/a?from=feed', windowId: 1 },
        { id: 2, url: 'https://example.com/a?from=search', windowId: 1 },
      ],
      {},
      ['from'],
    );

    expect(plan.closeTabIds).toEqual([2]);
  });
});
