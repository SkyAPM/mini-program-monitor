let debugEnabled = false;

export function setDebug(v: boolean): void {
  debugEnabled = v;
}

export function debug(...args: unknown[]): void {
  if (debugEnabled) console.log('[mpm]', ...args);
}

export function warn(...args: unknown[]): void {
  console.warn('[mpm]', ...args);
}
