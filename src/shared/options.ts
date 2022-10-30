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

  setOptions(options: CustomOptionsType) {
    const { collector, service, serviceVersion, pagePath, jsErrors, customTags } = options;

    this.validateOption('collector', collector, 'string');
    this.validateOption('service', service, 'string');
    this.validateOption('serviceVersion', serviceVersion, 'string');
    this.validateOption('pagePath', pagePath, 'string');
    this.validateOption('jsErrors', jsErrors, 'string');
    this.validateTags(customTags);
  }
  validateOption(key, value, expectType) {
    if (typeof value === expectType) {
      this[key] = value;
    } else if (typeof value !== 'undefined') {
      console.error(`'${key}' is expected to be of type '${expectType}' but was actually of type '${typeof value}'`);
    }
  }
  validateTags(customTags?: TagOption[]) {
    if (!customTags) {
      return false;
    }
    if (!Array.isArray(customTags)) {
      console.error('customTags error');
      return false;
    }
    let isTags = true;
    for (const tag of customTags) {
      if (!(tag && tag.key && tag.value)) {
        isTags = false;
      }
    }
    if (!isTags) {
      console.error('customTags error');
      return false;
    }
    this.customTags = customTags;
  }
}

export const options = new Options();
