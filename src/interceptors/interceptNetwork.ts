import { SegmentFields, SpanFields, ErrorInfoFields, ReportFields } from '@/types';
import { ErrorsCategory, GradeTypeEnum, swv, SpanLayer, SpanType, ComponentId } from '@/shared/constants';
import { uuid, parseUrl, now } from '@/shared/utils';
import { options } from '@/shared/options';
import { logTask } from '@/log';
import { traceTask } from '@/trace';
import { notTraceOrigins, isSDKInternal, generateSWHeader } from '@/trace/helpers';

type Method = { method?: 'OPTIONS' | 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'TRACE' | 'CONNECT' };

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

        const startTime = now();
        const traceId = uuid();
        const traceSegmentId = uuid();
        const { host, origin, path } = parseUrl(url);

        const hasTrace =
          !notTraceOrigins(origin, noTraceOrigins) || (traceSDKInternal && isSDKInternal(path, collector));

        const segment: SegmentFields = {
          traceId: '',
          service: options.service,
          spans: [],
          serviceInstance: options.serviceVersion,
          traceSegmentId: '',
        };
        const logInfo: ErrorInfoFields = {
          uniqueId: uuid(),
          service: options.service,
          serviceVersion: options.serviceVersion,
          pagePath,
          category: ErrorsCategory.AJAX_ERROR,
          grade: GradeTypeEnum.ERROR,
          errorUrl: url,
          message: '',
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
            logTask.addTask(logInfo);
          }
          return originSuccess && originSuccess.call(this, res);
        };

        requestOptions.fail = function (res: WechatMiniprogram.GeneralCallbackResult) {
          logInfo.message = `statusText: ${res.errMsg};`;
          logTask.addTask(logInfo);
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
