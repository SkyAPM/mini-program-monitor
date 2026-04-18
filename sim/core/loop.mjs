import { parseEnv } from './env.mjs';
import { loadFixtures, loadScenario } from './fixtures.mjs';
import { createTriggers, scheduleTimers } from './triggers.mjs';

export async function runSim(platform, { platformApi, setupFakeSystemInfo }) {
  const cfg = parseEnv(platform);
  const fixtures = loadFixtures(platform);
  const scenario = loadScenario(platform, cfg.scenario);

  setupFakeSystemInfo(fixtures.systemInfo);

  const registerHost = (url) => {
    try {
      const u = new URL(url);
      platformApi.registerRealHost?.(u.host);
    } catch { /* ignore malformed url */ }
  };
  registerHost(cfg.collectorUrl);
  registerHost(cfg.traceCollectorUrl);

  const sdk = await import('../../dist/index.mjs');

  sdk.init({
    service: cfg.service,
    serviceVersion: cfg.serviceVersion,
    serviceInstance: cfg.serviceInstance,
    collector: cfg.collectorUrl,
    traceCollector: cfg.traceCollectorUrl,
    platform,
    encoding: cfg.encoding,
    enable: { error: true, perf: true, request: true, tracing: true },
    flushInterval: cfg.mode === 'once' ? 60_000 : 5_000,
    debug: cfg.debug,
  });

  console.log(`[sim] ${platform} / scenario=${cfg.scenario} / mode=${cfg.mode} / encoding=${cfg.encoding}`);
  console.log(`[sim] collector=${cfg.collectorUrl} trace=${cfg.traceCollectorUrl}`);

  const triggers = createTriggers({ platform, platformApi, fixtures, scenario, sdk });

  const shutdown = async (code = 0) => {
    try { await sdk.flush(); } catch (e) { console.error('[sim] flush error:', e); }
    await new Promise((r) => setTimeout(r, 500));
    try { sdk.shutdown(); } catch (e) { console.error('[sim] shutdown error:', e); }
    console.log(`[sim] done (exit=${code})`);
    process.exit(code);
  };

  const warmup = () => {
    triggers.firePerf();
    triggers.fireError();
    triggers.fireRejection();
    triggers.firePageNotFound();
    triggers.fireManual();
    triggers.fireRequest();
  };

  if (cfg.mode === 'once') {
    warmup();
    await new Promise((r) => setTimeout(r, 1500));
    await shutdown(0);
    return;
  }

  warmup();
  const clearTimers = scheduleTimers(triggers, scenario);

  process.on('SIGTERM', async () => { clearTimers(); await shutdown(0); });
  process.on('SIGINT',  async () => { clearTimers(); await shutdown(0); });

  if (cfg.mode === 'timed') {
    setTimeout(async () => { clearTimers(); await shutdown(0); }, cfg.durationMs);
  }
}
