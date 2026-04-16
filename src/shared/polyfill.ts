// Alipay's JSCore does not have globalThis. Polyfill it so the SDK
// can use a single global reference across all platforms.
/* eslint-disable */
(function (this: Record<string, unknown>): void {
  if (typeof globalThis !== 'undefined') return;
  this.globalThis = this;
  // @ts-ignore - globalThis may not be in the type system yet
}).call(Function('return this')());
