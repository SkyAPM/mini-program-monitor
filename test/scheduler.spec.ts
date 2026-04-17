import { describe, it, expect, vi } from 'vitest';
import { RingQueue } from '../src/core/queue';
import { Scheduler } from '../src/core/scheduler';

describe('Scheduler', () => {
  it('flushes drained events through the exporter', async () => {
    const q = new RingQueue(10);
    q.push({ kind: 'log', time: 1, payload: 'hello' });
    const exporter = { export: vi.fn() };
    const s = new Scheduler(q, exporter, 1000);
    await s.flush();
    expect(exporter.export).toHaveBeenCalledOnce();
    expect(exporter.export.mock.calls[0][0]).toHaveLength(1);
    expect(q.size()).toBe(0);
  });

  it('skips export when queue is empty', async () => {
    const q = new RingQueue(10);
    const exporter = { export: vi.fn() };
    const s = new Scheduler(q, exporter, 1000);
    await s.flush();
    expect(exporter.export).not.toHaveBeenCalled();
  });

  it('swallows exporter errors so the SDK never crashes the host', async () => {
    const q = new RingQueue(10);
    q.push({ kind: 'log', time: 1, payload: 'x' });
    const exporter = {
      export: vi.fn(() => {
        throw new Error('boom');
      }),
    };
    const s = new Scheduler(q, exporter, 1000);
    await expect(s.flush()).resolves.toBeUndefined();
  });

  it('re-queues events when exporter rejects (transient network failure)', async () => {
    const q = new RingQueue(10);
    q.push({ kind: 'log', time: 1, payload: 'a' });
    q.push({ kind: 'log', time: 2, payload: 'b' });
    const exporter = {
      export: vi.fn(() => Promise.reject(new Error('network'))),
    };
    const s = new Scheduler(q, exporter, 1000);
    await s.flush();
    expect(q.size()).toBe(2);
    const drained = q.drain();
    expect(drained.map((e) => e.payload)).toEqual(['a', 'b']);
  });
});
