import { platformApi } from './fake-wx.mjs';
import { runSim } from '../core/loop.mjs';

await runSim('wechat', {
  platformApi,
  setupFakeSystemInfo: (info) => platformApi.setSystemInfo(info),
});
