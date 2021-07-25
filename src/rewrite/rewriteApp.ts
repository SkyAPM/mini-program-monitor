import { store } from '@/store';
import { uuid } from '@/utils';
import { ErrorsCategory, GradeTypeEnum } from '@/constant';

const { options } = store;
const methods = {
  onError(msg) {
    const logInfo = {
      uniqueId: uuid(),
      service: options.service,
      serviceVersion: options.serviceVersion,
      pagePath: options.pagePath,
      category: ErrorsCategory.JS_ERROR,
      grade: GradeTypeEnum.ERROR,
      errorUrl: '',
      // line: 1,
      // col: 1,
      message: msg,
      collector: options.collector,
      // stack: error.stack,
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
    return originApp(appOptions);
  } as WechatMiniprogram.App.Constructor;
}
export { rewriteApp };
