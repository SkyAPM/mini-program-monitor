import type { PlatformAdapter } from './types';
import { createWechatAdapter } from './wechat';
import { createAlipayAdapter } from './alipay';

export function detectPlatform(hint?: 'wechat' | 'alipay'): PlatformAdapter {
  if (hint === 'wechat') return createWechatAdapter();
  if (hint === 'alipay') return createAlipayAdapter();

  const g = globalThis as { wx?: unknown; my?: unknown };
  if (g.wx) return createWechatAdapter();
  if (g.my) return createAlipayAdapter();

  throw new Error(
    'mini-program-monitor: could not detect platform. ' +
      'Neither wx nor my global found. Pass platform: "wechat" or "alipay" to init().',
  );
}
