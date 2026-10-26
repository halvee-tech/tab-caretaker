export type SidePanelTabLike = {
  groupId?: number;
  id?: number;
  index: number;
  windowId: number;
};

export type SidePanelGroupLike = {
  id: number;
};

export type SidePanelWindow<
  Tab extends SidePanelTabLike,
  Group extends SidePanelGroupLike,
> = {
  groups: Array<{ group: Group; tabs: Tab[] }>;
  id: number;
  ungrouped: Tab[];
};

export function buildSidePanelWindows<
  Tab extends SidePanelTabLike,
  Group extends SidePanelGroupLike,
>(
  tabs: readonly Tab[],
  groups: readonly Group[],
  currentWindowId?: number,
): Array<SidePanelWindow<Tab, Group>> {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const windowsById = new Map<number, SidePanelWindow<Tab, Group>>();
  for (const tab of tabs) {
    const entry = windowsById.get(tab.windowId) ?? {
      groups: [],
      id: tab.windowId,
      ungrouped: [],
    };
    const group =
      tab.groupId !== undefined && tab.groupId >= 0
        ? groupsById.get(tab.groupId)
        : undefined;
    if (!group) {
      entry.ungrouped.push(tab);
    } else {
      let groupEntry = entry.groups.find((item) => item.group.id === group.id);
      if (!groupEntry) {
        groupEntry = { group, tabs: [] };
        entry.groups.push(groupEntry);
      }
      groupEntry.tabs.push(tab);
    }
    windowsById.set(tab.windowId, entry);
  }

  return [...windowsById.values()]
    .map((window) => ({
      ...window,
      groups: window.groups
        .map((group) => ({
          ...group,
          tabs: [...group.tabs].sort((left, right) => left.index - right.index),
        }))
        .sort(
          (left, right) =>
            (left.tabs[0]?.index ?? 0) - (right.tabs[0]?.index ?? 0),
        ),
      ungrouped: [...window.ungrouped].sort(
        (left, right) => left.index - right.index,
      ),
    }))
    .sort(
      (left, right) =>
        Number(right.id === currentWindowId) - Number(left.id === currentWindowId) ||
        left.id - right.id,
    );
}
