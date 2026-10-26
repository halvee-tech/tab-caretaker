import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildSidePanelWindows } from '@/lib/sidepanel-layout';
import { getHostname } from '@/lib/url-normalization';
import './App.css';

type PanelState = 'error' | 'loading' | 'ready';

function tabLabel(tab: Browser.tabs.Tab): string {
  return tab.title?.trim() || getHostname(tab.url) || '未命名标签页';
}

function tabSecondaryLabel(tab: Browser.tabs.Tab): string {
  return getHostname(tab.url) || tab.url || '未知地址';
}

function App() {
  const [tabs, setTabs] = useState<Browser.tabs.Tab[]>([]);
  const [groups, setGroups] = useState<Browser.tabGroups.TabGroup[]>([]);
  const [currentWindowId, setCurrentWindowId] = useState<number>();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<PanelState>('loading');
  const [busyTabId, setBusyTabId] = useState<number>();
  const [actionError, setActionError] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      const [nextTabs, nextGroups, currentWindow] = await Promise.all([
        browser.tabs.query({}),
        browser.tabGroups.query({}),
        browser.windows.getCurrent(),
      ]);
      setTabs(nextTabs);
      setGroups(nextGroups);
      setCurrentWindowId(currentWindow.id);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void refresh();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void refresh(), 80);
    };
    browser.tabs.onActivated.addListener(scheduleRefresh);
    browser.tabs.onAttached.addListener(scheduleRefresh);
    browser.tabs.onCreated.addListener(scheduleRefresh);
    browser.tabs.onDetached.addListener(scheduleRefresh);
    browser.tabs.onMoved.addListener(scheduleRefresh);
    browser.tabs.onRemoved.addListener(scheduleRefresh);
    browser.tabs.onUpdated.addListener(scheduleRefresh);
    browser.tabGroups.onCreated.addListener(scheduleRefresh);
    browser.tabGroups.onMoved.addListener(scheduleRefresh);
    browser.tabGroups.onRemoved.addListener(scheduleRefresh);
    browser.tabGroups.onUpdated.addListener(scheduleRefresh);
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      browser.tabs.onActivated.removeListener(scheduleRefresh);
      browser.tabs.onAttached.removeListener(scheduleRefresh);
      browser.tabs.onCreated.removeListener(scheduleRefresh);
      browser.tabs.onDetached.removeListener(scheduleRefresh);
      browser.tabs.onMoved.removeListener(scheduleRefresh);
      browser.tabs.onRemoved.removeListener(scheduleRefresh);
      browser.tabs.onUpdated.removeListener(scheduleRefresh);
      browser.tabGroups.onCreated.removeListener(scheduleRefresh);
      browser.tabGroups.onMoved.removeListener(scheduleRefresh);
      browser.tabGroups.onRemoved.removeListener(scheduleRefresh);
      browser.tabGroups.onUpdated.removeListener(scheduleRefresh);
    };
  }, [refresh]);

  const visibleTabs = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    if (!value) return tabs;
    return tabs.filter((tab) =>
      `${tab.title ?? ''} ${tab.url ?? ''}`.toLocaleLowerCase().includes(value),
    );
  }, [query, tabs]);

  const windows = useMemo(
    () => buildSidePanelWindows(visibleTabs, groups, currentWindowId),
    [currentWindowId, groups, visibleTabs],
  );

  const focusTab = useCallback(async (tab: Browser.tabs.Tab) => {
    if (tab.id === undefined) return;
    setBusyTabId(tab.id);
    setActionError(undefined);
    try {
      await browser.windows.update(tab.windowId, { focused: true });
      await browser.tabs.update(tab.id, { active: true });
    } catch {
      setActionError('标签已关闭，列表已刷新。');
      await refresh();
    } finally {
      setBusyTabId(undefined);
    }
  }, [refresh]);

  const renderTab = (tab: Browser.tabs.Tab) => (
    <li key={tab.id ?? `${tab.windowId}-${tab.index}`}>
      <button
        className={`tab-row${tab.active ? ' active' : ''}`}
        type="button"
        disabled={tab.id === busyTabId}
        onClick={() => void focusTab(tab)}
        aria-current={tab.active ? 'page' : undefined}
      >
        <span className="tab-icon" aria-hidden="true">
          <span className="tab-fallback"><i /><i /></span>
          {tab.favIconUrl && (
            <img src={tab.favIconUrl} alt="" onError={(event) => { event.currentTarget.hidden = true; }} />
          )}
        </span>
        <span className="tab-copy">
          <strong>{tabLabel(tab)}</strong>
          <small>{tabSecondaryLabel(tab)}</small>
        </span>
        {tab.audible && (
          <svg className="audio-icon" viewBox="0 0 24 24" aria-label="正在播放声音"><path d="M5 9v6h4l5 4V5L9 9H5Z" /><path d="M17 9a4 4 0 0 1 0 6" /></svg>
        )}
      </button>
    </li>
  );

  return (
    <main className="sidepanel-app">
      <header className="panel-header">
        <div className="panel-brand">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
          <div>
            <h1>全部标签</h1>
            <p>{tabs.length} 个标签</p>
          </div>
        </div>
        <label className="panel-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
          <span className="sr-only">搜索所有标签</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标签" />
        </label>
      </header>

      {actionError && <p className="action-error" role="alert">{actionError}</p>}

      {status === 'loading' && <p className="panel-state">正在读取标签…</p>}
      {status === 'error' && (
        <div className="panel-state error" role="alert">
          <span>无法读取标签。</span>
          <button type="button" onClick={() => void refresh()}>重试</button>
        </div>
      )}
      {status === 'ready' && !visibleTabs.length && (
        <p className="panel-state">{query.trim() ? '没有匹配的标签。' : '当前没有打开的标签。'}</p>
      )}

      {status === 'ready' && visibleTabs.length > 0 && (
        <div className="window-list">
          {windows.map((window, windowIndex) => (
            <section className="window-section" key={window.id} aria-label={`窗口 ${windowIndex + 1}`}>
              {windows.length > 1 && (
                <h2>
                  窗口 {windowIndex + 1}
                  {window.id === currentWindowId && <span>当前</span>}
                </h2>
              )}
              {window.groups.map(({ group, tabs: groupTabs }) => (
                <details className="tab-group" data-color={group.color} key={group.id} open>
                  <summary>
                    <span className="group-dot" aria-hidden="true" />
                    <strong>{group.title || '未命名组'}</strong>
                    <span>{groupTabs.length}</span>
                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 6 3 3 3-3" /></svg>
                  </summary>
                  <ul>{groupTabs.map(renderTab)}</ul>
                </details>
              ))}
              {window.ungrouped.length > 0 && (
                <section className="ungrouped-tabs" aria-label="未分组标签">
                  <h3><span>未分组</span><small>{window.ungrouped.length}</small></h3>
                  <ul>{window.ungrouped.map(renderTab)}</ul>
                </section>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

export default App;
