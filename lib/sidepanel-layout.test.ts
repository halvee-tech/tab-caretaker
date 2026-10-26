import { describe, expect, it } from 'vitest';
import { buildSidePanelWindows } from './sidepanel-layout';

describe('side panel layout', () => {
  it('renders grouped and ungrouped tabs as separate collections', () => {
    const [window] = buildSidePanelWindows(
      [
        { groupId: 7, id: 1, index: 2, windowId: 1 },
        { groupId: -1, id: 2, index: 0, windowId: 1 },
        { groupId: 7, id: 3, index: 1, windowId: 1 },
      ],
      [{ id: 7, title: 'work' }],
      1,
    );

    expect(window?.groups[0]?.tabs.map((tab) => tab.id)).toEqual([3, 1]);
    expect(window?.ungrouped.map((tab) => tab.id)).toEqual([2]);
  });

  it('puts the current window first', () => {
    const windows = buildSidePanelWindows(
      [
        { groupId: -1, id: 1, index: 0, windowId: 1 },
        { groupId: -1, id: 2, index: 0, windowId: 2 },
      ],
      [],
      2,
    );

    expect(windows.map((window) => window.id)).toEqual([2, 1]);
  });
});
