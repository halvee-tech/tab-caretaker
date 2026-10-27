import { addArchive, markActionUndone, markArchiveRestored, recordAction } from '@/lib/archive';
import {
  DEFAULT_DUPLICATE_GUARD_WINDOW_MS,
  isOlderDuplicateCandidate,
  shouldPreserveDuplicate,
} from '@/lib/duplicate-guard';
import { getDuplicateCleanupPlan } from '@/lib/deduplication';
import {
  getDomainGroupLabel,
  getDomainGroupLabels,
  getDomainGroupPlan,
  getManagedGroupTitleUpdate,
} from '@/lib/grouping';
import type { CaretakerMessage, CaretakerResponse } from '@/lib/messages';
import { isDeliberateCurrentPageCopy } from '@/lib/navigation-intent';
import { isTabProtected } from '@/lib/protection-rules';
import {
  getOpenSidePanelWindowIds,
  SIDE_PANEL_WINDOWS_KEY,
} from '@/lib/sidepanel-state';
import {
  addDuplicateIntentExemption,
  consumeDuplicateIntentExemption,
  getManuallyProtectedTabIds,
  markTabActivated,
  observeCreatedTab,
  observeTab,
  pruneTabActivity,
  removeTabActivity,
  setManualProtection,
} from '@/lib/tab-activity';
import {
  migrateStoredState,
  STORAGE_KEY,
  type ActionRecord,
  type ArchiveReason,
  type CaretakerState,
  updateUserSettings,
} from '@/lib/storage-schema';
import { getHostname, normalizeUrl } from '@/lib/url-normalization';

const MAINTENANCE_ALARM = 'tab-caretaker-maintenance';
const MENU_DUPLICATE = 'tab-caretaker-duplicate';
const MENU_PROTECT = 'tab-caretaker-protect';
const MENU_ARCHIVE = 'tab-caretaker-archive';
const MANAGED_GROUP_TITLES_KEY = 'managedGroupTitles';

let stateUpdateQueue: Promise<void> = Promise.resolve();
let groupingQueue: Promise<void> = Promise.resolve();
let sidePanelStateQueue: Promise<void> = Promise.resolve();
let duplicateFeedbackUntil = 0;

function sanitizeManagedGroupTitles(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([groupId, title]) => /^\d+$/.test(groupId) && typeof title === 'string',
    ),
  );
}

async function readManagedGroupTitles(): Promise<Record<string, string>> {
  const stored = await browser.storage.session.get(MANAGED_GROUP_TITLES_KEY);
  return sanitizeManagedGroupTitles(stored[MANAGED_GROUP_TITLES_KEY]);
}

async function rememberManagedGroupTitle(
  groupId: number,
  title: string,
): Promise<void> {
  const titles = await readManagedGroupTitles();
  titles[String(groupId)] = title;
  await browser.storage.session.set({ [MANAGED_GROUP_TITLES_KEY]: titles });
}

async function readOpenSidePanelWindowIds(): Promise<Set<number>> {
  const stored = await browser.storage.session.get(SIDE_PANEL_WINDOWS_KEY);
  return new Set(getOpenSidePanelWindowIds(stored[SIDE_PANEL_WINDOWS_KEY]));
}

function setSidePanelOpen(windowId: number, open: boolean): Promise<void> {
  const operation = sidePanelStateQueue.catch(() => undefined).then(async () => {
    const windowIds = await readOpenSidePanelWindowIds();
    if (open) windowIds.add(windowId);
    else windowIds.delete(windowId);
    await browser.storage.session.set({
      [SIDE_PANEL_WINDOWS_KEY]: [...windowIds],
    });
  });
  sidePanelStateQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

async function readState(): Promise<CaretakerState> {
  const stored = (await browser.storage.local.get([
    STORAGE_KEY,
    'settings',
  ])) as Record<string, unknown>;
  return migrateStoredState(stored);
}

function updateState<T>(
  mutator: (state: CaretakerState) => T | Promise<T>,
): Promise<T> {
  const operation = stateUpdateQueue.catch(() => undefined).then(async () => {
    const state = await readState();
    const result = await mutator(state);
    await browser.storage.local.set({ [STORAGE_KEY]: state });
    return result;
  });
  stateUpdateQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

async function reconcileOpenTabs(): Promise<void> {
  const tabs = await browser.tabs.query({});
  await updateState((state) => {
    const now = Date.now();
    for (const tab of tabs) {
      const wasAlreadyTracked = Boolean(
        tab.id !== undefined && state.tabActivity[String(tab.id)],
      );
      observeTab(state, tab, now);
      if (!wasAlreadyTracked && tab.id !== undefined) {
        // Tabs discovered during startup are not newly opened. Marking them old
        // prevents a later loading event from treating them as fresh duplicates.
        state.tabActivity[String(tab.id)]!.createdAt = 0;
      }
    }
    pruneTabActivity(
      state,
      new Set(tabs.flatMap((tab) => (tab.id === undefined ? [] : [tab.id]))),
    );
  });
}

async function archiveTab(tabId: number, reason: ArchiveReason): Promise<boolean> {
  const tab = await browser.tabs.get(tabId);
  if (reason === 'stale' || reason === 'manual') {
    const current = await readState();
    const protectedTab = isTabProtected(tab, {
      domainAllowlist: current.settings.domainAllowlist,
      manuallyProtectedTabIds: getManuallyProtectedTabIds(current.tabActivity),
    });
    if (protectedTab) return false;
    if (reason === 'stale') {
      const staleBefore =
        Date.now() - current.settings.staleAfterDays * 24 * 60 * 60 * 1_000;
      if (!tab.lastAccessed || tab.lastAccessed >= staleBefore) return false;
    }
  }
  const archive = await updateState((state) => addArchive(state, tab, reason));
  if (!archive) return false;
  await browser.tabs.remove(tabId);
  return true;
}

async function restoreArchive(archiveId: string): Promise<boolean> {
  const state = await readState();
  const archive = state.archives.find((item) => item.id === archiveId);
  if (!archive) return false;

  if (archive.reason === 'duplicate-guard' || archive.reason === 'duplicate-cleanup') {
    await updateState((current) =>
      addDuplicateIntentExemption(current, archive.url, 'user-action'),
    );
  }

  let windowId: number | undefined;
  try {
    await browser.windows.get(archive.windowId);
    windowId = archive.windowId;
  } catch {
    windowId = undefined;
  }

  const tab = await browser.tabs.create({
    active: true,
    index: windowId === undefined ? undefined : archive.index,
    pinned: archive.pinned,
    url: archive.url,
    windowId,
  });
  if (tab.id === undefined) return false;
  await updateState((current) => {
    markArchiveRestored(current, archiveId, tab.id!);
    observeTab(current, tab);
  });
  return true;
}

async function undoAction(actionId: string): Promise<boolean> {
  const state = await readState();
  const action = state.actionHistory.find((item) => item.id === actionId);
  if (!action || action.undoneAt) return false;

  if ((action.type === 'archive' || action.type === 'duplicate-focus') && action.archiveId) {
    const restored = await restoreArchive(action.archiveId);
    if (!restored) return false;
  } else if (action.type === 'deduplicate' && action.archiveIds?.length) {
    for (const archiveId of [...action.archiveIds].reverse()) {
      const restored = await restoreArchive(archiveId);
      if (!restored) return false;
    }
  } else if (action.type === 'group' && action.tabIds?.length) {
    const liveTabs = await browser.tabs.query({});
    const liveTabIds = new Set(
      liveTabs.flatMap((tab) => (tab.id === undefined ? [] : [tab.id])),
    );
    const movedTabIds = action.tabIds.filter((tabId) => liveTabIds.has(tabId));
    if (movedTabIds.length) {
      await browser.tabs.ungroup(movedTabIds as [number, ...number[]]);
    }
    for (const previous of action.previousGroups ?? []) {
      const tabIds = previous.tabIds.filter((tabId) => liveTabIds.has(tabId));
      if (!tabIds.length) continue;
      const restoredGroupId = await browser.tabs.group({
        createProperties: { windowId: previous.windowId },
        tabIds: tabIds as [number, ...number[]],
      });
      await browser.tabGroups.update(restoredGroupId, {
        collapsed: previous.collapsed,
        color: previous.color,
        title: previous.title,
      });
    }
  } else {
    return false;
  }

  await updateState((current) => markActionUndone(current, actionId));
  return true;
}

async function deduplicateExistingTabs(): Promise<number> {
  const tabs = await browser.tabs.query({});
  const state = await readState();
  const plan = getDuplicateCleanupPlan(
    tabs,
    {
      domainAllowlist: state.settings.domainAllowlist,
      manuallyProtectedTabIds: getManuallyProtectedTabIds(state.tabActivity),
    },
    state.settings.trackingParameters,
  );
  if (!plan.closeTabIds.length) return 0;

  const closeTabIds = new Set(plan.closeTabIds);
  const candidates = tabs.filter(
    (tab): tab is Browser.tabs.Tab & { id: number } =>
      tab.id !== undefined && closeTabIds.has(tab.id),
  );
  const archiveIds = await updateState((current) => {
    const now = Date.now();
    const ids = candidates.flatMap((tab) => {
      const archive = addArchive(current, tab, 'duplicate-cleanup', now, false);
      return archive ? [archive.id] : [];
    });
    if (ids.length) {
      recordAction(current, {
        archiveIds: ids,
        createdAt: now,
        description: `已清理 ${ids.length} 个重复标签`,
        tabIds: candidates.map((tab) => tab.id),
        type: 'deduplicate',
      });
    }
    return ids;
  });
  if (!archiveIds.length) return 0;

  await browser.tabs.remove(candidates.map((tab) => tab.id) as [number, ...number[]]);
  return candidates.length;
}

async function performGroupByDomain(
  focusTabId?: number,
  recordHistory = true,
): Promise<number> {
  const tabs = await browser.tabs.query({});
  const plan = getDomainGroupPlan(tabs).filter(
    (group) => focusTabId === undefined || group.tabIds.includes(focusTabId),
  );
  let affectedCount = 0;
  for (const group of plan) {
    const tabIds = group.tabIds as [number, ...number[]];
    const previousGroupIds = new Set(
      tabs.flatMap((tab) =>
        tab.id !== undefined &&
        group.tabIds.includes(tab.id) &&
        tab.groupId !== undefined &&
        tab.groupId >= 0
          ? [tab.groupId]
          : [],
      ),
    );
    const previousGroups = await Promise.all(
      [...previousGroupIds].map(async (groupId) => {
        const details = await browser.tabGroups.get(groupId);
        return {
          collapsed: details.collapsed,
          color: details.color,
          tabIds: tabs.flatMap((tab) =>
            tab.id !== undefined &&
            group.tabIds.includes(tab.id) &&
            tab.groupId === groupId
              ? [tab.id]
              : [],
          ),
          title: details.title,
          windowId: details.windowId,
        };
      }),
    );
    const groupId = await browser.tabs.group(
      group.targetGroupId === undefined
        ? { createProperties: { windowId: group.windowId }, tabIds }
        : { groupId: group.targetGroupId, tabIds },
    );
    if (group.targetGroupId === undefined) {
      const title = getDomainGroupLabel(group.hostname);
      await browser.tabGroups.update(groupId, { collapsed: false, title });
      await rememberManagedGroupTitle(groupId, title);
    } else {
      await browser.tabGroups.update(groupId, { collapsed: false });
    }
    affectedCount += tabIds.length;
    if (recordHistory) {
      await updateState((state) => {
        recordAction(state, {
          createdAt: Date.now(),
          description: `已按域名分组：${group.hostname}`,
          groupId,
          previousGroups,
          tabIds: [...tabIds],
          type: 'group',
        });
      });
    }
  }
  await refreshDomainGroupTitles();
  return affectedCount;
}

function groupByDomain(
  focusTabId?: number,
  recordHistory = true,
): Promise<number> {
  const operation = groupingQueue
    .catch(() => undefined)
    .then(() => performGroupByDomain(focusTabId, recordHistory));
  groupingQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

async function removeAllGroups(): Promise<number> {
  const tabs = await browser.tabs.query({});
  const groupedTabIds = tabs.flatMap((tab) =>
    tab.id !== undefined && tab.groupId !== undefined && tab.groupId >= 0
      ? [tab.id]
      : [],
  );
  if (groupedTabIds.length) {
    await browser.tabs.ungroup(groupedTabIds as [number, ...number[]]);
  }
  return groupedTabIds.length;
}

async function refreshDomainGroupTitles(): Promise<void> {
  const tabs = await browser.tabs.query({});
  const managedTitles = await readManagedGroupTitles();
  const hostnameByGroupId = new Map<number, string>();
  for (const tab of tabs) {
    if (tab.groupId === undefined || tab.groupId < 0 || hostnameByGroupId.has(tab.groupId)) {
      continue;
    }
    const hostname = getHostname(tab.url);
    if (hostname) hostnameByGroupId.set(tab.groupId, hostname);
  }
  const groups = await Promise.all(
    [...hostnameByGroupId].map(async ([groupId, hostname]) => ({
      group: await browser.tabGroups.get(groupId),
      groupId,
      hostname,
    })),
  );
  const managedGroups = groups.filter(
    ({ group, groupId }) =>
      managedTitles[String(groupId)] !== undefined &&
      group.title === managedTitles[String(groupId)],
  );
  const labels = getDomainGroupLabels(
    managedGroups.map(({ hostname }) => hostname),
  );
  const nextManagedTitles: Record<string, string> = {};
  await Promise.all(
    managedGroups.map(async ({ group, groupId, hostname }) => {
      const managedTitle = managedTitles[String(groupId)]!;
      const desiredTitle = labels.get(hostname) ?? getDomainGroupLabel(hostname);
      const titleUpdate = getManagedGroupTitleUpdate(
        group.title,
        managedTitle,
        desiredTitle,
      );
      if (titleUpdate !== undefined) {
        await browser.tabGroups.update(groupId, { title: titleUpdate });
      }
      nextManagedTitles[String(groupId)] = titleUpdate ?? managedTitle;
    }),
  );
  await browser.storage.session.set({
    [MANAGED_GROUP_TITLES_KEY]: nextManagedTitles,
  });
}

async function setAutoGrouping(enabled: boolean): Promise<number> {
  await updateState((state) => {
    updateUserSettings(state, { ...state.settings, autoGroupEnabled: enabled });
    const now = Date.now();
    for (const action of state.actionHistory) {
      if (action.type === 'group' && !action.undoneAt) action.undoneAt = now;
    }
    recordAction(state, {
      createdAt: now,
      description: enabled ? '已开启自动分组' : '已关闭自动分组',
      type: 'settings',
    });
  });
  const affectedCount = enabled
    ? await groupByDomain(undefined, false)
    : await removeAllGroups();
  if (enabled) await refreshDomainGroupTitles();
  await updateGroupingBadge();
  return affectedCount;
}

async function maybeAutoGroup(tab: Browser.tabs.Tab): Promise<void> {
  const state = await readState();
  if (state.settings.autoGroupEnabled && tab.id !== undefined) {
    await groupByDomain(tab.id);
  }
}

async function updateGroupingBadge(): Promise<void> {
  if (Date.now() < duplicateFeedbackUntil) return;
  const state = await readState();
  if (!state.settings.autoGroupEnabled) {
    await Promise.all([
      browser.action.setBadgeText({ text: '' }),
      browser.action.setTitle({ title: 'Tab Caretaker' }),
    ]);
    return;
  }
  const tabs = await browser.tabs.query({});
  const pendingCount = getDomainGroupPlan(tabs).reduce(
    (total, group) => total + group.tabIds.length,
    0,
  );
  await Promise.all([
    browser.action.setBadgeBackgroundColor({ color: '#b7791f' }),
    browser.action.setBadgeText({
      text: pendingCount ? String(Math.min(pendingCount, 99)) : '',
    }),
    browser.action.setTitle({
      title: pendingCount
        ? `发现 ${pendingCount} 个待整理标签，点击一键分组。`
        : 'Tab Caretaker',
    }),
  ]);
}

async function runMaintenance(): Promise<number> {
  const state = await readState();
  if (!state.settings.archiveEnabled) return 0;
  const tabs = await browser.tabs.query({});
  const staleBefore =
    Date.now() - state.settings.staleAfterDays * 24 * 60 * 60 * 1_000;
  const protectionOptions = {
    domainAllowlist: state.settings.domainAllowlist,
    manuallyProtectedTabIds: getManuallyProtectedTabIds(state.tabActivity),
  };
  const candidates = tabs.filter(
    (tab) =>
      tab.id !== undefined &&
      Boolean(tab.lastAccessed && tab.lastAccessed < staleBefore) &&
      !isTabProtected(tab, protectionOptions),
  );
  let archivedCount = 0;
  for (const tab of candidates) {
    try {
      if (tab.id !== undefined && (await archiveTab(tab.id, 'stale'))) archivedCount += 1;
    } catch {
      // A tab may close or become protected between the scan and archive attempt.
    }
  }
  return archivedCount;
}

async function showDuplicateGuardFeedback(tab: Browser.tabs.Tab): Promise<void> {
  const notificationId = 'tab-caretaker-duplicate';
  const title = (tab.title || '这个页面').trim().slice(0, 70);
  duplicateFeedbackUntil = Date.now() + 4_000;

  try {
    await Promise.all([
      browser.action.setBadgeBackgroundColor({ color: '#2f7d5a' }),
      browser.action.setBadgeText({ text: '✓' }),
      browser.action.setTitle({ title: `已拦截重复：${title}。点击可选择仍要打开。` }),
    ]);
    setTimeout(() => {
      void updateGroupingBadge();
    }, 4_000);
  } catch {
    // Badge feedback is best-effort and must never block duplicate protection.
  }

  try {
    await browser.notifications.create(notificationId, {
      contextMessage: 'Tab Caretaker',
      iconUrl: browser.runtime.getURL('/icon/128.png'),
      message: `${title} 已经打开，未创建重复标签。`,
      priority: 2,
      requireInteraction: false,
      silent: true,
      title: '已切回原标签',
      type: 'basic',
    });
  } catch {
    // Notification availability must never block duplicate protection.
  }
}

async function maybeGuardDuplicate(tab: Browser.tabs.Tab): Promise<boolean> {
  if (tab.id === undefined || !tab.url) return false;
  const state = await readState();
  if (!state.settings.duplicateGuardEnabled) return false;
  const activity = state.tabActivity[String(tab.id)];
  const explicitlyAllowed = await updateState((current) => {
    const currentActivity = current.tabActivity[String(tab.id)];
    const now = Date.now();
    if (currentActivity?.duplicateAllowedUntil && currentActivity.duplicateAllowedUntil > now) {
      return true;
    }
    const allowed = consumeDuplicateIntentExemption(current, tab.url!, now);
    if (allowed && currentActivity) {
      currentActivity.duplicateAllowedUntil = now + DEFAULT_DUPLICATE_GUARD_WINDOW_MS;
    }
    return allowed;
  });
  if (
    shouldPreserveDuplicate(
      activity,
      explicitlyAllowed,
      Date.now(),
      DEFAULT_DUPLICATE_GUARD_WINDOW_MS,
    )
  ) {
    return false;
  }

  const normalized = normalizeUrl(tab.url, {
    ignoredQueryParameters: state.settings.trackingParameters,
  });
  if (!normalized) return false;
  const tabs = await browser.tabs.query({});
  const existing = tabs
    .filter(
      (candidate) =>
        candidate.id !== undefined &&
        candidate.id !== tab.id &&
        isOlderDuplicateCandidate(
          state.tabActivity[String(candidate.id)],
          candidate.id,
          activity!,
          tab.id!,
        ) &&
        normalizeUrl(candidate.url, {
          ignoredQueryParameters: state.settings.trackingParameters,
        }) === normalized,
    )
    .sort(
      (left, right) =>
        Number(Boolean(right.active || right.pinned)) -
          Number(Boolean(left.active || left.pinned)) ||
        (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0),
    )[0];
  if (existing?.id === undefined) return false;

  const archived = await updateState((current) =>
    addArchive(current, tab, 'duplicate-guard'),
  );
  if (!archived) return false;
  await browser.windows.update(existing.windowId, { focused: true });
  await browser.tabs.update(existing.id, { active: true });
  await browser.tabs.remove(tab.id);
  await showDuplicateGuardFeedback(existing);
  return true;
}

async function ensureRecurringWork(): Promise<void> {
  await browser.alarms.create(MAINTENANCE_ALARM, {
    delayInMinutes: 5,
    periodInMinutes: 60,
  });
}

async function ensureContextMenus(): Promise<void> {
  await browser.contextMenus.removeAll();
  await browser.contextMenus.create({
    contexts: ['tab'],
    id: MENU_DUPLICATE,
    title: '复制标签页（保留副本）',
  });
  await browser.contextMenus.create({
    contexts: ['tab'],
    id: MENU_PROTECT,
    title: '保护 / 取消保护此标签页',
  });
  await browser.contextMenus.create({
    contexts: ['tab'],
    id: MENU_ARCHIVE,
    title: '归档并关闭标签页',
  });
}

async function applySidePanelSetting(): Promise<void> {
  const state = await readState();
  await browser.sidePanel.setOptions({
    enabled: state.settings.sidePanelEnabled,
    path: 'sidepanel.html',
  });
}

function responseError(error: unknown): CaretakerResponse {
  return { error: error instanceof Error ? error.message : '操作失败', ok: false };
}

export default defineBackground(() => {
  void reconcileOpenTabs()
    .then(async () => {
      const state = await readState();
      if (state.settings.autoGroupEnabled) await refreshDomainGroupTitles();
    })
    .then(() => updateGroupingBadge())
    .catch(() => undefined);
  void applySidePanelSetting().catch(() => undefined);

  browser.runtime.onInstalled.addListener(async () => {
    await Promise.all([
      applySidePanelSetting(),
      reconcileOpenTabs(),
      ensureRecurringWork(),
      ensureContextMenus(),
    ]);
  });

  browser.runtime.onStartup.addListener(() => {
    void Promise.all([
      applySidePanelSetting(),
      reconcileOpenTabs(),
      ensureRecurringWork(),
    ]);
  });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === MAINTENANCE_ALARM) void runMaintenance();
  });
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (tab?.id === undefined) return;
    if (info.menuItemId === MENU_DUPLICATE && tab.url) {
      void updateState((state) =>
        addDuplicateIntentExemption(state, tab.url!, 'duplicate-command'),
      ).then(() => browser.tabs.duplicate(tab.id!));
    }
    if (info.menuItemId === MENU_PROTECT) {
      void updateState((state) => {
        observeTab(state, tab);
        const protectedByUser = !state.tabActivity[String(tab.id!)]?.protectedByUser;
        setManualProtection(state, tab.id!, protectedByUser);
        recordAction(state, {
          createdAt: Date.now(),
          description: protectedByUser
            ? `已保护：${tab.title || tab.url || '标签页'}`
            : `已取消保护：${tab.title || tab.url || '标签页'}`,
          tabIds: [tab.id!],
          type: 'protect',
        });
      });
    }
    if (info.menuItemId === MENU_ARCHIVE) void archiveTab(tab.id, 'manual');
  });
  browser.tabs.onCreated.addListener((tab) => {
    void updateState((state) => observeCreatedTab(state, tab))
      .then(() => (normalizeUrl(tab.url) ? maybeGuardDuplicate(tab) : undefined))
      .then(() => updateGroupingBadge())
      .catch(() => undefined);
  });
  browser.tabs.onActivated.addListener(({ tabId }) => {
    void browser.tabs
      .get(tabId)
      .then((tab) => updateState((state) => markTabActivated(state, tab)))
      .catch(() => undefined);
  });
  browser.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    void updateState((state) => observeTab(state, tab)).then(async () => {
      // URL updates may arrive before webNavigation identifies an address-bar
      // navigation. Wait for onCommitted (or the complete fallback) so a pasted
      // address is not closed before its user-intent signal is recorded.
      if (changeInfo.status === 'complete') await maybeGuardDuplicate(tab);
      if (changeInfo.url || changeInfo.status === 'complete') {
        await maybeAutoGroup(tab);
        await updateGroupingBadge();
      }
    }).catch(() => undefined);
  });
  browser.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0) return;
    void browser.tabs
      .get(details.tabId)
      .then(async (tab) => {
        await updateState((state) => {
          observeTab(state, tab);
          const activity = state.tabActivity[String(details.tabId)];
          if (
            activity &&
            isDeliberateCurrentPageCopy(
              details,
              activity.createdFromUrl,
              tab.url,
              state.settings.trackingParameters,
            )
          ) {
            activity.duplicateAllowedUntil =
              Date.now() + DEFAULT_DUPLICATE_GUARD_WINDOW_MS;
          }
        });
        await maybeGuardDuplicate(tab);
      })
      .catch(() => undefined);
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    void updateState((state) => removeTabActivity(state, tabId))
      .then(() => updateGroupingBadge())
      .catch(() => undefined);
  });
  browser.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === browser.windows.WINDOW_ID_NONE) return;
    void browser.tabs
      .query({ active: true, windowId })
      .then(([tab]) =>
        tab ? updateState((state) => markTabActivated(state, tab)) : undefined,
      )
      .catch(() => undefined);
  });
  browser.windows.onRemoved.addListener((windowId) => {
    void setSidePanelOpen(windowId, false).catch(() => undefined);
  });
  browser.sidePanel.onOpened?.addListener((info) => {
    void setSidePanelOpen(info.windowId, true).catch(() => undefined);
  });
  browser.sidePanel.onClosed?.addListener((info) => {
    void setSidePanelOpen(info.windowId, false).catch(() => undefined);
  });
  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!message || typeof message !== 'object' || !('type' in message)) return;
    const request = message as CaretakerMessage;
    const handle = async (): Promise<CaretakerResponse> => {
      try {
        if (request.type === 'ARCHIVE_TAB') {
          return { ok: await archiveTab(request.tabId, 'manual') };
        }
        if (request.type === 'RESTORE_ARCHIVE') {
          return { ok: await restoreArchive(request.archiveId) };
        }
        if (request.type === 'UNDO_ACTION') {
          return { ok: await undoAction(request.actionId) };
        }
        if (request.type === 'DEDUPLICATE_EXISTING') {
          return { affectedCount: await deduplicateExistingTabs(), ok: true };
        }
        if (request.type === 'GROUP_BY_DOMAIN') {
          const affectedCount = await groupByDomain();
          await updateGroupingBadge();
          return { affectedCount, ok: true };
        }
        if (request.type === 'SET_AUTO_GROUPING') {
          return {
            affectedCount: await setAutoGrouping(request.enabled),
            ok: true,
          };
        }
        if (request.type === 'RUN_MAINTENANCE') {
          return { affectedCount: await runMaintenance(), ok: true };
        }
        if (request.type === 'SET_MANUAL_PROTECTION') {
          const ok = await updateState((state) => {
            const updated = setManualProtection(
              state,
              request.tabId,
              request.protectedByUser,
            );
            if (updated) {
              recordAction(state, {
                createdAt: Date.now(),
                description: request.protectedByUser
                  ? '已保护标签页'
                  : '已取消保护标签页',
                tabIds: [request.tabId],
                type: 'protect',
              });
            }
            return updated;
          });
          return { ok };
        }
        if (request.type === 'GRANT_DUPLICATE_EXEMPTION') {
          const ok = await updateState((state) =>
            addDuplicateIntentExemption(state, request.url, request.source),
          );
          return { ok };
        }
        if (request.type === 'GET_SIDE_PANEL_STATE') {
          const windowIds = await readOpenSidePanelWindowIds();
          return {
            ok: true,
            sidePanelOpen: windowIds.has(request.windowId),
          };
        }
        if (request.type === 'SET_SIDE_PANEL_STATE') {
          await setSidePanelOpen(request.windowId, request.open);
          return { ok: true, sidePanelOpen: request.open };
        }
        if (request.type === 'UPDATE_SETTINGS') {
          await updateState((state) => {
            updateUserSettings(state, request.settings);
            recordAction(state, {
              createdAt: Date.now(),
              description: '已更新设置',
              type: 'settings',
            });
          });
          if (typeof request.settings.sidePanelEnabled === 'boolean') {
            await applySidePanelSetting();
          }
          return { ok: true };
        }
        return { error: '未知操作', ok: false };
      } catch (error) {
        return responseError(error);
      }
    };
    void handle().then(sendResponse, (error) => sendResponse(responseError(error)));
    return true;
  });

  void Promise.all([reconcileOpenTabs(), ensureRecurringWork()]);
});
