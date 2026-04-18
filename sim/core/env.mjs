const bool = (v, fallback) => {
  if (v == null) return fallback;
  const s = String(v).toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
};

const int = (v, fallback) => {
  if (v == null || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

export function parseEnv(platform) {
  const mode = process.env.MODE ?? 'loop';
  if (!['loop', 'timed', 'once'].includes(mode)) {
    throw new Error(`MODE must be one of loop|timed|once (got: ${mode})`);
  }
  if (mode === 'timed' && !process.env.DURATION_MS) {
    throw new Error('MODE=timed requires DURATION_MS');
  }

  const encoding = process.env.ENCODING ?? 'proto';
  if (!['proto', 'json'].includes(encoding)) {
    throw new Error(`ENCODING must be one of proto|json (got: ${encoding})`);
  }

  return {
    platform,
    mode,
    durationMs: int(process.env.DURATION_MS, undefined),
    scenario: process.env.SCENARIO ?? 'demo',
    collectorUrl: process.env.COLLECTOR_URL ?? 'http://127.0.0.1:4318',
    traceCollectorUrl: process.env.TRACE_COLLECTOR_URL ?? 'http://127.0.0.1:12801',
    service: process.env.SERVICE ?? `mini-program-sim-${platform}`,
    serviceVersion: process.env.SERVICE_VERSION ?? 'sim',
    serviceInstance:
      process.env.SERVICE_INSTANCE ??
      `sim-${Math.random().toString(36).slice(2, 8)}`,
    encoding,
    debug: bool(process.env.DEBUG, false),
  };
}
