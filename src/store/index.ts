import { SegmentFields } from '@/types/trace';
import { CustomOptions, ErrorInfoFields, ReportFields } from './types';
import { report } from '@/report';
import { ReportUrl, ExcludeErrorTypes } from '@/constant';

class Store {
  private jsErrorPv = false;
  private timer: any = null;
  public options: CustomOptions = {
    collector: '', // report serve
    jsErrors: true, // vue, js and promise errors
    apiErrors: true,
    resourceErrors: true,
    traceSDKInternal: false,
    detailMode: true,
    noTraceOrigins: [],
    service: '',
    pagePath: '',
    serviceVersion: '',
  };
  private segments: SegmentFields[] = [];
  private queues: ((ErrorInfoFields & ReportFields) | undefined)[] = [];
  private staged: ((ErrorInfoFields & ReportFields) | undefined)[] = [];

  public setOptions(options: any) {
    this.options = Object.assign(this.options, options);
  }
  public addLogTask(logInfo: ErrorInfoFields & ReportFields) {
    const newLogInfo = this.handleLogInfo(logInfo);
    this.queues.push(newLogInfo);
    this.fireTasks();
  }
  public addSegment(segment: SegmentFields) {
    this.segments.push(segment);
  }
  private handleLogInfo(logInfo: ErrorInfoFields & ReportFields) {
    if (!this.jsErrorPv && !ExcludeErrorTypes.includes(logInfo.category)) {
      this.jsErrorPv = true;
      return {
        ...logInfo,
        firstReportedError: true,
      };
    }
    return logInfo;
  }
  public fireTasks() {
    if (!(this.queues && this.queues.length)) return;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.staged.push(...this.queues);
      this.queues = [];
      report(ReportUrl.ERRORS, this.staged, this.options.collector, () => (this.staged = []));
    }, 4 * 1000);
  }
  reportAll() {
    // console.log('reportAll---');
  }
}

const store = new Store();
export { store };
