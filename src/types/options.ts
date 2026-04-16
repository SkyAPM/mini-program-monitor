export interface EnableFlags {
  error?: boolean;
  perf?: boolean;
  request?: boolean;
  tracing?: boolean;
}

export interface TracingOptions {
  sampleRate?: number;
  urlBlacklist?: (string | RegExp)[];
}

export interface RequestOptions {
  urlGroupRules?: Record<string, RegExp>;
}

export interface MonitorOptions {
  service: string;
  serviceVersion?: string;
  serviceInstance?: string;
  collector?: string;
  platform?: 'wechat' | 'alipay';
  enable?: EnableFlags;
  tracing?: TracingOptions;
  request?: RequestOptions;
  maxQueue?: number;
  flushInterval?: number;
  debug?: boolean;
}
