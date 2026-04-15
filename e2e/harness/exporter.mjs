// Stand-in exporter used by the e2e harness until the real SkyWalking
// exporter lands in M2. It translates internal MonitorEvent records
// (kind: 'error') into the OAP browser protocol's BrowserErrorLog JSON
// shape and POSTs them to /browser/errorLogs using Node's global fetch.
//
// When M2 vendors the real exporter under src/vendor/skywalking/, this
// file goes away — the harness will import the SDK's production
// SkyWalkingExporter instead.
import { randomUUID } from 'node:crypto';

export class HarnessSkyWalkingExporter {
  constructor({ collector, service, serviceVersion = 'v0.1.0-alpha.0' }) {
    this.collector = collector.replace(/\/$/, '');
    this.service = service;
    this.serviceVersion = serviceVersion;
  }

  async export(events) {
    const errorLogs = [];
    for (const e of events) {
      if (e.kind !== 'error') continue;
      const p = e.payload ?? {};
      errorLogs.push({
        uniqueId: randomUUID(),
        service: this.service,
        serviceVersion: this.serviceVersion,
        pagePath: p.pagePath ?? 'unknown',
        category: p.category ?? 'JS',
        grade: p.grade ?? 'ERROR',
        message: p.message ?? 'unknown error',
        line: p.line ?? 0,
        col: p.col ?? 0,
        stack: p.stack ?? '',
        errorUrl: p.errorUrl ?? p.pagePath ?? 'unknown',
        firstReportedError: true,
      });
    }
    if (errorLogs.length === 0) return;

    const url = `${this.collector}/browser/errorLogs`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(errorLogs),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OAP rejected errorLogs (${res.status}): ${body}`);
    }
    console.log(`[harness] exported ${errorLogs.length} errorLog(s) to ${url} → ${res.status}`);
  }
}
