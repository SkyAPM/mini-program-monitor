function rewritePage(): void {
  const originPage = Page;
  Page = function (
    pageOptions:
      | WechatMiniprogram.Page.Options<WechatMiniprogram.Page.DataOption, WechatMiniprogram.Page.CustomOption>
      | WechatMiniprogram.Component.MethodOption,
  ) {
    //todo

    return originPage(pageOptions);
  } as WechatMiniprogram.Page.Constructor;
}
export { rewritePage };
