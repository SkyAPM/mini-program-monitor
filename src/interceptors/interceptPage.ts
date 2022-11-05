import { options } from '@/shared/options';

const PageEventsHandlers = {
  onShow() {
    options.setPagePath(this.route);
  },
};

function interceptPage(): void {
  const originPage = Page;
  Page = function (
    pageOptions:
      | WechatMiniprogram.Page.Options<WechatMiniprogram.Page.DataOption, WechatMiniprogram.Page.CustomOption>
      | WechatMiniprogram.Component.MethodOption,
  ) {
    for (const methodName in PageEventsHandlers) {
      const customMethod = pageOptions[methodName];
      pageOptions[methodName] = function (data) {
        PageEventsHandlers[methodName].call(this, data);
        return customMethod && customMethod.call(this, data);
      };
    }
    return originPage(pageOptions);
  } as WechatMiniprogram.Page.Constructor;
}

export { interceptPage };
