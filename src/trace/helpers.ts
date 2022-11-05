import { encode } from 'js-base64';

import { parseUrl } from '@/shared/utils';
import { ReportUrl } from '@/shared/constants';

export function notTraceOrigins(origin: string, noTraceOrigins = []): boolean {
  return noTraceOrigins.some((rule: string | RegExp) => {
    if (typeof rule === 'string') {
      return origin === rule;
    } else if (rule instanceof RegExp) {
      return rule.test(origin);
    }
  });
}

export function isSDKInternal(requestPath: string, collector: string): boolean {
  const { path: collectorPath } = parseUrl(collector);
  const pathname =
    !collectorPath || collectorPath === '/' ? requestPath : requestPath.replace(new RegExp(`^${collectorPath}`), '');
  const internals: string[] = [ReportUrl.ERROR, ReportUrl.ERRORS, ReportUrl.PERF, ReportUrl.SEGMENTS];
  return internals.includes(pathname);
}

export function generateSWHeader({ traceId, traceSegmentId, host, segment, pagePath }): string {
  const traceIdStr = `${encode(traceId)}`;
  const segmentId = `${encode(traceSegmentId)}`;
  const service = `${encode(segment.service)}`;
  const instance = `${encode(segment.serviceInstance)}`;
  const endpoint = `${encode(pagePath)}`;
  const peer = `${encode(host)}`;
  const index = segment.spans.length;
  return `${1}-${traceIdStr}-${segmentId}-${index}-${service}-${instance}-${endpoint}-${peer}`;
}
