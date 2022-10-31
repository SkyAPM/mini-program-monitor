import { interceptApp } from './interceptApp';
import { interceptPage } from './interceptPage';
import { interceptNetwork } from './interceptNetwork';

export function intercept(): void {
  interceptApp();
  interceptPage();
  interceptNetwork();
}
