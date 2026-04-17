import { vi, beforeEach } from 'vitest';

beforeEach(() => {
  // WeChat-style wx mock (default platform for tests)
  (globalThis as unknown as { wx: unknown }).wx = {
    request: vi.fn(),
    downloadFile: vi.fn(),
    uploadFile: vi.fn(),
    onError: vi.fn(),
    onUnhandledRejection: vi.fn(),
    onPageNotFound: vi.fn(),
    onAppHide: vi.fn(),
    onAppShow: vi.fn(),
    onMemoryWarning: vi.fn(),
    onNetworkStatusChange: vi.fn(),
    getNetworkType: vi.fn((opt: { success?: (r: { networkType: string }) => void }) =>
      opt?.success?.({ networkType: 'wifi' }),
    ),
    setStorageSync: vi.fn(),
    getStorageSync: vi.fn(() => ''),
    getSystemInfoSync: vi.fn(() => ({
      brand: 'test',
      model: 'x',
      SDKVersion: '3.0.0',
      platform: 'devtools',
      system: 'iOS 17',
    })),
    getPerformance: vi.fn(() => ({
      createObserver: () => ({ observe: () => {}, disconnect: () => {} }),
      getEntries: () => [],
    })),
  };
  // Alipay-style my mock (not set by default; individual tests add it)
  delete (globalThis as Record<string, unknown>).my;
  (globalThis as unknown as { getCurrentPages: () => unknown[] }).getCurrentPages = () => [
    { route: 'pages/index/index' },
  ];
});
