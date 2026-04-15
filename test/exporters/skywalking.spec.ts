import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SkyWalkingExporter } from '../../src/exporters/skywalking';
import type { MonitorEvent } from '../../src/types/events';
import type { BrowserErrorLog } from '../../src/vendor/skywalking/protocol';

type RequestOpts = {
  url: string;
  method: string;
  data: unknown;
  header: Record<string, string>;
  success?: (res: { statusCode: number }) => void;
  fail?: (err: { errMsg: string }) => void;
};

let requestMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  requestMock = vi.fn();
  (globalThis as unknown as { wx: Record<string, unknown> }).wx.request = requestMock;
});

const fakeError: BrowserErrorLog = {
  uniqueId: 'u-1',
  service: 'svc',
  serviceVersion: 'v1',
  pagePath: 'pages/index/index',
  category: 'js',
  grade: 'Error',
  message: 'boom',
  errorUrl: 'pages/index/index',
  stack: '',
};

function errorEvent(payload: BrowserErrorLog = fakeError): MonitorEvent {
  return { kind: 'error', time: 1, payload };
}

describe('SkyWalkingExporter', () => {
  it('POSTs error events to /browser/errorLogs', async () => {
    requestMock.mockImplementation((opts: RequestOpts) => opts.success?.({ statusCode: 200 }));
    const exporter = new SkyWalkingExporter({ collector: 'http://oap.example:12800' });
    await exporter.export([errorEvent()]);

    expect(requestMock).toHaveBeenCalledOnce();
    const call = requestMock.mock.calls[0][0] as RequestOpts;
    expect(call.url).toBe('http://oap.example:12800/browser/errorLogs');
    expect(call.method).toBe('POST');
    expect(call.header['Content-Type']).toBe('application/json');
    expect(Array.isArray(call.data)).toBe(true);
    expect((call.data as BrowserErrorLog[])[0].message).toBe('boom');
  });

  it('rejects on non-2xx status', async () => {
    requestMock.mockImplementation((opts: RequestOpts) => opts.success?.({ statusCode: 500 }));
    const exporter = new SkyWalkingExporter({ collector: 'http://oap.example:12800' });
    await expect(exporter.export([errorEvent()])).rejects.toThrow(/500/);
  });

  it('rejects on wx.request fail', async () => {
    requestMock.mockImplementation((opts: RequestOpts) => opts.fail?.({ errMsg: 'timeout' }));
    const exporter = new SkyWalkingExporter({ collector: 'http://oap.example:12800' });
    await expect(exporter.export([errorEvent()])).rejects.toThrow(/timeout/);
  });

  it('skips POST when there are no error events', async () => {
    const exporter = new SkyWalkingExporter({ collector: 'http://oap.example:12800' });
    await exporter.export([{ kind: 'log', time: 1, payload: 'x' }]);
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('trims trailing slashes from the collector URL', async () => {
    requestMock.mockImplementation((opts: RequestOpts) => opts.success?.({ statusCode: 200 }));
    const exporter = new SkyWalkingExporter({ collector: 'http://oap.example:12800///' });
    await exporter.export([errorEvent()]);
    const call = requestMock.mock.calls[0][0] as RequestOpts;
    expect(call.url).toBe('http://oap.example:12800/browser/errorLogs');
  });

  it('exposes the collector URL for loop-prevention', () => {
    const exporter = new SkyWalkingExporter({ collector: 'http://oap.example:12800/' });
    expect(exporter.getCollectorUrl()).toBe('http://oap.example:12800');
  });
});
