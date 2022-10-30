import { ReportUrl, ExcludeErrorTypes } from '@/shared/constants';
import TaskQueue from '@/services/taskQueue';

export const errorTask = new TaskQueue(ReportUrl.ERRORS);
