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
