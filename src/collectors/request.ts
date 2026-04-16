import { _global } from '../shared/global';
import type { RingQueue } from '../core/queue';
import type { ResolvedOptions } from '../core/options';
import type { PlatformAdapter } from '../adapters/types';
import type { OtlpMetric, OtlpKeyValue, OtlpLogRecord } from '../types/otlp';
import type { SegmentObject, SpanObject } from '../types/segment';
import { warn, debug } from '../shared/log';
import { now } from '../shared/time';
import { base64Encode } from '../shared/base64';
import uuid from '../vendor/skywalking/uuid';
import { ComponentId, SpanLayer, SpanType } from '../vendor/skywalking/constant';
import { shouldSample } from '../core/sampler';

function toNanos(ms: number): string {
  return ms + '000000';
}

function currentPagePath(): string {
  try {
    const g = (_global) as { getCurrentPages?: () => Array<{ route?: string }> };
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

function isBlacklisted(url: string, blacklist: (string | RegExp)[]): boolean {
  for (const rule of blacklist) {
    if (typeof rule === 'string' && url.includes(rule)) return true;
    if (rule instanceof RegExp && rule.test(url)) return true;
  }
  return false;
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

function buildSw8Header(
  traceId: string,
  segmentId: string,
  spanIndex: number,
  service: string,
  serviceInstance: string,
  pagePath: string,
  peer: string,
): string {
  return [
    '1',
    base64Encode(traceId),
    base64Encode(segmentId),
    String(spanIndex),
    base64Encode(service),
    base64Encode(serviceInstance),
    base64Encode(pagePath),
    base64Encode(peer),
  ].join('-');
}

export function installRequestCollector(
  adapter: PlatformAdapter,
  queue: RingQueue,
  options: ResolvedOptions,
): void {
  const collectorUrl = options.collector.replace(/\/+$/, '');
  const traceCollectorUrl = options.traceCollector.replace(/\/+$/, '');
  const urlGroupRules = options.request.urlGroupRules;
  const tracingEnabled = options.enable.tracing;
  const sampleRate = options.tracing.sampleRate;
  const urlBlacklist = options.tracing.urlBlacklist;

  adapter.interceptRequest((originalRequest, opts) => {
    if ((collectorUrl && opts.url.startsWith(collectorUrl)) ||
        (traceCollectorUrl && opts.url.startsWith(traceCollectorUrl))) {
      return originalRequest(opts);
    }

    const method = (opts.method || 'GET').toUpperCase();
    const startTime = Date.now();
    const peer = extractDomain(opts.url);
    const page = currentPagePath();

    let traceId: string | undefined;
    let segmentId: string | undefined;

    if (tracingEnabled && shouldSample(sampleRate) && !isBlacklisted(opts.url, urlBlacklist)) {
      traceId = uuid();
      segmentId = uuid();
      const sw8 = buildSw8Header(
        traceId, segmentId, 0,
        options.service, options.serviceInstance, page, peer,
      );
      opts = { ...opts, headers: { ...opts.headers, sw8 } };
    }

    originalRequest({
      ...opts,
      onSuccess: (statusCode, data, headers) => {
        try {
          const endTime = Date.now();
          const duration = endTime - startTime;

          const metrics = buildRequestMetrics(method, statusCode, duration, opts.url, urlGroupRules, endTime);
          queue.push({ kind: 'metric', time: now(), payload: metrics });

          if (statusCode >= 400) {
            queue.push({
              kind: 'log', time: now(),
              payload: buildAjaxErrorLog(method, opts.url, statusCode, ''),
            });
          }

          if (traceId && segmentId) {
            const span: SpanObject = {
              operationName: page,
              startTime,
              endTime,
              spanId: 0,
              parentSpanId: -1,
              spanLayer: SpanLayer,
              spanType: SpanType,
              isError: statusCode === 0 || statusCode >= 400,
              componentId: ComponentId,
              peer,
              tags: [
                { key: 'http.method', value: method },
                { key: 'url', value: opts.url },
                { key: 'http.status_code', value: String(statusCode) },
              ],
            };
            const segment: SegmentObject = {
              traceId,
              traceSegmentId: segmentId,
              service: options.service,
              serviceInstance: options.serviceInstance,
              spans: [span],
            };
            queue.push({ kind: 'segment', time: now(), payload: segment });
          }

          debug('request collector', method, peer, statusCode, duration + 'ms');
        } catch (err) {
          warn('request collector onSuccess failed', err);
        }
        opts.onSuccess(statusCode, data, headers);
      },
      onFail: (errMsg) => {
        try {
          const endTime = Date.now();
          const duration = endTime - startTime;

          const metrics = buildRequestMetrics(method, 0, duration, opts.url, urlGroupRules, endTime);
          queue.push({ kind: 'metric', time: now(), payload: metrics });
          queue.push({
            kind: 'log', time: now(),
            payload: buildAjaxErrorLog(method, opts.url, 0, errMsg),
          });

          if (traceId && segmentId) {
            const span: SpanObject = {
              operationName: page,
              startTime,
              endTime,
              spanId: 0,
              parentSpanId: -1,
              spanLayer: SpanLayer,
              spanType: SpanType,
              isError: true,
              componentId: ComponentId,
              peer,
              tags: [
                { key: 'http.method', value: method },
                { key: 'url', value: opts.url },
                { key: 'error.message', value: errMsg },
              ],
            };
            const segment: SegmentObject = {
              traceId,
              traceSegmentId: segmentId,
              service: options.service,
              serviceInstance: options.serviceInstance,
              spans: [span],
            };
            queue.push({ kind: 'segment', time: now(), payload: segment });
          }
        } catch (err) {
          warn('request collector onFail failed', err);
        }
        opts.onFail(errMsg);
      },
    });
  });

  debug('request collector installed', tracingEnabled ? '(tracing on)' : '(metrics only)');
}
