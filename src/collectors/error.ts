import type { RingQueue } from '../core/queue';
import type { ResolvedOptions } from '../core/options';
import type { PlatformAdapter } from '../adapters/types';
import type { OtlpLogRecord, OtlpKeyValue } from '../types/otlp';
import { warn } from '../shared/log';
import { now } from '../shared/time';

function currentPagePath(): string {
  try {
    const g = globalThis as { getCurrentPages?: () => Array<{ route?: string }> };
    const pages = g.getCurrentPages?.();
    if (pages && pages.length > 0) {
      return pages[pages.length - 1]?.route ?? 'unknown';
    }
  } catch {
    // ignored
  }
  return 'unknown';
}

function toNanos(ms: number): string {
  return ms + '000000';
}

function buildLogRecord(
  message: string,
  exceptionType: string,
  stack: string,
  pagePath: string,
): OtlpLogRecord {
  const attrs: OtlpKeyValue[] = [
    { key: 'exception.type', value: { stringValue: exceptionType } },
    { key: 'exception.stacktrace', value: { stringValue: stack } },
    { key: 'miniprogram.page.path', value: { stringValue: pagePath } },
  ];
  return {
    timeUnixNano: toNanos(Date.now()),
    severityNumber: 17, // ERROR
    severityText: 'ERROR',
    body: { stringValue: message },
    attributes: attrs,
  };
}

export function installErrorCollector(
  adapter: PlatformAdapter,
  queue: RingQueue,
  _options: ResolvedOptions,
): void {
  try {
    adapter.onError((stack) => {
      try {
        const text = typeof stack === 'string' ? stack : String(stack ?? '');
        const nl = text.indexOf('\n');
        const message = nl === -1 ? text : text.slice(0, nl);
        const rest = nl === -1 ? '' : text.slice(nl + 1);
        const page = currentPagePath();
        queue.push({ kind: 'log', time: now(), payload: buildLogRecord(message, 'js', rest, page) });
      } catch (err) {
        warn('error collector onError handler failed', err);
      }
    });
  } catch (err) {
    warn('adapter.onError registration failed', err);
  }

  try {
    adapter.onUnhandledRejection((res) => {
      try {
        const reason = res?.reason;
        const asError = reason instanceof Error ? reason : null;
        const page = currentPagePath();
        queue.push({
          kind: 'log',
          time: now(),
          payload: buildLogRecord(
            asError?.message ?? String(reason ?? 'unhandled rejection'),
            'promise',
            asError?.stack ?? '',
            page,
          ),
        });
      } catch (err) {
        warn('error collector onUnhandledRejection handler failed', err);
      }
    });
  } catch (err) {
    warn('adapter.onUnhandledRejection registration failed', err);
  }

  if (adapter.onPageNotFound) {
    try {
      adapter.onPageNotFound((res) => {
        try {
          const path = res?.path ?? 'unknown';
          queue.push({
            kind: 'log',
            time: now(),
            payload: buildLogRecord(`page not found: ${path}`, 'pageNotFound', '', path),
          });
        } catch (err) {
          warn('error collector onPageNotFound handler failed', err);
        }
      });
    } catch (err) {
      warn('adapter.onPageNotFound registration failed', err);
    }
  }
}
