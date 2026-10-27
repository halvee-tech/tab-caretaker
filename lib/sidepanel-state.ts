export const SIDE_PANEL_WINDOWS_KEY = 'sidePanelOpenWindowIds';

export function getOpenSidePanelWindowIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value.filter((windowId): windowId is number =>
      typeof windowId === 'number' && Number.isInteger(windowId),
    ),
  )];
}

export function isSidePanelOpenInWindow(
  value: unknown,
  windowId: number,
): boolean {
  return getOpenSidePanelWindowIds(value).includes(windowId);
}
