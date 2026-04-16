import type { ErrorInfoFields, ReportFields } from './types';

export type BrowserErrorLog = ReportFields & ErrorInfoFields;

export interface BrowserPerfData {
  service: string;
  serviceVersion: string;
  pagePath: string;
  redirectTime?: number;
  dnsTime?: number;
  ttfbTime?: number;
  tcpTime?: number;
  transTime?: number;
  domAnalysisTime?: number;
  fptTime?: number;
  domReadyTime?: number;
  loadPageTime?: number;
  resTime?: number;
  sslTime?: number;
  ttlTime?: number;
  firstPackTime?: number;
  fmpTime?: number;
}
