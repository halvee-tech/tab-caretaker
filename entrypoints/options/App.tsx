import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { CaretakerMessage, CaretakerResponse } from '@/lib/messages';
import {
  createDefaultState,
  migrateStoredState,
  STORAGE_KEY,
  type CaretakerSettings,
  type CaretakerState,
  type UserConfigurableSettings,
} from '@/lib/storage-schema';
import { getHostname } from '@/lib/url-normalization';
import './App.css';

type FormValues = {
  archiveEnabled: boolean;
  autoGroupEnabled: boolean;
  domainAllowlist: string;
  duplicateGuardEnabled: boolean;
  staleAfterDays: string;
  trackingParameters: string;
};

type Notice = { kind: 'error' | 'success'; text: string } | null;

const EMPTY_FORM: FormValues = {
  archiveEnabled: false,
  autoGroupEnabled: false,
  domainAllowlist: '',
  duplicateGuardEnabled: false,
  staleAfterDays: '3',
  trackingParameters: '',
};

function toLines(value: string): string[] {
  return [...new Set(value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))];
}

function valuesFromSettings(settings: CaretakerSettings): FormValues {
  return {
    archiveEnabled: settings.archiveEnabled,
    autoGroupEnabled: settings.autoGroupEnabled,
    domainAllowlist: settings.domainAllowlist.join('\n'),
    duplicateGuardEnabled: settings.duplicateGuardEnabled,
    staleAfterDays: String(settings.staleAfterDays),
    trackingParameters: settings.trackingParameters.join('\n'),
  };
}

function settingsFromValues(values: FormValues): UserConfigurableSettings {
  return {
    archiveEnabled: values.archiveEnabled,
    autoGroupEnabled: values.autoGroupEnabled,
    domainAllowlist: toLines(values.domainAllowlist),
    duplicateGuardEnabled: values.duplicateGuardEnabled,
    staleAfterDays: Number(values.staleAfterDays),
    trackingParameters: toLines(values.trackingParameters),
  };
}

function validateForm(values: FormValues): string | null {
  const staleAfterDays = Number(values.staleAfterDays);
  if (!Number.isInteger(staleAfterDays) || staleAfterDays < 1 || staleAfterDays > 365) {
    return '闲置天数必须是 1 到 365 之间的整数。';
  }
  const invalidDomain = toLines(values.domainAllowlist).find(
    (value) => !/^(?:\*\.)?(?:[a-z0-9-]+\.)*[a-z0-9-]+$/i.test(value),
  );
  if (invalidDomain) return `域名格式不正确：${invalidDomain}`;
  const invalidParameter = toLines(values.trackingParameters).find(
    (value) => /[\s&=?#]/.test(value),
  );
  if (invalidParameter) return `参数名称不正确：${invalidParameter}`;
  return null;
}

function formatDate(value: number): string {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(value);
}

async function sendMessage(message: CaretakerMessage): Promise<CaretakerResponse> {
  return (await browser.runtime.sendMessage(message)) as CaretakerResponse;
}

function App() {
  const [tabCount, setTabCount] = useState(0);
  const [state, setState] = useState<CaretakerState>(createDefaultState());
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [archiveQuery, setArchiveQuery] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [hasLoaded, setHasLoaded] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadData = useCallback(async (syncForm = false, clearNotice = false) => {
    setStatus('loading');
    if (clearNotice) setNotice(null);
    try {
      const [tabs, stored] = await Promise.all([
        browser.tabs.query({}),
        browser.storage.local.get([STORAGE_KEY, 'settings']),
      ]);
      const nextState = migrateStoredState(stored as Record<string, unknown>);
      setTabCount(tabs.length);
      setState(nextState);
      if (syncForm) setValues(valuesFromSettings(nextState.settings));
      setHasLoaded(true);
      setStatus('ready');
    } catch {
      setNotice({ kind: 'error', text: '无法读取本地数据，请重试。' });
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadData(true, true);
  }, [loadData]);

  useEffect(() => {
    if (status === 'ready' && window.location.hash === '#archives') {
      document.querySelector('#archives')?.scrollIntoView();
    }
  }, [status]);

  const filteredArchives = useMemo(() => {
    const value = archiveQuery.trim().toLocaleLowerCase();
    if (!value) return state.archives;
    return state.archives.filter((archive) =>
      `${archive.title ?? ''} ${archive.url}`.toLocaleLowerCase().includes(value),
    );
  }, [archiveQuery, state.archives]);
  const activeArchiveCount = state.archives.filter((archive) => !archive.restoredAt).length;

  const updateValue = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setNotice(null);
  };

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    const error = validateForm(values);
    if (error) {
      setNotice({ kind: 'error', text: error });
      return;
    }
    setStatus('saving');
    const settings = settingsFromValues(values);
    try {
      const response = await sendMessage({ settings, type: 'UPDATE_SETTINGS' });
      if (!response.ok) throw new Error(response.error || '保存失败');
      setNotice({ kind: 'success', text: '设置已保存。' });
      await loadData(true);
    } catch (saveError) {
      setNotice({
        kind: 'error',
        text: saveError instanceof Error ? saveError.message : '保存失败，请重试。',
      });
      setStatus('ready');
    }
  };

  const restoreArchive = async (archiveId: string) => {
    setBusyKey(archiveId);
    setNotice(null);
    try {
      const response = await sendMessage({ archiveId, type: 'RESTORE_ARCHIVE' });
      if (!response.ok) throw new Error(response.error || '恢复失败');
      setNotice({ kind: 'success', text: '页面已重新打开。' });
      await loadData();
    } catch (restoreError) {
      setNotice({
        kind: 'error',
        text: restoreError instanceof Error ? restoreError.message : '恢复失败，请重试。',
      });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <main className="settings-shell">
      <header className="settings-header">
        <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
        <div><h1>Tab Caretaker</h1><p>{tabCount} 个标签 · 本地运行</p></div>
      </header>

      {notice && (
        <p className={`global-message ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>
      )}

      {!hasLoaded && status === 'loading' && <p className="load-state">正在读取设置…</p>}
      {!hasLoaded && status === 'error' && (
        <section className="load-error" role="alert">
          <p>设置没有加载，当前内容不会保存。</p>
          <button type="button" onClick={() => void loadData(true, true)}>重试</button>
        </section>
      )}

      {hasLoaded && status === 'error' && (
        <section className="load-error" role="alert">
          <p>重新读取失败，已暂停编辑以免覆盖数据。</p>
          <button type="button" onClick={() => void loadData(true, true)}>重试</button>
        </section>
      )}

      {hasLoaded && <form className="settings-form" onSubmit={(event) => void saveSettings(event)} aria-busy={status === 'saving'}>
        <fieldset className="settings-fields" disabled={!hasLoaded || status !== 'ready'}>
        <section aria-labelledby="archive-rule-title">
          <div className="section-heading"><h2 id="archive-rule-title">归档规则</h2><span>自动化开关在扩展弹窗中</span></div>
          <label className="inline-field"><span>闲置超过</span><input type="number" min="1" max="365" step="1" value={values.staleAfterDays} aria-invalid={notice?.kind === 'error' && notice.text.startsWith('闲置天数')} onChange={(event) => updateValue('staleAfterDays', event.target.value)} /><span>天后归档</span></label>
        </section>

        <details className="advanced-settings">
          <summary>高级规则</summary>
          <div className="advanced-grid">
            <label className="field"><span>保护这些域名</span><small>每行一个，包含其子域名</small><textarea rows={5} value={values.domainAllowlist} aria-invalid={notice?.kind === 'error' && notice.text.startsWith('域名格式')} onChange={(event) => updateValue('domainAllowlist', event.target.value)} placeholder={'mail.example.com\ndocs.example.com'} /></label>
            <label className="field"><span>忽略这些追踪参数</span><small>仅用于判断重复地址</small><textarea rows={5} value={values.trackingParameters} aria-invalid={notice?.kind === 'error' && notice.text.startsWith('参数名称')} onChange={(event) => updateValue('trackingParameters', event.target.value)} placeholder={'utm_source\nutm_medium'} /></label>
          </div>
        </details>

        <div className="save-row"><span>活动、固定、播放媒体和受保护标签不会自动归档。</span><button type="submit" disabled={status === 'saving'}>{status === 'saving' ? '保存中…' : '保存设置'}</button></div>
        </fieldset>
      </form>}

      {hasLoaded && <section className="archive-section" id="archives" aria-labelledby="archives-title">
        <div className="section-heading"><h2 id="archives-title">本地归档</h2><span>{activeArchiveCount} 项待恢复</span></div>
        <label className="archive-search"><span>搜索归档</span><input type="search" value={archiveQuery} onChange={(event) => setArchiveQuery(event.target.value)} placeholder="标题或地址" /></label>
        {filteredArchives.length ? (
          <ul className="archive-list">
            {filteredArchives.map((archive) => (
              <li key={archive.id}>
                <div><strong>{archive.title || archive.url}</strong><span>{getHostname(archive.url) || archive.url} · {formatDate(archive.archivedAt)}</span></div>
                <button type="button" disabled={busyKey === archive.id} onClick={() => void restoreArchive(archive.id)}>{archive.restoredAt ? '再次打开' : '恢复'}</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">{state.archives.length ? '没有匹配的归档。' : '还没有归档记录。'}</p>
        )}
      </section>}
    </main>
  );
}

export default App;
