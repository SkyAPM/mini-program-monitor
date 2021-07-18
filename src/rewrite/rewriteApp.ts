import { store } from '@/store';

const methods = {
  onError(data) {
    const logInfo = {
      category: 'error',
      data,
    };
    store.addLogTask(logInfo);
  },
  onHide() {
    store.reportAll();
  },
  onLaunch() {
    // console.log(11, this.globalData);
  },
};
function rewriteApp(): void {
  const originApp = App;
  App = function (appOptions: WechatMiniprogram.App.Option) {
    for (const methodName in methods) {
      const customMethod = appOptions[methodName];
      appOptions[methodName] = function (data) {
        methods[methodName].call(this, data);
        return customMethod && customMethod.call(this, data);
      };
    }

    // ['onLaunch', 'onError', 'onHide'].forEach((methodName) => {
    //   const customMethod = appOptions[methodName];
    //
    //   appOptions[methodName] = function (data) {
    //     switch (methodName) {
    //       case 'onLaunch':
    //         break;
    //       case 'onError': {
    //         break;
    //       }
    //       case 'onHide':
    //         break;
    //     }
    //
    //     return customMethod && customMethod.call(this, data);
    //   };
    // });
    return originApp(appOptions);
  } as WechatMiniprogram.App.Constructor;
}
export { rewriteApp };
