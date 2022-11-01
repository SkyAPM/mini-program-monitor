import { options } from '@/shared/options';
import { uuid } from '@/shared/utils';
import { ErrorsCategory, GradeTypeEnum } from '@/shared/constants';
import { errorTask } from '@/errorLog';

const AppEventsHandlers = {
  onError(msg: string) {
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
      message: msg,
      // line: 0,
      // col: 0,
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
  onPageNotFound(res) {
    const { path, query, isEntryPage } = res;
    const { collector, service, serviceVersion, pagePath } = options;
    const logInfo = {
      uniqueId: uuid(),
      collector,
      service,
      serviceVersion,
      pagePath,
      category: ErrorsCategory.RESOURCE_ERROR,
      grade: GradeTypeEnum.ERROR,
      errorUrl: path, // 不存在页面的路径 (代码包路径)
      errorQuery: query, // 打开不存在页面的 query 参数
      isEntryPage: isEntryPage, // 是否本次启动的首个页面
    };
    errorTask.addTask(logInfo);
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
