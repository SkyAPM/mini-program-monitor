import { describe, it, expect } from 'vitest';
import { ProtoWriter } from '../../src/exporters/proto-writer';

describe('ProtoWriter', () => {
  it('encodes small varints correctly', () => {
    const w = new ProtoWriter();
    w.varint(0);
    w.varint(127);
    w.varint(128);
    w.varint(300);
    expect(Array.from(w.finish())).toEqual([0x00, 0x7f, 0x80, 0x01, 0xac, 0x02]);
  });

  it('encodes tag as (field << 3) | wireType', () => {
    const w = new ProtoWriter();
    w.tag(1, 2);   // (1<<3) | 2 = 10 = 0x0a
    w.tag(9, 0);   // (9<<3) | 0 = 72 = 0x48
    expect(Array.from(w.finish())).toEqual([0x0a, 0x48]);
  });

  it('encodes fixed64 from decimal string in little-endian', () => {
    const w = new ProtoWriter();
    w.fixed64FromString('1');
    expect(Array.from(w.finish())).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('encodes large fixed64 from decimal string', () => {
    const w = new ProtoWriter();
    w.fixed64FromString('1700000000000000000');
    // 1.7e18 = 0x17979CFE362A0000 → LE bytes
    expect(Array.from(w.finish())).toEqual([0x00, 0x00, 0x2a, 0x36, 0xfe, 0x9c, 0x97, 0x17]);
  });

  it('encodes strings as UTF-8 with length prefix', () => {
    const w = new ProtoWriter();
    w.string('hi');
    expect(Array.from(w.finish())).toEqual([2, 0x68, 0x69]);
  });

  it('encodes submessage with length prefix', () => {
    const w = new ProtoWriter();
    w.submessage((sub) => { sub.varint(42); });
    // one byte for varint(42), prefixed by length 1
    expect(Array.from(w.finish())).toEqual([1, 42]);
  });

  it('encodes multi-byte UTF-8', () => {
    const w = new ProtoWriter();
    w.string('中');
    // U+4E2D → E4 B8 AD, length 3
    expect(Array.from(w.finish())).toEqual([3, 0xe4, 0xb8, 0xad]);
  });
});
