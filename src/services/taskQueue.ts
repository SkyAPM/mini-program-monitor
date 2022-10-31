import { report } from '@/services/report';
import { options } from '@/shared/options';

export default class TaskQueue {
  private timer: NodeJS.Timeout;
  private queues: any[] = [];
  private staged: any[] = [];
  private timeInterval = 60 * 1000;
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
    this.fireTasks();
  }

  addTask(data: any): void {
    this.queues.push(data);
    this.fireTasks();
  }

  private clearQueues(): void {
    this.queues.splice(0, this.queues.length);
  }

  private clearStaged(): void {
    this.staged.splice(0, this.staged.length);
  }

  clearTimer(): void {
    clearTimeout(this.timer);
    this.timer = null;
  }

  private fireTasks(): void {
    if (this.timer) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.reportTasks();
    }, options.traceTimeInterval || this.timeInterval);
  }

  reportTasks(): void {
    if (!this.queues.length && !this.staged.length) {
      return;
    }
    this.staged.push(...this.queues);
    this.clearQueues();
    const reportUrl = options.collector + this.url;
    report(reportUrl, this.staged, () => this.clearStaged());
  }
}
