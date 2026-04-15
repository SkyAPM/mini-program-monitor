import { describe, it, expect } from 'vitest';
import { RingQueue } from '../src/core/queue';

describe('RingQueue', () => {
  it('drops oldest when over capacity', () => {
    const q = new RingQueue(3);
    q.push({ kind: 'log', time: 1, payload: 'a' });
    q.push({ kind: 'log', time: 2, payload: 'b' });
    q.push({ kind: 'log', time: 3, payload: 'c' });
    q.push({ kind: 'log', time: 4, payload: 'd' });
    const out = q.drain();
    expect(out.map((e) => e.payload)).toEqual(['b', 'c', 'd']);
  });

  it('drain empties the buffer', () => {
    const q = new RingQueue(10);
    q.push({ kind: 'log', time: 1, payload: 'x' });
    expect(q.size()).toBe(1);
    q.drain();
    expect(q.size()).toBe(0);
  });
});
