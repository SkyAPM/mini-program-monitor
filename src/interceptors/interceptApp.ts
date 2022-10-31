import { options } from '@/shared/options';
import { uuid } from '@/shared/utils';
import { ErrorsCategory, GradeTypeEnum } from '@/shared/constants';
import { errorTask } from '@/errorLog';

const AppEventsHandlers = {
  onError(msg) {
    const { collector, service, serviceVersion, pagePath } = options;
    const logInfo = {
      uniqueId: uuid(),
      collector,
      service,
      serviceVersion,
      pagePath,
      category: ErrorsCategory.JS_ERROR,
      grade: GradeTypeEnum.ERROR,
      errorUrl: '',
      // line: 0,
      // col: 0,
      message: msg,
      // stack: error.stack,
    };
    errorTask.addTask(logInfo);
  },
  onUnhandledRejection(data) {
    const { collector, service, serviceVersion, pagePath } = options;
    const { reason } = data;
    const logInfo = {
      uniqueId: uuid(),
      collector,
      service,
      serviceVersion,
      pagePath,
      category: ErrorsCategory.PROMISE_ERROR,
      grade: GradeTypeEnum.ERROR,
      errorUrl: '',
      message: '',
      stack: '',
    };
    if (typeof reason === 'object') {
      logInfo.errorUrl = reason.config?.url;
      logInfo.message = reason.message;
      logInfo.stack = reason.stack;
    } else {
      logInfo.message = reason;
    }
    errorTask.addTask(logInfo);
  },
  onPageNotFound() {
    //
  },
  onHide() {
    errorTask.reportTasks();
    errorTask.clearTimer();
  },
};

function interceptApp(): void {
  const originApp = App;
  App = function (appOptions: WechatMiniprogram.App.Option) {
    for (const handler in AppEventsHandlers) {
      const customMethod = appOptions[handler];
      appOptions[handler] = function (data) {
        try {
          AppEventsHandlers[handler].call(this, data);
        } catch (e) {
          console.log(e);
        }
        return customMethod && customMethod.call(this, data);
      };
    }
    return originApp(appOptions);
  } as WechatMiniprogram.App.Constructor;
}

export { interceptApp };
