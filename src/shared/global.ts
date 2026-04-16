// Returns the global object in any environment: Node, WeChat JSCore,
// Alipay JSCore (which lacks globalThis).
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const _global: Record<string, unknown> = new Function('return this')();
export { _global };
