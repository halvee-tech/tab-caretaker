import { describe, expect, it } from 'vitest';
import {
  getDomainGroupLabel,
  getDomainGroupLabels,
  getDomainGroupPlan,
  getManagedGroupTitleUpdate,
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
