import { describe, expect, it } from 'vitest';
import {
  addDuplicateIntentExemption,
  consumeDuplicateIntentExemption,
  markTabActivated,
  observeCreatedTab,
  observeTab,
  pruneTabActivity,
} from './tab-activity';
import { createDefaultState } from './storage-schema';

describe('tab activity', () => {
  it('retains creation time while refreshing observed metadata', () => {
    const state = createDefaultState();
    observeTab(state, { id: 3, title: 'First', windowId: 1 }, 100);
    state.tabActivity['3']!.duplicateAllowedUntil = 500;
    observeTab(state, { id: 3, title: 'Updated', windowId: 2 }, 200);
    expect(state.tabActivity['3']).toMatchObject({
      createdAt: 100,
      duplicateAllowedUntil: 500,
      lastSeenAt: 200,
      title: 'Updated',
      windowId: 2,
    });
  });

  it('prunes records for tabs that are no longer open', () => {
    const state = createDefaultState();
    observeTab(state, { id: 1, windowId: 1 }, 100);
    observeTab(state, { id: 2, windowId: 1 }, 100);
    pruneTabActivity(state, new Set([2]));
    expect(Object.keys(state.tabActivity)).toEqual(['2']);
  });

  it('treats browser new-tab pages as created without a web address', () => {
    const state = createDefaultState();
    observeTab(
      state,
      { active: true, id: 3, url: 'chrome://newtab/', windowId: 1 },
      100,
    );
    expect(state.tabActivity['3']).toMatchObject({
      createdWithoutUrl: true,
      wasCreatedActive: true,
    });
  });

  it('remembers the page active immediately before a new tab was created', () => {
    const state = createDefaultState();
    observeTab(state, { id: 1, url: 'https://example.com/source', windowId: 1 }, 100);
    markTabActivated(
      state,
      { id: 1, url: 'https://example.com/source', windowId: 1 },
      110,
    );
    observeCreatedTab(
      state,
      { active: true, id: 2, url: 'chrome://newtab/', windowId: 1 },
      120,
    );

    expect(state.tabActivity['2']?.createdFromUrl).toBe('https://example.com/source');
  });

  it('consumes a short-lived duplicate exemption once', () => {
    const state = createDefaultState();
    addDuplicateIntentExemption(state, 'https://example.com/', 'user-action', 100, 50);
    expect(consumeDuplicateIntentExemption(state, 'https://example.com/', 120)).toBe(true);
    expect(consumeDuplicateIntentExemption(state, 'https://example.com/', 130)).toBe(false);
  });
});
