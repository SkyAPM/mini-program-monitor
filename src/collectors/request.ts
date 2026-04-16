import type { RingQueue } from '../core/queue';
import type { ResolvedOptions } from '../core/options';
import type { PlatformAdapter } from '../adapters/types';
import type { OtlpMetric, OtlpKeyValue, OtlpLogRecord } from '../types/otlp';
import { warn, debug } from '../shared/log';
import { now } from '../shared/time';

function toNanos(ms: number): string {
  return ms + '000000';
}

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

function extractDomain(url: string): string {
  try {
    const match = url.match(/^https?:\/\/([^/?#]+)/);
    return match ? match[1] : 'unknown';
  } catch {
    return 'unknown';
  }
}

function matchUrlGroup(url: string, rules: Record<string, RegExp>): string | undefined {
  for (const [group, pattern] of Object.entries(rules)) {
    if (pattern.test(url)) return group;
  }
  return undefined;
}

function buildRequestMetrics(
  method: string,
  statusCode: number,
  durationMs: number,
  url: string,
  urlGroupRules: Record<string, RegExp>,
  timeMs: number,
): OtlpMetric[] {
  const attrs: OtlpKeyValue[] = [
    { key: 'http.request.method', value: { stringValue: method } },
    { key: 'http.response.status_code', value: { stringValue: String(statusCode) } },
    { key: 'server.address', value: { stringValue: extractDomain(url) } },
    { key: 'miniprogram.page.path', value: { stringValue: currentPagePath() } },
  ];

  const urlGroup = matchUrlGroup(url, urlGroupRules);
  if (urlGroup) {
    attrs.push({ key: 'url.path.group', value: { stringValue: urlGroup } });
  }

  return [{
    name: 'miniprogram.request.duration',
    unit: 'ms',
    gauge: {
      dataPoints: [{
        asInt: String(Math.floor(durationMs)),
        timeUnixNano: toNanos(timeMs),
        attributes: attrs,
      }],
    },
  }];
}

function buildAjaxErrorLog(
  method: string,
  url: string,
  statusCode: number,
  errMsg: string,
): OtlpLogRecord {
  return {
    timeUnixNano: toNanos(Date.now()),
    severityNumber: 17,
    severityText: 'ERROR',
    body: { stringValue: `${method} ${url} failed: ${errMsg || statusCode}` },
    attributes: [
      { key: 'exception.type', value: { stringValue: 'ajax' } },
      { key: 'http.request.method', value: { stringValue: method } },
      { key: 'http.response.status_code', value: { stringValue: String(statusCode) } },
      { key: 'server.address', value: { stringValue: extractDomain(url) } },
      { key: 'miniprogram.page.path', value: { stringValue: currentPagePath() } },
    ],
  };
}

export function installRequestCollector(
  adapter: PlatformAdapter,
  queue: RingQueue,
  options: ResolvedOptions,
): void {
  const collectorUrl = options.collector.replace(/\/+$/, '');
  const urlGroupRules = options.request.urlGroupRules;

  adapter.interceptRequest((originalRequest, opts) => {
    if (collectorUrl && opts.url.startsWith(collectorUrl)) {
      return originalRequest(opts);
    }

    const method = (opts.method || 'GET').toUpperCase();
    const startTime = Date.now();

    originalRequest({
      ...opts,
      onSuccess: (statusCode, data, headers) => {
        try {
          const duration = Date.now() - startTime;
          const metrics = buildRequestMetrics(method, statusCode, duration, opts.url, urlGroupRules, Date.now());
          queue.push({ kind: 'metric', time: now(), payload: metrics });

          if (statusCode >= 400) {
            queue.push({
              kind: 'log',
              time: now(),
              payload: buildAjaxErrorLog(method, opts.url, statusCode, ''),
            });
          }

          debug('request collector', method, extractDomain(opts.url), statusCode, duration + 'ms');
        } catch (err) {
          warn('request collector onSuccess failed', err);
        }
        opts.onSuccess(statusCode, data, headers);
      },
      onFail: (errMsg) => {
        try {
          const duration = Date.now() - startTime;
          const metrics = buildRequestMetrics(method, 0, duration, opts.url, urlGroupRules, Date.now());
          queue.push({ kind: 'metric', time: now(), payload: metrics });
          queue.push({
            kind: 'log',
            time: now(),
            payload: buildAjaxErrorLog(method, opts.url, 0, errMsg),
          });
        } catch (err) {
          warn('request collector onFail failed', err);
        }
        opts.onFail(errMsg);
      },
    });
  });

  debug('request collector installed');
}
