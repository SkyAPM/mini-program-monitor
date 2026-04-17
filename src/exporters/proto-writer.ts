// Minimal protobuf wire-format writer for the OTLP subset we emit.
// Only implements what the encoder in otlp-proto.ts needs. Zero deps.

export const WT_VARINT = 0;
export const WT_I64 = 1;
export const WT_LEN = 2;
export const WT_I32 = 5;

export class ProtoWriter {
  readonly buf: number[] = [];

  tag(field: number, wireType: number): void {
    this.varint((field << 3) | wireType);
  }

  varint(n: number): void {
    while (n >= 0x80) {
      this.buf.push((n & 0x7f) | 0x80);
      n = Math.floor(n / 128);
    }
    this.buf.push(n & 0x7f);
  }

  // Write a 64-bit fixed little-endian value from a decimal string
  // (varied-length timestamps and counts need full 64-bit precision).
  fixed64FromString(s: string): void {
    const parts = splitDecimalTo32x2(s);
    // little-endian: low 4 bytes first, then high 4 bytes
    this.buf.push(
      parts.low & 0xff,
      (parts.low >>> 8) & 0xff,
      (parts.low >>> 16) & 0xff,
      (parts.low >>> 24) & 0xff,
      parts.high & 0xff,
      (parts.high >>> 8) & 0xff,
      (parts.high >>> 16) & 0xff,
      (parts.high >>> 24) & 0xff,
    );
  }

  double(n: number): void {
    const b = new ArrayBuffer(8);
    new DataView(b).setFloat64(0, n, true);
    const u8 = new Uint8Array(b);
    for (let i = 0; i < 8; i++) this.buf.push(u8[i]);
  }

  bytes(b: number[]): void {
    this.varint(b.length);
    for (let i = 0; i < b.length; i++) this.buf.push(b[i]);
  }

  string(s: string): void {
    const u8 = utf8Encode(s);
    this.bytes(u8);
  }

  submessage(build: (w: ProtoWriter) => void): void {
    const w = new ProtoWriter();
    build(w);
    this.bytes(w.buf);
  }

  finish(): Uint8Array {
    return new Uint8Array(this.buf);
  }
}

// Field-level helpers — all respect proto3 defaults (don't emit zero/empty).

export function writeString(w: ProtoWriter, field: number, value: string | undefined): void {
  if (!value) return;
  w.tag(field, WT_LEN);
  w.string(value);
}

export function writeInt32(w: ProtoWriter, field: number, value: number | undefined): void {
  if (!value) return;
  w.tag(field, WT_VARINT);
  w.varint(value);
}

export function writeFixed64String(w: ProtoWriter, field: number, value: string | undefined): void {
  if (!value) return;
  w.tag(field, WT_I64);
  w.fixed64FromString(value);
}

export function writeDouble(w: ProtoWriter, field: number, value: number | undefined): void {
  if (value === undefined || value === 0) return;
  w.tag(field, WT_I64);
  w.double(value);
}

export function writeSubmessage(
  w: ProtoWriter,
  field: number,
  build: (sub: ProtoWriter) => void,
): void {
  w.tag(field, WT_LEN);
  w.submessage(build);
}

export function writePackedFixed64Strings(
  w: ProtoWriter,
  field: number,
  values: string[] | undefined,
): void {
  if (!values || values.length === 0) return;
  w.tag(field, WT_LEN);
  w.varint(values.length * 8);
  for (const v of values) w.fixed64FromString(v);
}

export function writePackedDoubles(
  w: ProtoWriter,
  field: number,
  values: number[] | undefined,
): void {
  if (!values || values.length === 0) return;
  w.tag(field, WT_LEN);
  w.varint(values.length * 8);
  for (const v of values) w.double(v);
}

function utf8Encode(str: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const c2 = str.charCodeAt(++i);
      const u = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff));
      out.push(
        0xf0 | (u >> 18),
        0x80 | ((u >> 12) & 0x3f),
        0x80 | ((u >> 6) & 0x3f),
        0x80 | (u & 0x3f),
      );
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return out;
}

// Splits a non-negative decimal string into high/low 32-bit unsigned halves
// via long division. Avoids BigInt so we stay compatible with older JSCore.
function splitDecimalTo32x2(s: string): { high: number; low: number } {
  let high = 0;
  let low = 0;
  for (let i = 0; i < s.length; i++) {
    const d = s.charCodeAt(i) - 48;
    // Multiply current (high, low) by 10 then add digit.
    const lowMul = low * 10 + d;
    const carry = Math.floor(lowMul / 0x100000000);
    low = lowMul >>> 0;
    high = (high * 10 + carry) >>> 0;
  }
  return { high, low };
}
