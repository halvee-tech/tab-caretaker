import { describe, expect, it } from 'vitest';
import { getTabInsights, getTabSuggestions } from './tab-insights';

const DAY = 24 * 60 * 60 * 1_000;

describe('tab insights', () => {
  it('counts normalized duplicates and excludes protected tabs from stale totals', () => {
    const now = 20 * DAY;
    const tabs = [
      { active: true, id: 1, lastAccessed: now, url: 'https://example.com/page/', windowId: 1 },
      { id: 2, lastAccessed: now - DAY, url: 'https://example.com/page?utm_source=x', windowId: 1 },
      { id: 3, lastAccessed: now - 15 * DAY, url: 'https://old.example.org', windowId: 2 },
    ];
    expect(getTabInsights(tabs, now, 14)).toMatchObject({
      duplicateCount: 1,
      protectedCount: 1,
      staleCount: 1,
      tabCount: 3,
      windowCount: 2,
    });
  });

  it('suggests expendable duplicates before stale tabs', () => {
    const now = 20 * DAY;
    const suggestions = getTabSuggestions(
      [
        { active: true, id: 1, lastAccessed: now, title: 'Keep', url: 'https://example.com', windowId: 1 },
        { id: 2, lastAccessed: now - DAY, title: 'Copy', url: 'https://example.com/', windowId: 1 },
        { id: 3, lastAccessed: now - 15 * DAY, title: 'Old', url: 'https://old.example.com', windowId: 1 },
      ],
      now,
      14,
    );
    expect(suggestions.map((item) => item.kind)).toEqual(['duplicate', 'stale']);
    expect(suggestions.map((item) => item.title)).toEqual(['Copy', 'Old']);
    expect(suggestions.map((item) => item.windowId)).toEqual([1, 1]);
  });
});
