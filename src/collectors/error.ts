import type { RingQueue } from '../core/queue';
import type { ResolvedOptions } from '../core/options';
import { getWx } from '../shared/wx';
import { warn } from '../shared/log';
import { now } from '../shared/time';
import uuid from '../vendor/skywalking/uuid';
import { ErrorsCategory, GradeTypeEnum } from '../vendor/skywalking/constant';
import type { BrowserErrorLog } from '../vendor/skywalking/protocol';

type WxError = (msg: string) => void;
type WxRejection = (res: { reason: unknown; promise?: unknown }) => void;
type WxPageNotFound = (res: { path: string; query?: Record<string, string>; isEntryPage?: boolean }) => void;

function currentPagePath(): string {
  try {
    const g = globalThis as { getCurrentPages?: () => Array<{ route?: string }> };
    const pages = g.getCurrentPages?.();
    if (pages && pages.length > 0) {
      return pages[pages.length - 1]?.route ?? 'unknown';
    }
  } catch {
    // ignored — currentPagePath must never throw
  }
  return 'unknown';
}

export function installErrorCollector(queue: RingQueue, options: ResolvedOptions): void {
  const wx = getWx();

  const push = (log: BrowserErrorLog): void => {
    queue.push({ kind: 'error', time: now(), payload: log });
  };

  const base = (): Pick<BrowserErrorLog, 'service' | 'serviceVersion' | 'uniqueId'> => ({
    service: options.service,
    serviceVersion: options.serviceVersion,
    uniqueId: uuid(),
  });

  try {
    (wx.onError as (cb: WxError) => void)((stack) => {
      try {
        const text = typeof stack === 'string' ? stack : String(stack ?? '');
        const nl = text.indexOf('\n');
        const message = nl === -1 ? text : text.slice(0, nl);
        const rest = nl === -1 ? '' : text.slice(nl + 1);
        const page = currentPagePath();
        push({
          ...base(),
          pagePath: page,
          category: ErrorsCategory.JS_ERROR,
          grade: GradeTypeEnum.ERROR,
          message,
          stack: rest,
          errorUrl: page,
        });
      } catch (err) {
        warn('error collector onError handler failed', err);
      }
    });
  } catch (err) {
    warn('wx.onError registration failed', err);
  }

  try {
    (wx.onUnhandledRejection as (cb: WxRejection) => void)((res) => {
      try {
        const reason = res?.reason;
        const asError = reason instanceof Error ? reason : null;
        const page = currentPagePath();
        push({
          ...base(),
          pagePath: page,
          category: ErrorsCategory.PROMISE_ERROR,
          grade: GradeTypeEnum.ERROR,
          message: asError?.message ?? String(reason ?? 'unhandled rejection'),
          stack: asError?.stack ?? '',
          errorUrl: page,
        });
      } catch (err) {
        warn('error collector onUnhandledRejection handler failed', err);
      }
    });
  } catch (err) {
    warn('wx.onUnhandledRejection registration failed', err);
  }

  try {
    (wx.onPageNotFound as (cb: WxPageNotFound) => void)((res) => {
      try {
        const path = res?.path ?? 'unknown';
        push({
          ...base(),
          pagePath: path,
          category: ErrorsCategory.UNKNOWN_ERROR,
          grade: GradeTypeEnum.ERROR,
          message: `page not found: ${path}`,
          stack: '',
          errorUrl: path,
        });
      } catch (err) {
        warn('error collector onPageNotFound handler failed', err);
      }
    });
  } catch (err) {
    warn('wx.onPageNotFound registration failed', err);
  }
}
