import { describe, it, expect } from 'vitest';
import { buildResource } from '../../src/core/resource';
import { resolveOptions } from '../../src/core/options';

describe('buildResource', () => {
  it('omits service.instance.id when operator does not supply one', () => {
    const res = buildResource(resolveOptions({ service: 'svc' }));
    const keys = res.attributes.map((a) => a.key);
    expect(keys).toContain('service.name');
    expect(keys).toContain('service.version');
    expect(keys).not.toContain('service.instance.id');
    expect(keys).toContain('miniprogram.platform');
    expect(keys).toContain('telemetry.sdk.name');
  });

  it('emits the SkyWalking layer of the platform as service.layer', () => {
    const layerOf = (platform: 'wechat' | 'alipay') =>
      buildResource(resolveOptions({ service: 'svc', platform })).attributes
        .find((a) => a.key === 'service.layer')?.value.stringValue;
    expect(layerOf('wechat')).toBe('WECHAT_MINI_PROGRAM');
    expect(layerOf('alipay')).toBe('ALIPAY_MINI_PROGRAM');
  });

  it('emits service.instance.id when operator supplies one', () => {
    const res = buildResource(resolveOptions({ service: 'svc', serviceInstance: 'inst-42' }));
    const inst = res.attributes.find((a) => a.key === 'service.instance.id');
    expect(inst?.value.stringValue).toBe('inst-42');
  });
});
