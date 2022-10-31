import { encode } from 'js-base64';
import { SegmentFields, SpanFields, ErrorInfoFields, ReportFields } from '@/types';
import {
  ServiceTag,
  ErrorsCategory,
  GradeTypeEnum,
  ReportUrl,
  swv,
  SpanLayer,
  SpanType,
  ComponentId,
} from '@/shared/constants';
import { uuid, parseUrl, now } from '@/shared/utils';
import { options } from '@/shared/options';
import { traceTask } from '@/trace';
import { errorTask } from '@/errorLog';

type Method = { method?: 'OPTIONS' | 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'TRACE' | 'CONNECT' };

function notTraceOrigins(origin: string, noTraceOrigins = []): boolean {
  return noTraceOrigins.some((rule: string | RegExp) => {
    if (typeof rule === 'string') {
      return origin === rule;
    } else if (rule instanceof RegExp) {
      return rule.test(origin);
    }
  });
}

function isSDKInternal(requestPath: string, collector: string): boolean {
  const { path: collectorPath } = parseUrl(collector);
  const pathname =
    !collectorPath || collectorPath === '/' ? requestPath : requestPath.replace(new RegExp(`^${collectorPath}`), '');
  const internals: string[] = [ReportUrl.ERROR, ReportUrl.ERRORS, ReportUrl.PERF, ReportUrl.SEGMENTS];
  return internals.includes(pathname);
}

function generateSWHeader({ traceId, traceSegmentId, host, segment, pagePath }): string {
  const traceIdStr = `${encode(traceId)}`;
  const segmentId = `${encode(traceSegmentId)}`;
  const service = `${encode(segment.service)}`;
  const instance = `${encode(segment.serviceInstance)}`;
  const endpoint = `${encode(pagePath)}`;
  const peer = `${encode(host)}`;
  const index = segment.spans.length;
  return `${1}-${traceIdStr}-${segmentId}-${index}-${service}-${instance}-${endpoint}-${peer}`;
}

export function interceptNetwork(): void {
  const networkMethods = ['request', 'downloadFile', 'uploadFile'];
  networkMethods.forEach((methodName) => {
    const originRequest = wx[methodName];
    Object.defineProperty(wx, methodName, {
      writable: true,
      enumerable: true,
      configurable: true,
      value: function (
        requestOptions: (
          | WechatMiniprogram.RequestOption
          | WechatMiniprogram.DownloadFileOption
          | WechatMiniprogram.UploadFileOption
        ) &
          Method,
      ) {
        const { collector, noTraceOrigins = [], pagePath, traceSDKInternal } = options;
        const { url, header = {}, fail: originFail, success: originSuccess, complete: originComplete } = requestOptions;
        const { host, origin, path } = parseUrl(url);

        const startTime = now();
        const traceId = uuid();
        const traceSegmentId = uuid();
        const hasTrace =
          !notTraceOrigins(origin, noTraceOrigins) || (traceSDKInternal && isSDKInternal(path, collector));

        const segment: SegmentFields = {
          traceId: '',
          service: options.service + ServiceTag,
          spans: [],
          serviceInstance: options.serviceVersion,
          traceSegmentId: '',
        };
        const logInfo: ErrorInfoFields & ReportFields & { collector: string } = {
          uniqueId: uuid(),
          service: options.service,
          serviceVersion: options.serviceVersion,
          pagePath,
          category: ErrorsCategory.AJAX_ERROR,
          grade: GradeTypeEnum.ERROR,
          errorUrl: url,
          message: '',
          collector: options.collector,
          stack: '',
        };
        if (hasTrace) {
          header[swv] = generateSWHeader({ traceId, traceSegmentId, host, segment, pagePath });
          requestOptions.header = header;
        }

        requestOptions.success = function (
          res:
            | WechatMiniprogram.RequestSuccessCallbackResult
            | (WechatMiniprogram.DownloadFileSuccessCallbackResult & { data?: any })
            | WechatMiniprogram.UploadFileSuccessCallbackResult,
        ) {
          const { statusCode, errMsg, data = '' } = res;
          if (statusCode === 0 || statusCode >= 400) {
            logInfo.message = `status: ${statusCode}; statusText: ${errMsg};`;
            logInfo.stack = `request: ${data};`;
            errorTask.addTask(logInfo);
          }
          return originSuccess && originSuccess.call(this, res);
        };

        requestOptions.fail = function (res: WechatMiniprogram.GeneralCallbackResult) {
          logInfo.message = `statusText: ${res.errMsg};`;
          errorTask.addTask(logInfo);
          return originFail && originFail.call(this, res);
        };

        requestOptions.complete = function (
          res:
            | WechatMiniprogram.RequestSuccessCallbackResult
            | (WechatMiniprogram.DownloadFileSuccessCallbackResult & { data?: any })
            | WechatMiniprogram.UploadFileSuccessCallbackResult,
        ) {
          if (hasTrace) {
            const { method } = requestOptions;
            const tags = [
              {
                key: 'http.method',
                value: method || 'GET',
              },
              {
                key: 'url',
                value: url,
              },
            ];
            const exitSpan: SpanFields = {
              operationName: pagePath,
              startTime: startTime,
              endTime: now(),
              spanId: segment.spans.length,
              spanLayer: SpanLayer,
              spanType: SpanType,
              isError: res && (res.statusCode === 0 || res.statusCode >= 400),
              parentSpanId: segment.spans.length - 1,
              componentId: ComponentId,
              peer: host,
              tags: options.detailMode ? (options.customTags ? [...tags, ...options.customTags] : tags) : undefined,
            };
            segment.traceId = traceId;
            segment.traceSegmentId = traceSegmentId;
            segment.spans.push(exitSpan);
            traceTask.addTask(segment);
          }
          return originComplete && originComplete.call(this, res);
        };

        return originRequest.call(this, requestOptions);
      },
    });
  });
}
