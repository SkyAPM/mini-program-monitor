import { vi, beforeEach } from 'vitest';
import { resetWxForTests } from '../src/shared/wx';

beforeEach(() => {
  resetWxForTests();
  (globalThis as unknown as { wx: unknown }).wx = {
    request: vi.fn(),
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
});
