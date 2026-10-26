import { DEFAULT_TRACKING_PARAMETERS } from './url-normalization';

export const STORAGE_KEY = 'caretakerState';
export const CURRENT_SCHEMA_VERSION = 4;
export const MAX_ARCHIVES = 1_000;
export const MAX_ACTION_HISTORY = 200;

export type CaretakerSettings = {
  archiveEnabled: boolean;
  autoGroupEnabled: boolean;
  domainAllowlist: string[];
  duplicateGuardEnabled: boolean;
  sidePanelEnabled: boolean;
  staleAfterDays: number;
  trackingParameters: string[];
};

export type UserConfigurableSettings = Pick<
  CaretakerSettings,
  'domainAllowlist' | 'staleAfterDays' | 'trackingParameters'
> &
  Partial<
    Pick<
      CaretakerSettings,
      | 'archiveEnabled'
      | 'autoGroupEnabled'
      | 'duplicateGuardEnabled'
      | 'sidePanelEnabled'
    >
  >;

export type TabActivityRecord = {
  createdAt: number;
  createdFromUrl?: string;
  createdWithoutUrl: boolean;
  duplicateAllowedUntil?: number;
  lastActivatedAt?: number;
  lastSeenAt: number;
  openerTabId?: number;
  protectedByUser: boolean;
  tabId: number;
  title?: string;
  url?: string;
  wasCreatedActive: boolean;
  windowId: number;
};

export type DuplicateIntentExemption = {
  createdAt: number;
  expiresAt: number;
  normalizedUrl: string;
  source: 'address-paste' | 'duplicate-command' | 'user-action';
  usesRemaining: number;
};

export type ArchiveReason = 'duplicate-cleanup' | 'duplicate-guard' | 'manual' | 'stale';

export type ArchiveRecord = {
  active: boolean;
  archivedAt: number;
  faviconUrl?: string;
  groupId?: number;
  id: string;
  index: number;
  lastAccessed?: number;
  pinned: boolean;
  reason: ArchiveReason;
  restoredAt?: number;
  restoredTabId?: number;
  title?: string;
  url: string;
  windowId: number;
};

export type ActionType =
  | 'archive'
  | 'deduplicate'
  | 'duplicate-focus'
  | 'group'
  | 'protect'
  | 'restore'
  | 'settings';

export type ActionRecord = {
  archiveId?: string;
  archiveIds?: string[];
  createdAt: number;
  description: string;
  groupId?: number;
  id: string;
  previousGroups?: Array<{
    collapsed: boolean;
    color: 'blue' | 'cyan' | 'green' | 'grey' | 'orange' | 'pink' | 'purple' | 'red' | 'yellow';
    tabIds: number[];
    title?: string;
    windowId: number;
  }>;
  tabIds?: number[];
  type: ActionType;
  undoneAt?: number;
};

export type CaretakerState = {
  actionHistory: ActionRecord[];
  archives: ArchiveRecord[];
  duplicateIntentExemptions: DuplicateIntentExemption[];
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  settings: CaretakerSettings;
  tabActivity: Record<string, TabActivityRecord>;
};

export const DEFAULT_SETTINGS: CaretakerSettings = {
  archiveEnabled: false,
  autoGroupEnabled: false,
  domainAllowlist: [],
  duplicateGuardEnabled: false,
  sidePanelEnabled: false,
  staleAfterDays: 3,
  trackingParameters: [...DEFAULT_TRACKING_PARAMETERS],
};

export function createDefaultState(): CaretakerState {
  return {
    actionHistory: [],
    archives: [],
    duplicateIntentExemptions: [],
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: {
      ...DEFAULT_SETTINGS,
      domainAllowlist: [],
      trackingParameters: [...DEFAULT_TRACKING_PARAMETERS],
    },
    tabActivity: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeStringList(value: unknown, lowercase = false): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const normalized = lowercase ? item.trim().toLowerCase() : item.trim();
    if (!normalized || seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    result.push(normalized);
  }
  return result;
}

export function sanitizeSettings(value: unknown): CaretakerSettings {
  const source = isRecord(value) ? value : {};
  return {
    archiveEnabled:
      typeof source.archiveEnabled === 'boolean'
        ? source.archiveEnabled
        : DEFAULT_SETTINGS.archiveEnabled,
    autoGroupEnabled:
      typeof source.autoGroupEnabled === 'boolean'
        ? source.autoGroupEnabled
        : DEFAULT_SETTINGS.autoGroupEnabled,
    domainAllowlist: normalizeStringList(source.domainAllowlist, true),
    duplicateGuardEnabled:
      typeof source.duplicateGuardEnabled === 'boolean'
        ? source.duplicateGuardEnabled
        : DEFAULT_SETTINGS.duplicateGuardEnabled,
    sidePanelEnabled:
      typeof source.sidePanelEnabled === 'boolean'
        ? source.sidePanelEnabled
        : DEFAULT_SETTINGS.sidePanelEnabled,
    staleAfterDays:
      typeof source.staleAfterDays === 'number' &&
      Number.isInteger(source.staleAfterDays) &&
      source.staleAfterDays >= 1 &&
      source.staleAfterDays <= 365
        ? source.staleAfterDays
        : DEFAULT_SETTINGS.staleAfterDays,
    trackingParameters: Array.isArray(source.trackingParameters)
      ? normalizeStringList(source.trackingParameters)
      : [...DEFAULT_TRACKING_PARAMETERS],
  };
}

export function updateUserSettings(
  state: CaretakerState,
  settings: UserConfigurableSettings,
): void {
  state.settings = sanitizeSettings({ ...state.settings, ...settings });
}

function readActivity(value: unknown): Record<string, TabActivityRecord> {
  if (!isRecord(value)) return {};
  const result: Record<string, TabActivityRecord> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!isRecord(item) || typeof item.tabId !== 'number' || typeof item.windowId !== 'number') continue;
    result[key] = {
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
      createdFromUrl:
        typeof item.createdFromUrl === 'string' ? item.createdFromUrl : undefined,
      createdWithoutUrl: typeof item.createdWithoutUrl === 'boolean' ? item.createdWithoutUrl : !item.url,
      duplicateAllowedUntil:
        typeof item.duplicateAllowedUntil === 'number'
          ? item.duplicateAllowedUntil
          : undefined,
      lastActivatedAt: typeof item.lastActivatedAt === 'number' ? item.lastActivatedAt : undefined,
      lastSeenAt: typeof item.lastSeenAt === 'number' ? item.lastSeenAt : Date.now(),
      openerTabId: typeof item.openerTabId === 'number' ? item.openerTabId : undefined,
      protectedByUser: item.protectedByUser === true,
      tabId: item.tabId,
      title: typeof item.title === 'string' ? item.title : undefined,
      url: typeof item.url === 'string' ? item.url : undefined,
      wasCreatedActive: item.wasCreatedActive === true,
      windowId: item.windowId,
    };
  }
  return result;
}

/** Migrates the standalone settings format and schema version 1 without losing activity data. */
export function migrateStoredState(raw: Record<string, unknown>): CaretakerState {
  const stored = raw[STORAGE_KEY];
  if (!isRecord(stored)) {
    const state = createDefaultState();
    state.settings = sanitizeSettings(raw.settings);
    if (state.settings.staleAfterDays === 14) state.settings.staleAfterDays = 3;
    return state;
  }

  const storedSchemaVersion =
    typeof stored.schemaVersion === 'number' ? stored.schemaVersion : 1;
  const settings = sanitizeSettings(stored.settings ?? raw.settings);
  if (storedSchemaVersion < 4 && settings.staleAfterDays === 14) {
    settings.staleAfterDays = 3;
  }

  return {
    actionHistory: Array.isArray(stored.actionHistory)
      ? (stored.actionHistory as ActionRecord[]).slice(0, MAX_ACTION_HISTORY)
      : [],
    archives: Array.isArray(stored.archives)
      ? (stored.archives as ArchiveRecord[]).slice(0, MAX_ARCHIVES)
      : [],
    duplicateIntentExemptions: Array.isArray(stored.duplicateIntentExemptions)
      ? (stored.duplicateIntentExemptions as DuplicateIntentExemption[])
      : [],
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings,
    tabActivity: readActivity(stored.tabActivity),
  };
}
