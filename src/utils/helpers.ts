interface UrlFields {
  scheme: string | unknown;
  slash: string | unknown;
  host: string | unknown;
  port: string | unknown;
  path: string | unknown;
}

export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function parseUrl(url: string): UrlFields {
  const reg = /^(?:([A-Za-z]+):)?(\/{0,3})([0-9.\-A-Za-z]+)(?::(\d+))?(?:\/([^?#]*))?(?:\?([^#]*))?(?:#(.*))?$/;
  const [, scheme, slash, host, port, path] = reg.exec(url);
  return { scheme, slash, host, port, path };
}

export function now(): number {
  return Date.now();
}
