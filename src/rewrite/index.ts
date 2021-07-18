import { rewriteApp } from './rewriteApp';
import { rewriteNetwork } from './rewriteNetwork';

export function rewriteFunc(): void {
  rewriteApp();
  rewriteNetwork();
}
