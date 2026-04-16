export interface AdapterRequestOpts {
  url: string;
  method: string;
  data?: unknown;
  headers: Record<string, string>;
  onSuccess(statusCode: number, data: unknown, headers: Record<string, string>): void;
  onFail(errMsg: string): void;
}

export interface PerfObserverHandle {
  observe(opts: { entryTypes: string[] }): void;
  disconnect(): void;
}

export interface PerfEntry {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
  path?: string;
  referrerPath?: string;
  navigationType?: string;
  packageName?: string;
  packageSize?: number;
}

export interface PerfEntryList {
  getEntries(): PerfEntry[];
}

export interface PerfHandle {
  createObserver(cb: (entryList: PerfEntryList) => void): PerfObserverHandle;
  getEntries(): PerfEntry[];
}

export interface PlatformAdapter {
  readonly name: 'wechat' | 'alipay';

  request(opts: AdapterRequestOpts): void;

  onError(cb: (msg: string) => void): void;
  onUnhandledRejection(cb: (res: { reason: unknown }) => void): void;
  onPageNotFound?(cb: (res: { path: string; query?: Record<string, string>; isEntryPage?: boolean }) => void): void;

  onAppShow(cb: () => void): void;
  onAppHide(cb: () => void): void;

  hasPerformanceObserver: boolean;
  getPerformance?(): PerfHandle;

  getSystemInfoSync(): { brand: string; model: string; SDKVersion: string; platform: string; system: string };

  setStorageSync(key: string, data: string): void;
  getStorageSync(key: string): string;
}
