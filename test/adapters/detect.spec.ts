import { describe, it, expect, beforeEach } from 'vitest';
import { detectPlatform } from '../../src/adapters/detect';

beforeEach(() => {
  delete (globalThis as Record<string, unknown>).my;
});

describe('detectPlatform', () => {
  it('returns wechat adapter when wx global exists', () => {
    const adapter = detectPlatform();
    expect(adapter.name).toBe('wechat');
  });

  it('returns alipay adapter when hint is alipay (even with wx present)', () => {
    (globalThis as Record<string, unknown>).my = {
      request: () => {}, onError: () => {}, offError: () => {},
      onUnhandledRejection: () => {}, offUnhandledRejection: () => {},
      onAppShow: () => {}, offAppShow: () => {}, onAppHide: () => {}, offAppHide: () => {},
      getSystemInfoSync: () => ({ brand: '', model: '', SDKVersion: '', platform: '', system: '' }),
      setStorageSync: () => {}, getStorageSync: () => ({ data: '' }),
    };
    const adapter = detectPlatform('alipay');
    expect(adapter.name).toBe('alipay');
  });

  it('auto-detects alipay when only my global exists', () => {
    delete (globalThis as Record<string, unknown>).wx;
    (globalThis as Record<string, unknown>).my = {
      request: () => {}, onError: () => {}, offError: () => {},
      onUnhandledRejection: () => {}, offUnhandledRejection: () => {},
      onAppShow: () => {}, offAppShow: () => {}, onAppHide: () => {}, offAppHide: () => {},
      getSystemInfoSync: () => ({ brand: '', model: '', SDKVersion: '', platform: '', system: '' }),
      setStorageSync: () => {}, getStorageSync: () => ({ data: '' }),
    };
    const adapter = detectPlatform();
    expect(adapter.name).toBe('alipay');
  });

  it('throws when neither wx nor my exists and no hint', () => {
    delete (globalThis as Record<string, unknown>).wx;
    expect(() => detectPlatform()).toThrow(/could not detect platform/);
  });

  it('honors explicit wechat hint', () => {
    const adapter = detectPlatform('wechat');
    expect(adapter.name).toBe('wechat');
  });

  it('carries per-platform SkyWalking componentId (wechat=10002, alipay=10003)', () => {
    (globalThis as Record<string, unknown>).my = {
      request: () => {}, onError: () => {}, offError: () => {},
      onUnhandledRejection: () => {}, offUnhandledRejection: () => {},
      onAppShow: () => {}, offAppShow: () => {}, onAppHide: () => {}, offAppHide: () => {},
      getSystemInfoSync: () => ({ brand: '', model: '', SDKVersion: '', platform: '', system: '' }),
      setStorageSync: () => {}, getStorageSync: () => ({ data: '' }),
    };
    expect(detectPlatform('wechat').componentId).toBe(10002);
    expect(detectPlatform('alipay').componentId).toBe(10003);
  });
});
