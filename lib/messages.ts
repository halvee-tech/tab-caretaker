import type { UserConfigurableSettings } from './storage-schema';

export type CaretakerMessage =
  | {
      type: 'DEDUPLICATE_EXISTING';
    }
  | {
      tabId: number;
      type: 'ARCHIVE_TAB';
    }
  | {
      type: 'GROUP_BY_DOMAIN';
    }
  | {
      archiveId: string;
      type: 'RESTORE_ARCHIVE';
    }
  | {
      type: 'RUN_MAINTENANCE';
    }
  | {
      enabled: boolean;
      type: 'SET_AUTO_GROUPING';
    }
  | {
      protectedByUser: boolean;
      tabId: number;
      type: 'SET_MANUAL_PROTECTION';
    }
  | {
      settings: UserConfigurableSettings;
      type: 'UPDATE_SETTINGS';
    }
  | {
      actionId: string;
      type: 'UNDO_ACTION';
    }
  | {
      source: 'address-paste' | 'duplicate-command' | 'user-action';
      type: 'GRANT_DUPLICATE_EXEMPTION';
      url: string;
    }
  | {
      type: 'GET_SIDE_PANEL_STATE';
      windowId: number;
    }
  | {
      open: boolean;
      type: 'SET_SIDE_PANEL_STATE';
      windowId: number;
    };

export type CaretakerResponse = {
  affectedCount?: number;
  error?: string;
  ok: boolean;
  sidePanelOpen?: boolean;
};
