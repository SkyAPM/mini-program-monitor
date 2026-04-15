const { init } = require('mini-program-monitor');

App({
  onLaunch() {
    init({
      service: 'mini-program-example',
      serviceInstance: 'devtools-1',
      collector: 'http://127.0.0.1:12800',
      debug: true,
    });
  },
});
