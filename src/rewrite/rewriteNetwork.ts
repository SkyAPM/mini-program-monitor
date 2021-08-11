import { encode } from 'js-base64';
import { SegmentFields, SpanFields } from '@/types/trace';
import {
  ServiceTag,
  ErrorsCategory,
  GradeTypeEnum,
  ReportUrl,
  swv,
  SpanLayer,
  SpanType,
  ComponentId,
} from '@/constant';
import { uuid, parseUrl, now } from '@/utils';
import { store } from '@/store';
import { ErrorInfoFields, ReportFields } from '@/store/types';

type Method = { method?: 'OPTIONS' | 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'TRACE' | 'CONNECT' };
export function rewriteNetwork(): void {
  const networkMethods = ['request', 'downloadFile', 'uploadFile'];
  networkMethods.forEach((method) => {
    const originRequest = wx[method];
    Object.defineProperty(wx, method, {
      writable: true,
      enumerable: true,
      configurable: true,
      value: function (
        reqOptions: (
          | WechatMiniprogram.RequestOption
          | WechatMiniprogram.DownloadFileOption
          | WechatMiniprogram.UploadFileOption
        ) &
          Method,
      ) {
        function notTraceOrigins(origin: string, noTraceOrigins = []): boolean {
          return noTraceOrigins.some((rule: string | RegExp) => {
            if (typeof rule === 'string') {
              return origin === rule;
            } else if (rule instanceof RegExp) {
              return rule.test(origin);
            }
          });
        }
        function isTraceUrl(reqUrl: string, collector: string): boolean {
          const { path: collectorPath } = parseUrl(collector);
          const traceUrls: string[] = [ReportUrl.ERROR, ReportUrl.ERRORS, ReportUrl.PERF, ReportUrl.SEGMENTS];
          return traceUrls.includes(reqUrl.replace(new RegExp(`^${collectorPath}`), ''));
        }
        function generateSWHeader({ traceId, traceSegmentId, host, segment, pagePath }) {
          const traceIdStr = `${encode(traceId)}`;
          const segmentId = `${encode(traceSegmentId)}`;
          const service = `${encode(segment.service)}`;
          const instance = `${encode(segment.serviceInstance)}`;
          const endpoint = `${encode(pagePath)}`;
          const peer = `${encode(host)}`;
          const index = segment.spans.length;
          return `${1}-${traceIdStr}-${segmentId}-${index}-${service}-${instance}-${endpoint}-${peer}`;
        }

        const { options } = store;
        const { collector, noTraceOrigins = [], pagePath } = options;
        const { url, header = {}, fail: customFail, success: customSuccess, complete: customComplete } = reqOptions;
        const { host, origin } = parseUrl(url);

        const startTime = now();
        const traceId = uuid();
        const traceSegmentId = uuid();
        const hasTraceFlag = !(
          notTraceOrigins(origin, noTraceOrigins) ||
          (isTraceUrl(url, collector) && !options.traceSDKInternal)
        );

        const segment: SegmentFields = {
          service: options.service + ServiceTag,
          spans: [],
          serviceInstance: options.serviceVersion,
          traceId: '',
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
        if (hasTraceFlag) {
          header[swv] = generateSWHeader({ traceId, traceSegmentId, host, segment, pagePath });
          reqOptions.header = header;
        }

        reqOptions.success = function (
          res:
            | WechatMiniprogram.RequestSuccessCallbackResult
            | (WechatMiniprogram.DownloadFileSuccessCallbackResult & { data?: any })
            | WechatMiniprogram.UploadFileSuccessCallbackResult,
        ) {
          const { statusCode, errMsg, data = '' } = res;
          if (statusCode === 0 || statusCode >= 400) {
            logInfo.message = `status: ${statusCode}; statusText: ${errMsg};`;
            logInfo.stack = `request: ${data};`;
            store.addLogTask(logInfo);
          }
          return customSuccess && customSuccess.call(this, res);
        };

        reqOptions.fail = function (res: WechatMiniprogram.GeneralCallbackResult) {
          logInfo.message = `statusText: ${res.errMsg};`;
          store.addLogTask(logInfo);
          return customFail && customFail.call(this, res);
        };

        reqOptions.complete = function (
          res:
            | WechatMiniprogram.RequestSuccessCallbackResult
            | (WechatMiniprogram.DownloadFileSuccessCallbackResult & { data?: any })
            | WechatMiniprogram.UploadFileSuccessCallbackResult,
        ) {
          const { method } = reqOptions;
          if (hasTraceFlag) {
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
              tags: options.detailMode
                ? [
                    {
                      key: 'http.method',
                      value: method || 'GET',
                    },
                    {
                      key: 'url',
                      value: url,
                    },
                  ]
                : undefined,
            };
            segment.traceId = traceId;
            segment.traceSegmentId = traceSegmentId;
            segment.spans.push(exitSpan);
            store.addSegment(segment);
          }
          return customComplete && customComplete.call(this, res);
        };

        return originRequest.call(this, reqOptions);
      },
    });
  });
}
