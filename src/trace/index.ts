import { ReportUrl } from '@/shared/constants';
import { TaskQueue } from '@/services/taskQueue';
import { CustomOptionsType } from '@/types';

class TraceTask extends TaskQueue {
  init(options: CustomOptionsType) {
    const { collector, traceLimit, traceTimeInterval } = options;
    this.reportLimit = traceLimit || this.reportLimit;
    this.timeInterval = traceTimeInterval || this.timeInterval;
    this.reportUrl = collector + ReportUrl.SEGMENTS;
  }
}

export const traceTask = new TraceTask();
