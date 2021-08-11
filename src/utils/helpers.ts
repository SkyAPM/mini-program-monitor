interface UrlFields {
  scheme: string;
  slash: string;
  host: string;
  port: string;
  path: string;
  origin: string;
}

// https://harttle.land/2016/02/23/javascript-regular-expressions.html
export function parseUrl(url: string): UrlFields {
  const reg = /^(?:([A-Za-z]+):)?(\/{0,3})([0-9.\-A-Za-z]+)(?::(\d+))?(?:\/([^?#]*))?(?:\?([^#]*))?(?:#(.*))?$/;
  const [, scheme, slash, host, port, path] = reg.exec(url);
  const origin = `${scheme}:${slash}${host}`;
  return { scheme, slash, host, port, path, origin };
}

function getCurrentRoute() {
  const currPages = getCurrentPages();
  return currPages.length ? currPages[currPages.length - 1]['route'] : '';
}
