import { encode } from 'js-base64';
import { ServiceTag, ErrorsCategory, GradeTypeEnum, swv } from '@/constant';
import { uuid, parseUrl, now } from '@/utils';
import { store } from '@/store';
import { SegmentFields } from './types';

const { options } = store;

export function rewriteNetwork(): void {
  //todo
  const networkMethods = ['request', 'downloadFile', 'uploadFile'];
  networkMethods.forEach((method) => {
    const originRequest = wx[method];
    Object.defineProperty(wx, method, {
      writable: true,
      enumerable: true,
      configurable: true,
      value: function (
        reqOptions:
          | WechatMiniprogram.RequestOption
          | WechatMiniprogram.DownloadFileOption
          | WechatMiniprogram.UploadFileOption,
      ) {
        const { url, header = {}, fail: _fail, success: _success } = reqOptions;
        // if (noTraceOrigins(url) || noTraceSDKInternal()) {
        //   return originRequest.call(this, reqOptions);
        // }
        // const startTime = now();
        const traceId = uuid();
        const traceSegmentId = uuid();
        const { host } = parseUrl(url);
        header[swv] = generateSWHeader({ traceId, traceSegmentId, host });
        reqOptions.header = header;

        const logInfo = {
          uniqueId: uuid(),
          service: options.service,
          serviceVersion: options.serviceVersion,
          pagePath: options.pagePath,
          category: ErrorsCategory.AJAX_ERROR,
          grade: GradeTypeEnum.ERROR,
          errorUrl: url,
          message: '',
          collector: options.collector,
          stack: '',
        };

        reqOptions.success = function (
          res:
            | WechatMiniprogram.RequestSuccessCallbackResult
            | (WechatMiniprogram.DownloadFileSuccessCallbackResult & { data: any })
            | WechatMiniprogram.UploadFileSuccessCallbackResult,
        ) {
          const { statusCode, errMsg, data = '' } = res;
          if (statusCode === 0 || statusCode >= 400) {
            logInfo.message = `status: ${statusCode}; statusText: ${errMsg};`;
            logInfo.stack = `request: ${data};`;
          }
          store.addLogTask(logInfo);
          return _success && _success.call(this, res);
        };

        reqOptions.fail = function (res) {
          logInfo.message = `statusText: ${res.errMsg};`;
          store.addLogTask(logInfo);
          return _fail && _fail.call(this, res);
        };

        return originRequest.call(this, reqOptions);
      },
    });
  });
}

function noTraceOrigins(url: string): boolean {
  return options.noTraceOrigins.some((rule: string | RegExp) => {
    if (typeof rule === 'string') {
      return url.includes(rule);
    } else if (rule instanceof RegExp) {
      return rule.test(url);
    }
  });
}

function noTraceSDKInternal() {
  // todo
}

function generateSWHeader({ traceId, traceSegmentId, host }) {
  const segment = {
    traceId: '',
    service: options.service + ServiceTag,
    spans: [],
    serviceInstance: options.serviceVersion,
    traceSegmentId: '',
  } as SegmentFields;
  const traceIdStr = String(encode(traceId));
  const segmentId = String(encode(traceSegmentId));
  const service = String(encode(segment.service));
  const instance = String(encode(segment.serviceInstance));
  const endpoint = String(encode(options.pagePath));
  const peer = String(encode(host));
  const index = segment.spans.length;
  return `${1}-${traceIdStr}-${segmentId}-${index}-${service}-${instance}-${endpoint}-${peer}`;
}
