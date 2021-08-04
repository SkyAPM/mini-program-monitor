interface UrlFields {
  scheme: string;
  slash: string;
  host: string;
  port: string;
  path: string;
  origin: string;
}

export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// https://harttle.land/2016/02/23/javascript-regular-expressions.html
export function parseUrl(url: string): UrlFields {
  const reg = /^(?:([A-Za-z]+):)?(\/{0,3})([0-9.\-A-Za-z]+)(?::(\d+))?(?:\/([^?#]*))?(?:\?([^#]*))?(?:#(.*))?$/;
  const [, scheme, slash, host, port, path] = reg.exec(url);
  const origin = `${scheme}:${slash}${host}`;
  return { scheme, slash, host, port, path, origin };
}

export function now(): number {
  return Date.now();
}
