import { CustomOptionsType, TagOption } from '@/types/options';

class Options implements CustomOptionsType {
  collector = ''; // report serve
  service: string;
  serviceVersion: string;
  pagePath: string;

  jsErrors = true; // vue, js and promise errorLog
  apiErrors = true;
  resourceErrors = true;
  traceSDKInternal = false;
  detailMode = true;
  noTraceOrigins = [];
  customTags: TagOption[];
  traceTimeInterval = 6000;

  init(options: CustomOptionsType) {
    const {
      collector,
      service,
      serviceVersion,
      pagePath,
      jsErrors,
      apiErrors,
      resourceErrors,
      errorLogLimit,
      errorLogTimeInterval,
      traceLimit,
      traceSDKInternal,
      detailMode,
      noTraceOrigins,
      customTags,
      traceTimeInterval,
    } = options || {};
    this.validateOption('collector', collector, 'string', true);
    this.validateOption('service', service, 'string', true);
    this.validateOption('serviceVersion', serviceVersion, 'string', true);
    this.validateOption('pagePath', pagePath, 'string');
    this.validateOption('jsErrors', jsErrors, 'string');
    this.validateOption('apiErrors', apiErrors, 'string');
    this.validateOption('resourceErrors', resourceErrors, 'string');
    this.validateOption('traceSDKInternal', traceSDKInternal, 'string');
    this.validateOption('detailMode', detailMode, 'string');
    this.validateOption('noTraceOrigins', noTraceOrigins, 'string');
    this.validateOption('errorLogLimit', errorLogLimit, 'number');
    this.validateOption('errorLogTimeInterval', errorLogTimeInterval, 'number');
    this.validateOption('traceLimit', traceLimit, 'number');
    this.validateOption('traceTimeInterval', traceTimeInterval, 'number');
    this.validateTags(customTags);
  }

  setPagePath(pagePath) {
    this.pagePath = pagePath;
  }

  private validateOption(key, value, expectType, isRequired?: boolean) {
    if (typeof value === expectType) {
      this[key] = value;
    } else if (isRequired) {
      throw Error(`'${key}' is required and is expected to be of type '${typeof expectType}'`);
    } else if (typeof value !== 'undefined') {
      console.error(`'${key}' is expected to be of type '${expectType}' but was actually of type '${typeof value}'`);
    }
  }

  private validateTags(customTags?: TagOption[]) {
    if (!customTags) {
      return false;
    }
    if (!Array.isArray(customTags)) {
      console.error('customTags error');
      return;
    }
    const isValid = customTags.every((tag) => !!(tag && tag.key && tag.value));
    if (!isValid) {
      console.error('customTags error');
      return;
    }
    this.customTags = customTags;
  }
}

export const options = new Options();
