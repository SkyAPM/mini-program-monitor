import { _global } from './global';

// getCurrentPages() is injected into module scope in both WeChat and
// Alipay runtimes. Try the direct free variable first (works in both
// platforms), fall back to the global object (works in Node tests).
declare const getCurrentPages: (() => Array<{ route?: string }>) | undefined;

export function currentPagePath(): string {
  try {
    let pages: Array<{ route?: string }> | undefined;
    if (typeof getCurrentPages === 'function') {
      pages = getCurrentPages();
    } else {
      const g = _global as { getCurrentPages?: () => Array<{ route?: string }> };
      pages = g.getCurrentPages?.();
    }
    if (pages && pages.length > 0) {
      return pages[pages.length - 1]?.route ?? 'unknown';
    }
  } catch {
    // ignored
  }
  return 'unknown';
}
