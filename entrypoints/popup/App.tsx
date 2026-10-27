import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isUndoableAction } from '@/lib/archive';
import { getDuplicateCleanupPlan } from '@/lib/deduplication';
import type { CaretakerMessage, CaretakerResponse } from '@/lib/messages';
import {
  isSidePanelOpenInWindow,
  SIDE_PANEL_WINDOWS_KEY,
} from '@/lib/sidepanel-state';
import { getManuallyProtectedTabIds } from '@/lib/tab-activity';
import { getTabInsights, type TabInsights } from '@/lib/tab-insights';
import {
  createDefaultState,
  migrateStoredState,
  STORAGE_KEY,
  type CaretakerState,
} from '@/lib/storage-schema';
import { getHostname } from '@/lib/url-normalization';
import './App.css';

const EMPTY_INSIGHTS: TabInsights = {
  duplicateCount: 0,
  protectedCount: 0,
  staleCount: 0,
  tabCount: 0,
  windowCount: 0,
};

type Notice = { kind: 'error' | 'success'; text: string } | null;

async function sendMessage(message: CaretakerMessage): Promise<CaretakerResponse> {
  return (await browser.runtime.sendMessage(message)) as CaretakerResponse;
}

function App() {
  const [tabs, setTabs] = useState<Browser.tabs.Tab[]>([]);
  const [currentWindowId, setCurrentWindowId] = useState<number>();
  const [state, setState] = useState<CaretakerState>(createDefaultState());
  const [insights, setInsights] = useState(EMPTY_INSIGHTS);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [savingSetting, setSavingSetting] = useState<string | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const scanTabs = useCallback(async () => {
    setStatus('loading');
    setNotice(null);
    try {
      const [openTabs, stored, currentWindow] = await Promise.all([
        browser.tabs.query({}),
        browser.storage.local.get([STORAGE_KEY, 'settings']),
        browser.windows.getCurrent(),
      ]);
      const nextState = migrateStoredState(stored as Record<string, unknown>);
      const sidePanelState =
        currentWindow.id === undefined
          ? undefined
          : await sendMessage({
              type: 'GET_SIDE_PANEL_STATE',
              windowId: currentWindow.id,
            });
      const protectionOptions = {
        domainAllowlist: nextState.settings.domainAllowlist,
        manuallyProtectedTabIds: getManuallyProtectedTabIds(nextState.tabActivity),
      };
      setTabs(openTabs);
      setCurrentWindowId(currentWindow.id);
      setSidePanelOpen(sidePanelState?.sidePanelOpen === true);
      setState(nextState);
      setInsights(
        getTabInsights(
          openTabs,
          Date.now(),
          nextState.settings.staleAfterDays,
          protectionOptions,
          nextState.settings.trackingParameters,
        ),
      );
      setStatus('ready');
    } catch {
      setStatus('error');
      setNotice({ kind: 'error', text: '无法读取标签，请重新加载扩展。' });
    }
  }, []);

  useEffect(() => {
    void scanTabs();
  }, [scanTabs]);

  useEffect(() => {
    if (status === 'ready') searchInputRef.current?.focus();
  }, [status]);

  useEffect(() => {
    if (currentWindowId === undefined) return;
    const handleStorageChange = (
      changes: Record<string, Browser.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== 'session') return;
      const sidePanelChange = changes[SIDE_PANEL_WINDOWS_KEY];
      if (!sidePanelChange) return;
      setSidePanelOpen(
        isSidePanelOpenInWindow(sidePanelChange.newValue, currentWindowId),
      );
    };
    browser.storage.onChanged.addListener(handleStorageChange);
    return () => browser.storage.onChanged.removeListener(handleStorageChange);
  }, [currentWindowId]);

  const deduplicationPlan = useMemo(
    () =>
      getDuplicateCleanupPlan(
        tabs,
        {
          domainAllowlist: state.settings.domainAllowlist,
          manuallyProtectedTabIds: getManuallyProtectedTabIds(state.tabActivity),
        },
        state.settings.trackingParameters,
      ),
    [state.settings.domainAllowlist, state.settings.trackingParameters, state.tabActivity, tabs],
  );
  const searchResults = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    if (!value) return [];
    return tabs.filter((tab) =>
      `${tab.title ?? ''} ${tab.url ?? ''}`.toLocaleLowerCase().includes(value),
    );
  }, [query, tabs]);
  const lastUndoableAction = state.actionHistory.find(
    (action) => isUndoableAction(action.type) && !action.undoneAt,
  );
  const recentDuplicateAction =
    lastUndoableAction?.type === 'duplicate-focus' &&
    Date.now() - lastUndoableAction.createdAt < 5 * 60 * 1_000
      ? lastUndoableAction
      : undefined;
  const activeArchiveCount = state.archives.filter((archive) => !archive.restoredAt).length;

  const focusTab = useCallback(async (tab: { id?: number; windowId: number }) => {
    if (tab.id === undefined) return;
    setBusyKey(`focus-${tab.id}`);
    try {
      await browser.windows.update(tab.windowId, { focused: true });
      await browser.tabs.update(tab.id, { active: true });
      window.close();
    } catch {
      await scanTabs();
      setNotice({ kind: 'error', text: '标签已经关闭，请重新搜索。' });
    } finally {
      setBusyKey(null);
    }
  }, [scanTabs]);

  const runAction = useCallback(async (
    key: string,
    message: CaretakerMessage,
    success: (response: CaretakerResponse) => string,
  ) => {
    setBusyKey(key);
    setNotice(null);
    try {
      const response = await sendMessage(message);
      if (!response?.ok) throw new Error(response?.error || '操作失败');
      await scanTabs();
      setNotice({ kind: 'success', text: success(response) });
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : '操作失败，请重试。',
      });
    } finally {
      setBusyKey(null);
    }
  }, [scanTabs]);

  const toggleAutomation = useCallback(async (
    key:
      | 'archiveEnabled'
      | 'autoGroupEnabled'
      | 'duplicateGuardEnabled',
    value: boolean,
  ) => {
    const previousSettings = state.settings;
    const nextSettings = { ...previousSettings, [key]: value };
    setSavingSetting(key);
    setNotice(null);
    setState((current) => ({ ...current, settings: nextSettings }));
    try {
      const response = await sendMessage(
        key === 'autoGroupEnabled'
          ? { enabled: value, type: 'SET_AUTO_GROUPING' }
          : { settings: nextSettings, type: 'UPDATE_SETTINGS' },
      );
      if (!response.ok) throw new Error(response.error || '保存失败');
      await scanTabs();
      setNotice({
        kind: 'success',
        text:
          key === 'autoGroupEnabled'
            ? value
              ? `已整理 ${response.affectedCount ?? 0} 个标签，后续新标签将自动分组。`
              : `已解除 ${response.affectedCount ?? 0} 个标签的分组。`
            : value
              ? '功能已启用。'
              : '功能已关闭。',
      });
    } catch (error) {
      setState((current) => ({ ...current, settings: previousSettings }));
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : '保存失败，请重试。',
      });
    } finally {
      setSavingSetting(null);
    }
  }, [scanTabs, state.settings]);

  const toggleSidePanel = useCallback(async (open: boolean) => {
    if (currentWindowId === undefined) return;
    const previousSettings = state.settings;
    const nextSettings = { ...previousSettings, sidePanelEnabled: open };
    setSavingSetting('sidePanelEnabled');
    setNotice(null);
    setSidePanelOpen(open);
    setState((current) => ({ ...current, settings: nextSettings }));

    try {
      // Chrome requires open() to be invoked during the switch click's user gesture.
      const panelAction = open
        ? Promise.all([
            browser.sidePanel.setOptions({ enabled: true, path: 'sidepanel.html' }),
            browser.sidePanel.open({ windowId: currentWindowId }),
          ])
        : Promise.all([
            browser.sidePanel.setOptions({ enabled: false, path: 'sidepanel.html' }),
            typeof browser.sidePanel.close === 'function'
              ? browser.sidePanel.close({ windowId: currentWindowId })
              : Promise.resolve(),
          ]);
      const [response] = await Promise.all([
        sendMessage({ settings: nextSettings, type: 'UPDATE_SETTINGS' }),
        panelAction,
        sendMessage({
          open,
          type: 'SET_SIDE_PANEL_STATE',
          windowId: currentWindowId,
        }),
      ]);
      if (!response.ok) throw new Error(response.error || '保存失败');
      setNotice({
        kind: 'success',
        text: open ? '标签侧边栏已打开。' : '标签侧边栏已关闭。',
      });
    } catch (error) {
      await sendMessage({
        settings: previousSettings,
        type: 'UPDATE_SETTINGS',
      }).catch(() => undefined);
      await browser.sidePanel
        .setOptions({
          enabled: previousSettings.sidePanelEnabled,
          path: 'sidepanel.html',
        })
        .catch(() => undefined);
      await sendMessage({
        open: !open,
        type: 'SET_SIDE_PANEL_STATE',
        windowId: currentWindowId,
      }).catch(() => undefined);
      setState((current) => ({ ...current, settings: previousSettings }));
      setSidePanelOpen(!open);
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : '侧边栏操作失败，请重试。',
      });
    } finally {
      setSavingSetting(null);
    }
  }, [currentWindowId, state.settings]);

  return (
    <main className="app" aria-busy={status === 'loading'}>
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
        <div className="brand-copy">
          <h1>Tab Caretaker</h1>
          <p>{status === 'ready' ? `${insights.tabCount} 个标签 · ${insights.windowCount} 个窗口` : '本地标签助手'}</p>
        </div>
        <button className="icon-button" type="button" onClick={() => void browser.runtime.openOptionsPage()} aria-label="打开高级设置" title="高级设置">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="M19 12a7.5 7.5 0 0 0-.08-1.08l2-1.56-2-3.46-2.48 1a8 8 0 0 0-1.86-1.08L14.2 3h-4.4l-.38 2.82A8 8 0 0 0 7.56 6.9l-2.48-1-2 3.46 2 1.56A7.5 7.5 0 0 0 5 12c0 .37.03.73.08 1.08l-2 1.56 2 3.46 2.48-1a8 8 0 0 0 1.86 1.08L9.8 21h4.4l.38-2.82a8 8 0 0 0 1.86-1.08l2.48 1 2-3.46-2-1.56c.05-.35.08-.71.08-1.08Z" /></svg>
        </button>
      </header>

      <label className="search-box">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
        <span className="sr-only">搜索所有标签</span>
        <input ref={searchInputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索所有标签" disabled={status !== 'ready'} />
      </label>

      {status === 'loading' && <p className="state-message">正在读取标签…</p>}
      {status === 'error' && (
        <section className="error-state" role="alert">
          <p>{notice?.text}</p>
          <button type="button" onClick={() => void scanTabs()}>重试</button>
        </section>
      )}

      {status === 'ready' && query.trim() && (
        <section className="search-results" aria-label={`搜索结果，共 ${searchResults.length} 项`}>
          <div className="result-count" aria-live="polite">{searchResults.length} 个结果</div>
          {searchResults.length ? (
            <ul>
              {searchResults.map((tab) => (
                <li key={tab.id ?? `${tab.windowId}-${tab.index}`}>
                  <button type="button" onClick={() => void focusTab(tab)} disabled={busyKey === `focus-${tab.id}`}>
                    <span>{tab.title || getHostname(tab.url) || '未命名标签页'}</span>
                    <small>{getHostname(tab.url) || tab.url || '未知地址'} · 窗口 {tab.windowId}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">没有匹配标签，试试域名或标题中的关键词。</p>
          )}
        </section>
      )}

      {status === 'ready' && !query.trim() && (
        <>
          <section className="quick-status" aria-label="标签状态">
            <p><strong>{insights.duplicateCount}</strong> 重复 <span>·</span> <strong>{insights.staleCount}</strong> 闲置 <span>·</span> <strong>{insights.protectedCount}</strong> 受保护</p>
            <div className="quick-actions">
              {deduplicationPlan.closeTabIds.length > 0 && (
                <button className="primary-action" type="button" disabled={busyKey !== null} onClick={() => void runAction('deduplicate', { type: 'DEDUPLICATE_EXISTING' }, (response) => `已清理 ${response.affectedCount ?? 0} 个重复标签。`)}>
                  {busyKey === 'deduplicate' ? '去重中…' : `去重 ${deduplicationPlan.closeTabIds.length}`}
                </button>
              )}
              {!deduplicationPlan.closeTabIds.length && (
                <span className="tidy-state">无重复</span>
              )}
            </div>
          </section>

          {recentDuplicateAction && (
            <section className="duplicate-feedback" role="status" aria-label="重复标签拦截结果">
              <div>
                <strong>已拦截重复标签</strong>
                <span>已切回原页面</span>
              </div>
              <button type="button" disabled={busyKey === 'reopen-duplicate'} onClick={() => void runAction('reopen-duplicate', { actionId: recentDuplicateAction.id, type: 'UNDO_ACTION' }, () => '已重新打开副本。')}>
                {busyKey === 'reopen-duplicate' ? '打开中…' : '仍要打开'}
              </button>
            </section>
          )}

          <section className="automation-controls" aria-label="功能设置" aria-busy={savingSetting !== null}>
            <label><span>拦截重复</span><input type="checkbox" checked={state.settings.duplicateGuardEnabled} disabled={savingSetting !== null} onChange={(event) => void toggleAutomation('duplicateGuardEnabled', event.target.checked)} /></label>
            <label><span>自动分组</span><input type="checkbox" checked={state.settings.autoGroupEnabled} disabled={savingSetting !== null} onChange={(event) => void toggleAutomation('autoGroupEnabled', event.target.checked)} /></label>
            <label className="described-setting"><span className="setting-copy"><strong>自动归档</strong><small>闲置 {state.settings.staleAfterDays} 天后归档并关闭，可恢复</small></span><input type="checkbox" checked={state.settings.archiveEnabled} disabled={savingSetting !== null} onChange={(event) => void toggleAutomation('archiveEnabled', event.target.checked)} /></label>
            <label><span>标签侧边栏</span><input type="checkbox" checked={sidePanelOpen} disabled={savingSetting !== null} onChange={(event) => void toggleSidePanel(event.target.checked)} /></label>
          </section>
        </>
      )}

      {notice && status !== 'error' && (
        <p className={`notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>
      )}

      {status === 'ready' && (
        <footer className="footer-bar">
          <button type="button" onClick={() => void browser.tabs.create({ url: browser.runtime.getURL('/options.html#archives') })}>归档{activeArchiveCount ? ` ${activeArchiveCount}` : ''}</button>
          {lastUndoableAction && lastUndoableAction.id !== recentDuplicateAction?.id && (
            <button className="undo-button" type="button" disabled={busyKey === 'undo'} onClick={() => void runAction('undo', { actionId: lastUndoableAction.id, type: 'UNDO_ACTION' }, () => '已撤销上一步。')}>撤销上一步</button>
          )}
        </footer>
      )}
    </main>
  );
}

export default App;
