import { jitter, randRange, pickOne, pickWeighted, pickStatusCode } from './fixtures.mjs';

export function createTriggers({ platform, platformApi, fixtures, scenario, sdk }) {
  const pages = scenario.pages ?? ['pages/index/index'];
  let currentPage = pages[0];

  const setPage = (route) => {
    currentPage = route;
    globalThis.getCurrentPages = () => [{ route }];
  };
  setPage(currentPage);

  const errorTemplates = (key) => {
    const scenarioTemplates = scenario.errors?.[key]?.templates ?? [];
    const fallback = fixtures.errors?.[key] ?? [];
    return scenarioTemplates.length > 0 ? scenarioTemplates : fallback;
  };

  return {
    navigate() {
      const next = pickOne(pages);
      setPage(next);
      if (scenario.perf?.onNavigate) this.firePerf(next);
    },

    fireRequest() {
      const urlPool = scenario.requests?.urls ?? fixtures.urls;
      if (!urlPool.length) return;
      const urlCfg = pickWeighted(urlPool);
      const latencyMs = randRange(urlCfg.latencyMs ?? [50, 200]);
      const statusCode = pickStatusCode(urlCfg.statusMix ?? { '200': 1 });

      platformApi.prepareRequestSim({ latencyMs, statusCode });
      platformApi.request(urlCfg.url, urlCfg.method ?? 'GET');
    },

    fireError() {
      const templates = errorTemplates('js');
      if (!templates.length) return;
      const tpl = pickOne(templates);
      platformApi.fireError(tpl);
    },

    fireRejection() {
      const templates = errorTemplates('promise');
      if (!templates.length) return;
      const tpl = pickOne(templates);
      platformApi.fireRejection({ reason: new Error(tpl) });
    },

    firePageNotFound() {
      if (!platformApi.firePageNotFound) return;
      const paths = scenario.errors?.pageNotFound?.paths ?? [];
      if (!paths.length) return;
      platformApi.firePageNotFound({ path: pickOne(paths), isEntryPage: true });
    },

    fireManual() {
      const templates = errorTemplates('manual');
      if (!templates.length) return;
      sdk.record('log', {
        timeUnixNano: String(Date.now()) + '000000',
        severityNumber: 17,
        severityText: 'ERROR',
        body: { stringValue: pickOne(templates) },
        attributes: [
          { key: 'exception.type', value: { stringValue: 'manual' } },
          { key: 'miniprogram.page.path', value: { stringValue: currentPage } },
        ],
      });
    },

    firePerf(pagePath = currentPage) {
      const perf = scenario.perf;
      if (!perf) return;
      if (platform === 'wechat' && platformApi.firePerfEntries) {
        platformApi.firePerfEntries([
          { name: 'appLaunch',   entryType: 'navigation', startTime: 0, duration: randRange(perf.appLaunch   ?? [800, 1800]), path: pagePath },
          { name: 'firstRender', entryType: 'render',     startTime: 0, duration: randRange(perf.firstRender ?? [200, 600]),  path: pagePath },
          { name: 'firstPaint',  entryType: 'render',     startTime: 0, duration: 0, path: pagePath },
        ]);
      } else if (platform === 'alipay' && platformApi.fireLifecycleForPerf) {
        platformApi.fireLifecycleForPerf({
          appLaunchMs: randRange(perf.appLaunch ?? [800, 1800]),
          firstRenderMs: randRange(perf.firstRender ?? [200, 600]),
          pagePath,
        });
      }
    },

    fireLifecycle() {
      platformApi.fireAppHide?.();
      setTimeout(() => platformApi.fireAppShow?.(), 1000);
    },
  };
}

export function scheduleTimers(triggers, scenario) {
  const handles = [];
  const every = (ms, fn) => {
    if (!ms) return;
    const tick = () => {
      try { fn(); } catch (e) { console.error('[sim] tick error:', e); }
      handles.push(setTimeout(tick, jitter(ms)));
    };
    handles.push(setTimeout(tick, jitter(ms)));
  };

  every(scenario.requests?.everyMs, () => triggers.fireRequest());
  every(scenario.navigate?.everyMs, () => triggers.navigate());
  every(scenario.errors?.js?.everyMs, () => triggers.fireError());
  every(scenario.errors?.promise?.everyMs, () => triggers.fireRejection());
  every(scenario.errors?.pageNotFound?.everyMs, () => triggers.firePageNotFound());
  every(scenario.errors?.manual?.everyMs, () => triggers.fireManual());
  every(scenario.lifecycle?.hideShowEveryMs, () => triggers.fireLifecycle());

  return () => { for (const h of handles) clearTimeout(h); };
}
