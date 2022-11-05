import { ReportUrl } from '@/shared/constants';
import { TaskQueue } from '@/services/taskQueue';
import { CustomOptionsType, ErrorInfoFields } from '@/types';

class LogTask extends TaskQueue {
  init(options: CustomOptionsType) {
    const { collector, errorLogLimit, errorLogTimeInterval } = options;
    this.reportLimit = errorLogLimit || this.reportLimit;
    this.timeInterval = errorLogTimeInterval || this.timeInterval;
    this.reportUrl = collector + ReportUrl.ERRORS;
  }
}

export const logTask = new LogTask();

export function reportLog(data: ErrorInfoFields): void {
  logTask.addTask(data);
}
