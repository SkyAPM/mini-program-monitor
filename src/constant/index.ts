export const enum ReportType {
  ERROR = 'ERROR',
  ERRORS = 'ERRORS',
  PERF = 'PERF',
  SEGMENT = 'SEGMENT',
  SEGMENTS = 'SEGMENTS',
}

export const enum ReportUrl {
  ERROR = '/browser/errorLog',
  ERRORS = '/browser/errorLogs',
  PERF = '/browser/perfData',
  SEGMENT = '/v3/segment',
  SEGMENTS = '/v3/segments',
}

export enum ErrorsCategory {
  AJAX_ERROR = 'ajax',
  RESOURCE_ERROR = 'resource',
  VUE_ERROR = 'vue',
  PROMISE_ERROR = 'promise',
  JS_ERROR = 'js',
  UNKNOWN_ERROR = 'unknown',
}

export const ExcludeErrorTypes: string[] = [
  ErrorsCategory.AJAX_ERROR,
  ErrorsCategory.RESOURCE_ERROR,
  ErrorsCategory.UNKNOWN_ERROR,
];

export enum GradeTypeEnum {
  INFO = 'Info',
  WARNING = 'Warning',
  ERROR = 'Error',
}

export const SpanLayer = 'Http';
export const SpanType = 'Exit';

export const ComponentId = 10001; // ajax
// export const ServiceTag = '<wx-mini>';
export const ServiceTag = '<browser>';
export const swv = 'sw8';
