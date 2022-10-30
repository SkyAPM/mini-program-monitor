export interface CustomOptionsType extends CustomReportOptions {
  jsErrors?: boolean;
  apiErrors?: boolean;
  resourceErrors?: boolean;
  autoTracePerf?: boolean;
  useFmp?: boolean;
  enableSPA?: boolean;
  vue?: any;
  traceSDKInternal?: boolean;
  detailMode?: boolean;
  noTraceOrigins?: (string | RegExp)[];
  traceTimeInterval?: number;
  customTags?: TagOption[];
}

export interface CustomReportOptions {
  collector: string;
  service: string;
  pagePath: string;
  serviceVersion: string;
}

export type TagOption = {
  key: string;
  value: string;
};

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
