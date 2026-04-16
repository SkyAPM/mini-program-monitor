import type { MonitorOptions, EnableFlags, TracingOptions, RequestOptions } from '../types/options';

export interface ResolvedOptions {
  service: string;
  serviceVersion: string;
  serviceInstance: string;
  collector: string;
  platform: 'wechat' | 'alipay';
  enable: Required<EnableFlags>;
  tracing: Required<TracingOptions>;
  request: Required<RequestOptions>;
  maxQueue: number;
  flushInterval: number;
  debug: boolean;
}

export function resolveOptions(opts: MonitorOptions): ResolvedOptions {
  if (!opts.service) {
    throw new Error('mini-program-monitor: `service` is required');
  }
  return {
    service: opts.service,
    serviceVersion: opts.serviceVersion ?? 'v0.0.0',
    serviceInstance: opts.serviceInstance ?? autoInstance(),
    collector: opts.collector ?? '',
    platform: opts.platform ?? 'wechat',
    enable: {
      error: opts.enable?.error ?? true,
      perf: opts.enable?.perf ?? true,
      request: opts.enable?.request ?? true,
      tracing: opts.enable?.tracing ?? false,
    },
    tracing: {
      sampleRate: opts.tracing?.sampleRate ?? 1,
      urlBlacklist: opts.tracing?.urlBlacklist ?? [],
    },
    request: {
      urlGroupRules: opts.request?.urlGroupRules ?? {},
    },
    maxQueue: opts.maxQueue ?? 200,
    flushInterval: opts.flushInterval ?? 5000,
    debug: opts.debug ?? false,
  };
}

function autoInstance(): string {
  return `mp-${Math.random().toString(36).slice(2, 10)}`;
}
