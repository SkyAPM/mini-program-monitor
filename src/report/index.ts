import { ReportUrl } from '@/constant';

export function report<T>(url: ReportUrl, params: T, collector: string): void {
  wx.request({
    url: collector + url,
    method: 'POST',
    data: params,
  });
}
