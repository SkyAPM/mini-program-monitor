import { CustomOptions, ErrorInfoFields, ReportFields } from './types';
import { report } from '@/report';
import { ReportUrl } from '@/constant';

class Store {
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
  private queues: ((ErrorInfoFields & ReportFields) | undefined)[] = [];

  public setOptions(options: CustomOptions) {
    this.options = Object.assign(this.options, options);
  }
  public addLogTask(data) {
    this.queues.push(data);
    this.fireTasks();
  }
  public fireTasks() {
    if (!(this.queues && this.queues.length)) return;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      report(ReportUrl.ERRORS, this.queues, this.options.collector);
      this.queues = [];
    }, 4 * 1000);
  }
  reportAll() {
    // console.log('reportAll---');
  }
}

const store = new Store();
export { store };
