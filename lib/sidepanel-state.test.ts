import { describe, expect, it } from 'vitest';
import {
  getOpenSidePanelWindowIds,
  isSidePanelOpenInWindow,
} from './sidepanel-state';

describe('side panel window state', () => {
  it('keeps unique integer window ids only', () => {
    expect(getOpenSidePanelWindowIds([1, 2, 2, '3', 4.5, null])).toEqual([1, 2]);
  });

  it('reports whether the current window has an open panel', () => {
    expect(isSidePanelOpenInWindow([3, 7], 7)).toBe(true);
    expect(isSidePanelOpenInWindow([3, 7], 8)).toBe(false);
  });
});
