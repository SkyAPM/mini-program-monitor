import { report } from '@/services/report';
import { ErrorInfoFields, SegmentFields } from '@/types';

const MAX_COUNT = 5;
class TaskQueue {
  private timer: NodeJS.Timeout;
  private count = 0;
  private queues: Array<ErrorInfoFields | SegmentFields> = [];
  public timeInterval = 60 * 1000;
  public reportLimit = 20;
  public reportUrl: string;

  addTask(data: ErrorInfoFields | SegmentFields): void {
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
    if (this.queues.length >= this.reportLimit && this.count < MAX_COUNT) {
      this.fireTasksImmediately();
      return;
    }
    if (this.timer) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.reportTasks();
    }, this.timeInterval);
  }

  fireTasksImmediately(): void {
    this.count++;
    this.clearTimer();
    this.reportTasks();
  }

  reportTasks(): void {
    if (!this.queues.length) {
      return;
    }
    const count = this.queues.length;
    report(this.reportUrl, this.queues, () => {
      this.deleteTask(count);
    });
  }
}

export { TaskQueue };
