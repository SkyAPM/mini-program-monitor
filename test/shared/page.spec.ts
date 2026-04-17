import { describe, it, expect, vi, beforeEach } from 'vitest';
import { currentPagePath } from '../../src/shared/page';
import { _global } from '../../src/shared/global';

describe('currentPagePath', () => {
  beforeEach(() => {
    (_global as Record<string, unknown>).getCurrentPages = () => [
      { route: 'pages/index/index' },
    ];
  });

  it('returns route from getCurrentPages', () => {
    expect(currentPagePath()).toBe('pages/index/index');
  });

  it('returns last page in the stack', () => {
    (_global as Record<string, unknown>).getCurrentPages = () => [
      { route: 'pages/index/index' },
      { route: 'pages/detail/detail' },
    ];
    expect(currentPagePath()).toBe('pages/detail/detail');
  });

  it('returns unknown when getCurrentPages is not available', () => {
    delete (_global as Record<string, unknown>).getCurrentPages;
    expect(currentPagePath()).toBe('unknown');
  });

  it('returns unknown when page stack is empty', () => {
    (_global as Record<string, unknown>).getCurrentPages = () => [];
    expect(currentPagePath()).toBe('unknown');
  });

  it('never throws', () => {
    (_global as Record<string, unknown>).getCurrentPages = () => { throw new Error('boom'); };
    expect(() => currentPagePath()).not.toThrow();
    expect(currentPagePath()).toBe('unknown');
  });
});
