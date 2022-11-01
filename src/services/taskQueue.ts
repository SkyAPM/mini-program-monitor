import { report } from '@/services/report';
import { options } from '@/shared/options';

export default class TaskQueue {
  private timer: NodeJS.Timeout;
  private queues: any[] = [];
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

  private deleteTask(count: number): void {
    this.queues.splice(0, count);
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
    if (!this.queues.length) {
      return;
    }
    const reportUrl = options.collector + this.url;
    const count = this.queues.length;
    report(reportUrl, this.queues, () => this.deleteTask(count));
  }
}
