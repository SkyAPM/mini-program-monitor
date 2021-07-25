import { ReportUrl } from '@/constant';

export function report<T>(url: ReportUrl, params: T, collector: string, callback?: () => void): void {
  wx.request({
    url: collector + url,
    method: 'POST',
    data: params,
    success: function (res: WechatMiniprogram.RequestSuccessCallbackResult) {
      if (res.statusCode === 204) {
        callback && callback();
      }
    },
  });
}
