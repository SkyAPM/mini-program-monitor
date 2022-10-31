import { options } from '@/shared/options';
import { intercept } from '@/interceptors';
import { CustomOptionsType } from '@/types';

function createMonitor(opt: CustomOptionsType): void {
  options.setOptions(opt);
  intercept();
}

export { createMonitor };
