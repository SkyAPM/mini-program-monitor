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

export type LifecycleHook = (...args: unknown[]) => void;

export type Uninstall = () => void;

export interface PlatformAdapter {
  readonly name: 'wechat' | 'alipay';

  // SkyWalking component ID for exit spans this adapter produces.
  // Reserved per-platform: 10002 = WeChat-MiniProgram, 10003 = Alipay-MiniProgram.
  // OAP's component-libraries.yml registration tracks these values.
  readonly componentId: number;

  request(opts: AdapterRequestOpts): void;

  onError(cb: (msg: string) => void): Uninstall;
  onUnhandledRejection(cb: (res: { reason: unknown }) => void): Uninstall;
  onPageNotFound?(cb: (res: { path: string; query?: Record<string, string>; isEntryPage?: boolean }) => void): Uninstall;

  onAppShow(cb: () => void): Uninstall;
  onAppHide(cb: () => void): Uninstall;

  hasPerformanceObserver: boolean;
  getPerformance?(): PerfHandle;

  wrapApp?(hooks: {
    onLaunch?: LifecycleHook;
    onShow?: LifecycleHook;
  }): Uninstall;

  wrapPage?(hooks: {
    onLoad?: LifecycleHook;
    onReady?: LifecycleHook;
    onShow?: LifecycleHook;
    onHide?: LifecycleHook;
  }): Uninstall;

  interceptRequest(
    wrapper: (
      originalRequest: (opts: AdapterRequestOpts) => void,
      opts: AdapterRequestOpts,
    ) => void,
  ): Uninstall;

  interceptDownloadFile?(
    wrapper: (
      originalDownload: (opts: AdapterRequestOpts) => void,
      opts: AdapterRequestOpts,
    ) => void,
  ): Uninstall;

  interceptUploadFile?(
    wrapper: (
      originalUpload: (opts: AdapterRequestOpts) => void,
      opts: AdapterRequestOpts,
    ) => void,
  ): Uninstall;

  getSystemInfoSync(): { brand: string; model: string; SDKVersion: string; platform: string; system: string };

  setStorageSync(key: string, data: string): void;
  getStorageSync(key: string): string;
}
