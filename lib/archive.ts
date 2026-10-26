import {
  MAX_ACTION_HISTORY,
  MAX_ARCHIVES,
  type ActionRecord,
  type ActionType,
  type ArchiveReason,
  type ArchiveRecord,
  type CaretakerState,
} from './storage-schema';

export type ArchivableTab = {
  active?: boolean;
  favIconUrl?: string;
  groupId?: number;
  id?: number;
  index: number;
  lastAccessed?: number;
  pinned?: boolean;
  title?: string;
  url?: string;
  windowId: number;
};

function createId(prefix: string, now: number): string {
  return `${prefix}-${now.toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function recordAction(
  state: CaretakerState,
  action: Omit<ActionRecord, 'id'>,
): ActionRecord {
  const record = { ...action, id: createId('action', action.createdAt) };
  state.actionHistory.unshift(record);
  state.actionHistory = state.actionHistory.slice(0, MAX_ACTION_HISTORY);
  return record;
}

export function addArchive(
  state: CaretakerState,
  tab: ArchivableTab,
  reason: ArchiveReason,
  now = Date.now(),
  recordHistory = true,
): ArchiveRecord | null {
  if (!tab.url || tab.id === undefined) return null;
  const record: ArchiveRecord = {
    active: Boolean(tab.active),
    archivedAt: now,
    faviconUrl: tab.favIconUrl,
    groupId: tab.groupId,
    id: createId('archive', now),
    index: tab.index,
    lastAccessed: tab.lastAccessed,
    pinned: Boolean(tab.pinned),
    reason,
    title: tab.title,
    url: tab.url,
    windowId: tab.windowId,
  };
  state.archives.unshift(record);
  state.archives = state.archives.slice(0, MAX_ARCHIVES);
  if (recordHistory) {
    recordAction(state, {
      archiveId: record.id,
      createdAt: now,
      description: `已归档：${record.title || record.url}`,
      tabIds: [tab.id],
      type: reason === 'duplicate-guard' ? 'duplicate-focus' : 'archive',
    });
  }
  return record;
}

export function markArchiveRestored(
  state: CaretakerState,
  archiveId: string,
  restoredTabId: number,
  now = Date.now(),
): ArchiveRecord | null {
  const archive = state.archives.find((item) => item.id === archiveId);
  if (!archive) return null;
  archive.restoredAt = now;
  archive.restoredTabId = restoredTabId;
  recordAction(state, {
    archiveId,
    createdAt: now,
    description: `已恢复：${archive.title || archive.url}`,
    tabIds: [restoredTabId],
    type: 'restore',
  });
  return archive;
}

export function markActionUndone(
  state: CaretakerState,
  actionId: string,
  now = Date.now(),
): boolean {
  const action = state.actionHistory.find((item) => item.id === actionId);
  if (!action || action.undoneAt) return false;
  action.undoneAt = now;
  return true;
}

export function isUndoableAction(type: ActionType): boolean {
  return type === 'archive' || type === 'deduplicate' || type === 'duplicate-focus' || type === 'group';
}
