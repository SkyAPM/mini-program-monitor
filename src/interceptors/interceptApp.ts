import { options } from '@/shared/options';
import { uuid } from '@/shared/utils';
import { ErrorsCategory, GradeTypeEnum } from '@/shared/constants';
import { logTask } from '@/log';
import { ErrorInfoFields } from '@/types';

const AppEventsHandlers = {
  onError(msg: string) {
    const { service, serviceVersion, pagePath } = options;
    const logInfo: ErrorInfoFields = {
      uniqueId: uuid(),
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
    logTask.addTask(logInfo);
  },
  onUnhandledRejection(data) {
    const { service, serviceVersion, pagePath } = options;
    const { reason } = data;
    const logInfo: ErrorInfoFields = {
      uniqueId: uuid(),
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
    logTask.addTask(logInfo);
  },
  onPageNotFound(res: WechatMiniprogram.App.PageNotFoundOption) {
    const { path, query, isEntryPage } = res;
    const { service, serviceVersion, pagePath } = options;
    const logInfo: ErrorInfoFields = {
      uniqueId: uuid(),
      service,
      serviceVersion,
      pagePath,
      message: '',
      category: ErrorsCategory.RESOURCE_ERROR,
      grade: GradeTypeEnum.ERROR,
      errorUrl: path, // 不存在页面的路径 (代码包路径)
      errorQuery: query, // 打开不存在页面的 query 参数
      isEntryPage: isEntryPage, // 是否本次启动的首个页面
    };
    logTask.addTask(logInfo);
  },
  onHide() {
    logTask.fireTasksImmediately();
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
