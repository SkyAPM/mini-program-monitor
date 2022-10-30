export function report(url: string, data: string | Record<string, any> | ArrayBuffer, callback?: () => void): void {
  wx.request({
    url,
    data,
    method: 'POST',
    success(res: WechatMiniprogram.RequestSuccessCallbackResult) {
      if (res.statusCode === 204) {
        callback && callback();
      }
    },
  });
}
