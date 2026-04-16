const { init } = require('mini-program-monitor');

App({
  onLaunch() {
    init({
      service: 'mini-program-example',
      serviceVersion: 'v0.1.0',
      collector: 'http://127.0.0.1:4318',
      traceCollector: 'http://127.0.0.1:12801',
      enable: {
        error: true,
        perf: true,
        request: true,
        tracing: true,
      },
      debug: true,
    });
  },
});
