import { store } from '@/store';

const methods = {
  onLoad() {
    store.setOptions({ pagePath: this.route });
  },
  onShow() {
    store.setOptions({ pagePath: this.route });
  },
};

function rewritePage(): void {
  const originPage = Page;
  Page = function (
    pageOptions:
      | WechatMiniprogram.Page.Options<WechatMiniprogram.Page.DataOption, WechatMiniprogram.Page.CustomOption>
      | WechatMiniprogram.Component.MethodOption,
  ) {
    for (const methodName in methods) {
      const customMethod = pageOptions[methodName];
      pageOptions[methodName] = function (data) {
        methods[methodName].call(this, data);
        return customMethod && customMethod.call(this, data);
      };
    }
    return originPage(pageOptions);
  } as WechatMiniprogram.Page.Constructor;
}

export { rewritePage };
