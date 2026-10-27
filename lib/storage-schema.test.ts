import { describe, expect, it } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  migrateStoredState,
  updateUserSettings,
} from './storage-schema';

describe('storage migration', () => {
  it('migrates the original standalone settings value', () => {
    const state = migrateStoredState({
      settings: { archiveEnabled: true, staleAfterDays: 30 },
    });
    expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(state.settings).toMatchObject({ archiveEnabled: true, staleAfterDays: 30 });
    expect(state.settings.autoGroupEnabled).toBe(DEFAULT_SETTINGS.autoGroupEnabled);
    expect(state.settings.groupingMode).toBe('hostname');
    expect(state.settings.groupingParentDomains).toEqual([]);
    expect(state.settings.sidePanelEnabled).toBe(false);
  });

  it('falls back safely when stored data is malformed', () => {
    const state = migrateStoredState({ caretakerState: { schemaVersion: 1, settings: null } });
    expect(state.settings).toEqual(DEFAULT_SETTINGS);
    expect(state.tabActivity).toEqual({});
  });

  it('upgrades schema v1 without losing tab activity', () => {
    const state = migrateStoredState({
      caretakerState: {
        schemaVersion: 1,
        settings: { duplicateGuardEnabled: true, staleAfterDays: 21 },
        tabActivity: {
          '42': {
            createdAt: 100,
            lastSeenAt: 200,
            protectedByUser: true,
            tabId: 42,
            url: 'https://example.com',
            windowId: 3,
          },
        },
      },
    });

    expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(state.settings.duplicateGuardEnabled).toBe(true);
    expect(state.settings.staleAfterDays).toBe(21);
    expect(state.tabActivity['42']).toMatchObject({
      createdAt: 100,
      createdWithoutUrl: false,
      lastSeenAt: 200,
      protectedByUser: true,
      tabId: 42,
      wasCreatedActive: false,
      windowId: 3,
    });
    expect(state.archives).toEqual([]);
    expect(state.actionHistory).toEqual([]);
  });

  it('migrates the previous 14-day default to 3 days', () => {
    const state = migrateStoredState({
      caretakerState: {
        schemaVersion: 3,
        settings: { staleAfterDays: 14 },
      },
    });

    expect(state.settings.staleAfterDays).toBe(3);
  });

  it('normalizes user-managed lists and preserves disabled automation', () => {
    const state = migrateStoredState({});
    updateUserSettings(state, {
      domainAllowlist: [' Example.COM ', 'example.com', 'docs.example.com'],
      groupingParentDomains: ['*.XXX.com', 'xxx.com', 'com', 'co.uk'],
      staleAfterDays: 30,
      trackingParameters: ['utm_source', ' utm_source ', 'ref'],
    });
    expect(state.settings).toMatchObject({
      archiveEnabled: false,
      autoGroupEnabled: false,
      domainAllowlist: ['example.com', 'docs.example.com'],
      duplicateGuardEnabled: false,
      groupingMode: 'hostname',
      groupingParentDomains: ['xxx.com'],
      sidePanelEnabled: false,
      staleAfterDays: 30,
      trackingParameters: ['utm_source', 'ref'],
    });
  });

  it('persists valid grouping modes and rejects malformed values', () => {
    const state = migrateStoredState({});

    updateUserSettings(state, {
      ...state.settings,
      groupingMode: 'third-level-domain',
    });
    expect(state.settings.groupingMode).toBe('third-level-domain');

    const malformed = migrateStoredState({
      caretakerState: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        settings: { groupingMode: 'unknown-mode' },
      },
    });
    expect(malformed.settings.groupingMode).toBe('hostname');
  });
});
