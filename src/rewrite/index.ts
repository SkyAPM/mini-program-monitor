import { rewriteApp } from './rewriteApp';
import { rewritePage } from './rewritePage';
import { rewriteNetwork } from './rewriteNetwork';

export function rewriteFunc(): void {
  rewriteApp();
  rewritePage();
  rewriteNetwork();
}
