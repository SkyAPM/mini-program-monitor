import { store } from '@/store';

function rewriteApp(): void {
  const originApp = App;
  App = function (appOptions: WechatMiniprogram.App.Option) {
    ['onLaunch', 'onError'].forEach((methodName) => {
      const customMethod = appOptions[methodName];
      if (methodName === 'onLaunch') {
        // todo
        // get system info
      }

      appOptions[methodName] = function (data) {
        if (methodName === 'onError') {
          const logInfo = {
            category: 'error',
            data,
          };
          store.addTask(logInfo);
        }
        return customMethod && customMethod.call(this, data);
      };
    });
    return originApp(appOptions);
  } as WechatMiniprogram.App.Constructor;
}
export { rewriteApp };
