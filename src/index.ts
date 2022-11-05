import { CustomOptionsType } from '@/types';
import { options } from '@/shared/options';
import { initInterceptor } from '@/interceptors';
import { logTask, reportLog } from '@/log';
import { traceTask } from '@/trace';

function init(params: CustomOptionsType): void {
  options.init(params);
  logTask.init(params);
  traceTask.init(params);
  initInterceptor();
}

export { init, reportLog };
