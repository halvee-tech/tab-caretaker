import { describe, expect, it } from 'vitest';
import { addArchive, isUndoableAction, markActionUndone, markArchiveRestored } from './archive';
import { createDefaultState } from './storage-schema';

describe('archive state', () => {
  it('archives before recording a reversible action', () => {
    const state = createDefaultState();
    const archive = addArchive(
      state,
      { id: 4, index: 2, title: 'Old tab', url: 'https://example.com', windowId: 1 },
      'stale',
      100,
    );
    expect(archive?.reason).toBe('stale');
    expect(state.archives).toHaveLength(1);
    expect(state.actionHistory[0]).toMatchObject({ archiveId: archive?.id, type: 'archive' });
  });

  it('marks restoration and undo without deleting history', () => {
    const state = createDefaultState();
    const archive = addArchive(
      state,
      { id: 4, index: 0, url: 'https://example.com', windowId: 1 },
      'manual',
      100,
    )!;
    const actionId = state.actionHistory[0]!.id;
    markArchiveRestored(state, archive.id, 9, 200);
    expect(state.archives[0]).toMatchObject({ restoredAt: 200, restoredTabId: 9 });
    expect(markActionUndone(state, actionId, 300)).toBe(true);
    expect(state.actionHistory.find((item) => item.id === actionId)?.undoneAt).toBe(300);
  });

  it('can archive several tabs under one deduplication action', () => {
    const state = createDefaultState();
    const archive = addArchive(
      state,
      { id: 4, index: 0, url: 'https://example.com', windowId: 1 },
      'duplicate-cleanup',
      100,
      false,
    );

    expect(archive).not.toBeNull();
    expect(state.actionHistory).toHaveLength(0);
    expect(isUndoableAction('deduplicate')).toBe(true);
  });
});
