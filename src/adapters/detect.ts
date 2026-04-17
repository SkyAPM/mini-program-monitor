import { _global } from '../shared/global';
import type { PlatformAdapter } from './types';
import { createWechatAdapter } from './wechat';
import { createAlipayAdapter } from './alipay';

declare const wx: unknown;
declare const my: unknown;

export function detectPlatformName(): 'wechat' | 'alipay' | undefined {
  if (typeof wx !== 'undefined') return 'wechat';
  if (typeof my !== 'undefined') return 'alipay';
  const g = _global as { wx?: unknown; my?: unknown };
  if (g.wx) return 'wechat';
  if (g.my) return 'alipay';
  return undefined;
}

export function detectPlatform(hint?: 'wechat' | 'alipay'): PlatformAdapter {
  const name = hint ?? detectPlatformName();
  if (name === 'wechat') return createWechatAdapter();
  if (name === 'alipay') return createAlipayAdapter();

  throw new Error(
    'mini-program-monitor: could not detect platform. ' +
      'Neither wx nor my global found. Pass platform: "wechat" or "alipay" to init().',
  );
}
