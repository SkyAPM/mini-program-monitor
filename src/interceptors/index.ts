import { interceptApp } from './interceptApp';
import { interceptPage } from './interceptPage';
import { interceptNetwork } from './interceptNetwork';

export function initInterceptor(): void {
  interceptApp();
  interceptPage();
  interceptNetwork();
}
