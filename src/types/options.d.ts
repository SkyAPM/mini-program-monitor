export interface CustomOptionsType {
  collector: string;
  service: string;
  pagePath: string;
  serviceVersion: string;
  jsErrors?: boolean;
  apiErrors?: boolean;
  resourceErrors?: boolean;
  autoTracePerf?: boolean;
  useFmp?: boolean;
  enableSPA?: boolean;
  vue?: any;
  errorLogLimit?: number;
  errorLogTimeInterval?: number;
  traceSDKInternal?: boolean;
  detailMode?: boolean;
  noTraceOrigins?: (string | RegExp)[];
  traceLimit?: number;
  traceTimeInterval?: number;
  customTags?: TagOption[];
}

export type TagOption = {
  key: string;
  value: string;
};

export interface ReportFields {
  service: string;
  serviceVersion: string;
  pagePath: string;
}

export interface ErrorInfoFields extends ReportFields {
  uniqueId: string;
  category: string;
  grade: string;
  message: any;
  errorUrl: string;
  errorQuery?: Record<string, unknown>;
  isEntryPage?: boolean;
  line?: number;
  col?: number;
  stack?: string;
  firstReportedError?: boolean;
}
