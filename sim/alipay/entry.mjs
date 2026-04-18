import { platformApi } from './fake-my.mjs';
import { runSim } from '../core/loop.mjs';

await runSim('alipay', {
  platformApi,
  setupFakeSystemInfo: (info) => platformApi.setSystemInfo(info),
});
