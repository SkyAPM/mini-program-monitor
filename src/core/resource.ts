import type { OtlpResource, OtlpKeyValue, OtlpInstrumentationScope } from '../types/otlp';
import type { ResolvedOptions } from './options';

const SDK_NAME = 'mini-program-monitor';
declare const __SDK_VERSION__: string;
const SDK_VERSION = typeof __SDK_VERSION__ !== 'undefined' ? __SDK_VERSION__ : '0.0.0';

export function buildResource(options: ResolvedOptions): OtlpResource {
  const attrs: OtlpKeyValue[] = [
    { key: 'service.name', value: { stringValue: options.service } },
    { key: 'service.version', value: { stringValue: options.serviceVersion } },
  ];
  if (options.serviceInstance) {
    attrs.push({ key: 'service.instance.id', value: { stringValue: options.serviceInstance } });
  }
  attrs.push(
    { key: 'telemetry.sdk.name', value: { stringValue: SDK_NAME } },
    { key: 'telemetry.sdk.version', value: { stringValue: SDK_VERSION } },
    { key: 'miniprogram.platform', value: { stringValue: options.platform } },
  );
  return { attributes: attrs };
}

export function buildScope(): OtlpInstrumentationScope {
  return { name: SDK_NAME, version: SDK_VERSION };
}
