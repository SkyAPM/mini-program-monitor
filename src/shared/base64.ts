const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64Encode(input: string): string {
  let result = '';
  let i = 0;
  while (i < input.length) {
    const a = input.charCodeAt(i++);
    const b = i < input.length ? input.charCodeAt(i++) : 0;
    const c = i < input.length ? input.charCodeAt(i++) : 0;
    const triple = (a << 16) | (b << 8) | c;
    result += CHARS[(triple >> 18) & 63];
    result += CHARS[(triple >> 12) & 63];
    result += i - 2 < input.length ? CHARS[(triple >> 6) & 63] : '=';
    result += i - 1 < input.length ? CHARS[triple & 63] : '=';
  }
  return result;
}
