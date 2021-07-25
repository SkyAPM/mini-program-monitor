export interface CustomOptions extends CustomReportOptions {
  jsErrors?: boolean;
  apiErrors?: boolean;
  resourceErrors?: boolean;
  autoTracePerf?: boolean;
  traceSDKInternal?: boolean;
  detailMode?: boolean;
  noTraceOrigins?: (string | RegExp)[];
}

export interface CustomReportOptions {
  collector: string;
  service: string;
  pagePath: string;
  serviceVersion: string;
}

export interface ErrorInfoFields {
  uniqueId: string;
  category: string;
  grade: string;
  message: any;
  errorUrl: string;
  line?: number;
  col?: number;
  stack?: string;
  firstReportedError?: boolean;
}

export interface ReportFields {
  service: string;
  serviceVersion: string;
  pagePath: string;
}
