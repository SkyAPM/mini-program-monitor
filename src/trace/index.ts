import { ReportUrl } from '@/shared/constants';
import TaskQueue from '@/services/taskQueue';

export const traceTask = new TaskQueue(ReportUrl.SEGMENTS);
