import { _global } from '../shared/global';
import type { PlatformAdapter } from './types';
import { createWechatAdapter } from './wechat';
import { createAlipayAdapter } from './alipay';

// Platform globals are injected into module scope, not always on the
// global object. Declare them so we can typeof-check directly.
declare const wx: unknown;
declare const my: unknown;

export function detectPlatform(hint?: 'wechat' | 'alipay'): PlatformAdapter {
  if (hint === 'wechat') return createWechatAdapter();
  if (hint === 'alipay') return createAlipayAdapter();

  if (typeof wx !== 'undefined') return createWechatAdapter();
  if (typeof my !== 'undefined') return createAlipayAdapter();

  throw new Error(
    'mini-program-monitor: could not detect platform. ' +
      'Neither wx nor my global found. Pass platform: "wechat" or "alipay" to init().',
  );
}
