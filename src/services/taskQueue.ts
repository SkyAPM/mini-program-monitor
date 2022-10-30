import { report } from '@/services/report';
import { options } from '@/shared/options';

export default class TaskQueue {
  private timer: NodeJS.Timeout;
  private queues: any[] = [];
  private staged: any[] = [];
  private timeInterval = 60 * 1000;
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  addTask(data) {
    this.queues.push(data);
    this.fireTasks();
  }
  clearQueues() {
    this.queues.splice(0, this.queues.length);
  }
  clearStaged() {
    this.staged.splice(0, this.staged.length);
  }

  fireTasks() {
    if (this.timer) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.queues || !this.queues.length) {
        return;
      }
      this.staged.push(...this.queues);
      this.clearQueues();
      const reportUrl = options.collector + this.url;
      report(reportUrl, this.staged, () => this.clearStaged());
    }, options.traceTimeInterval || this.timeInterval);
  }
}
