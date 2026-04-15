type WxLike = WechatMiniprogram.Wx;

let cached: WxLike | null = null;

export function getWx(): WxLike {
  if (cached) return cached;
  const g = globalThis as { wx?: WxLike };
  if (g.wx) {
    cached = g.wx;
    return cached;
  }
  throw new Error(
    'mini-program-monitor: wx global not found. The SDK must run inside a WeChat mini-program runtime.',
  );
}

export function resetWxForTests(): void {
  cached = null;
}
