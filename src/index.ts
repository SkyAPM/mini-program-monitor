import { store } from '@/store';
import { rewriteFunc } from '@/rewriteFunc';
import { CustomOptions } from './store/types';

function createMonitor(options: CustomOptions): void {
  store.setOptions(options);
  rewriteFunc();
}

export { createMonitor };
