import { options } from '@/shared/options';
import { uuid } from '@/shared/utils';
import { ErrorsCategory, GradeTypeEnum } from '@/shared/constants';
import { errorTask } from '@/errorLog';

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
      line: 0,
      col: 0,
      message: msg,
      collector: options.collector,
      // stack: error.stack,
    };
    errorTask.addTask(logInfo);
  },
  onHide() {
    //
  },
  onLaunch() {
    //
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
