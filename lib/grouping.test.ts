import { describe, expect, it } from 'vitest';
import {
  getDomainGroupLabel,
  getDomainGroupLabels,
  getDomainGroupPlan,
  getGroupingKey,
  getManagedGroupTitleUpdate,
  isGroupingParentDomain,
  formatGroupingParentDomains,
  normalizeGroupingParentDomains,
} from './grouping';

describe('domain group labels', () => {
  it('uses one compact, recognizable domain word', () => {
    expect(getDomainGroupLabel('console.cooco.me')).toBe('cooco');
    expect(getDomainGroupLabel('mp.weixin.qq.com')).toBe('weixin');
    expect(getDomainGroupLabel('www.xiaohongshu.com')).toBe('xiaohongshu');
    expect(getDomainGroupLabel('docs.example.co.uk')).toBe('example');
    expect(getDomainGroupLabel('127.0.0.1')).toBe('local');
  });

  it('adds a third-level or suffix discriminator only when short names collide', () => {
    expect(
      Object.fromEntries(
        getDomainGroupLabels([
          'ymck.vip',
          'www.ymck.pro',
          'admin.example.com',
          'shop.example.com',
          'www.xiaohongshu.com',
        ]),
      ),
    ).toEqual({
      'admin.example.com': 'example-admin',
      'shop.example.com': 'example-shop',
      'www.xiaohongshu.com': 'xiaohongshu',
      'www.ymck.pro': 'ymck-pro',
      'ymck.vip': 'ymck-vip',
    });
  });
});

describe('domain grouping', () => {
  it('creates one group when matching tabs are all ungrouped', () => {
    expect(
      getDomainGroupPlan([
        { groupId: -1, id: 1, url: 'https://example.com/a', windowId: 1 },
        { groupId: -1, id: 2, url: 'https://example.com/b', windowId: 1 },
      ]),
    ).toEqual([
      {
        hostname: 'example.com',
        tabIds: [1, 2],
        targetGroupId: undefined,
        windowId: 1,
      },
    ]);
  });

  it('offers a domain group for a single historical ungrouped page', () => {
    expect(
      getDomainGroupPlan([
        { groupId: -1, id: 1, url: 'https://single.example/page', windowId: 1 },
      ]),
    ).toEqual([
      {
        hostname: 'single.example',
        tabIds: [1],
        targetGroupId: undefined,
        windowId: 1,
      },
    ]);
  });

  it('adds matching tabs to an existing domain group', () => {
    expect(
      getDomainGroupPlan([
        { groupId: -1, id: 1, url: 'https://docs.example.com/a', windowId: 1 },
        { groupId: -1, id: 2, url: 'https://docs.example.com/b', windowId: 1 },
        { groupId: 7, id: 3, url: 'https://docs.example.com/c', windowId: 1 },
        { groupId: -1, id: 4, url: 'https://docs.example.com/d', windowId: 2 },
      ]),
    ).toEqual([
      {
        hostname: 'docs.example.com',
        tabIds: [1, 2],
        targetGroupId: 7,
        windowId: 1,
      },
      {
        hostname: 'docs.example.com',
        tabIds: [4],
        targetGroupId: undefined,
        windowId: 2,
      },
    ]);
  });

  it('merges duplicate domain groups into the largest existing group', () => {
    expect(
      getDomainGroupPlan([
        { groupId: 4, id: 1, url: 'https://example.com/a', windowId: 1 },
        { groupId: 4, id: 2, url: 'https://example.com/b', windowId: 1 },
        { groupId: 9, id: 3, url: 'https://example.com/c', windowId: 1 },
        { groupId: -1, id: 4, url: 'https://example.com/d', windowId: 1 },
      ]),
    ).toEqual([
      {
        hostname: 'example.com',
        tabIds: [3, 4],
        targetGroupId: 4,
        windowId: 1,
      },
    ]);
  });
});

describe('managed group titles', () => {
  it('updates a title that still matches the last automatic title', () => {
    expect(getManagedGroupTitleUpdate('example', 'example', 'example-docs')).toBe(
      'example-docs',
    );
  });

  it('preserves a title changed by the user', () => {
    expect(getManagedGroupTitleUpdate('工作资料', 'example', 'example-docs')).toBe(
      undefined,
    );
  });

  it('does not claim ownership of an existing untracked group', () => {
    expect(getManagedGroupTitleUpdate('example', undefined, 'example-docs')).toBe(
      undefined,
    );
  });
});

describe('grouping parent domains', () => {
  it('accepts wildcard and apex parent domains, but not public suffixes', () => {
    expect(isGroupingParentDomain('*.xxx.com')).toBe(true);
    expect(isGroupingParentDomain('xxx.com')).toBe(true);
    expect(isGroupingParentDomain('example.co.uk')).toBe(true);
    expect(isGroupingParentDomain('com')).toBe(false);
    expect(isGroupingParentDomain('*.com')).toBe(false);
    expect(isGroupingParentDomain('co.uk')).toBe(false);
    expect(normalizeGroupingParentDomains(['*.XXX.com', 'xxx.com', 'com'])).toEqual([
      'xxx.com',
    ]);
    expect(formatGroupingParentDomains(['*.XXX.com', 'luxelakes.com', 'baidu.com'])).toBe(
      '*.xxx.com\n*.luxelakes.com\n*.baidu.com',
    );
  });

  it('strips www so the apex site shares a group without extra rules', () => {
    expect(getGroupingKey('www.example.com')).toBe('example.com');
    expect(
      getDomainGroupPlan([
        { groupId: -1, id: 1, url: 'https://www.example.com/a', windowId: 1 },
        { groupId: -1, id: 2, url: 'https://example.com/b', windowId: 1 },
      ]),
    ).toEqual([
      {
        hostname: 'example.com',
        tabIds: [1, 2],
        targetGroupId: undefined,
        windowId: 1,
      },
    ]);
  });

  it('keeps sibling test hosts in separate groups until a parent rule exists', () => {
    const tabs = [
      { groupId: -1, id: 1, url: 'https://test1.xxx.com/a', windowId: 1 },
      { groupId: -1, id: 2, url: 'https://test2.xxx.com/b', windowId: 1 },
      { groupId: -1, id: 3, url: 'https://test3.xxx.com/c', windowId: 1 },
    ];
    expect(getDomainGroupPlan(tabs).map((group) => group.hostname).sort()).toEqual([
      'test1.xxx.com',
      'test2.xxx.com',
      'test3.xxx.com',
    ]);
    expect(getDomainGroupPlan(tabs, ['*.xxx.com'])).toEqual([
      {
        hostname: 'xxx.com',
        tabIds: [1, 2, 3],
        targetGroupId: undefined,
        windowId: 1,
      },
    ]);
  });

  it('does not treat a nested www host as the parent domain without a rule', () => {
    expect(getGroupingKey('www.test1.xxx.com')).toBe('test1.xxx.com');
    expect(getGroupingKey('www.test1.xxx.com', ['xxx.com'])).toBe('xxx.com');
  });

  it('uses the longest matching parent domain and ignores lookalike hosts', () => {
    expect(
      getGroupingKey('a.test.xxx.com', ['xxx.com', '*.test.xxx.com']),
    ).toBe('test.xxx.com');
    expect(getGroupingKey('notxxx.com', ['xxx.com'])).toBe('notxxx.com');
    expect(
      getDomainGroupPlan(
        [
          { groupId: -1, id: 1, url: 'https://mail.google.com', windowId: 1 },
          { groupId: -1, id: 2, url: 'https://docs.google.com', windowId: 1 },
        ],
        ['xxx.com'],
      ).map((group) => group.hostname).sort(),
    ).toEqual(['docs.google.com', 'mail.google.com']);
  });

  it('titles collapsed groups with the parent domain', () => {
    expect(
      Object.fromEntries(
        getDomainGroupLabels(['xxx.com', 'mail.google.com'], ['*.xxx.com']),
      ),
    ).toEqual({
      'mail.google.com': 'google',
      'xxx.com': 'xxx.com',
    });
  });
});

describe('grouping modes', () => {
  it('groups by the full, second-level, or third-level domain', () => {
    expect(getGroupingKey('a.test1.xxx.com', [], 'hostname')).toBe(
      'a.test1.xxx.com',
    );
    expect(
      getGroupingKey('a.test1.xxx.com', [], 'registrable-domain'),
    ).toBe('xxx.com');
    expect(
      getGroupingKey('a.test1.xxx.com', [], 'third-level-domain'),
    ).toBe('test1.xxx.com');
    expect(
      getGroupingKey('a.test1.example.co.uk', [], 'registrable-domain'),
    ).toBe('example.co.uk');
    expect(
      getGroupingKey('a.test1.example.co.uk', [], 'third-level-domain'),
    ).toBe('test1.example.co.uk');
  });

  it('applies custom parent domains before the selected grouping mode', () => {
    expect(
      getGroupingKey(
        'a.test1.xxx.com',
        ['*.xxx.com'],
        'third-level-domain',
      ),
    ).toBe('xxx.com');
  });

  it('splits a broad existing group when switching to a more specific mode', () => {
    expect(
      getDomainGroupPlan(
        [
          { groupId: 7, id: 1, url: 'https://test1.xxx.com/a', windowId: 1 },
          { groupId: 7, id: 2, url: 'https://test1.xxx.com/b', windowId: 1 },
          { groupId: 7, id: 3, url: 'https://test2.xxx.com/c', windowId: 1 },
        ],
        [],
        'hostname',
      ),
    ).toEqual([
      {
        hostname: 'test2.xxx.com',
        tabIds: [3],
        targetGroupId: undefined,
        windowId: 1,
      },
    ]);
  });
});
