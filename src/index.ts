import { options } from '@/shared/options';
import { rewriteApp, rewritePage, rewriteNetwork } from '@/rewrite';
import { CustomOptionsType } from '@/types';

function createMonitor(opt: CustomOptionsType): void {
  options.setOptions(opt);
  rewriteApp();
  rewritePage();
  rewriteNetwork();
}

export { createMonitor };
