import { CONFIG } from './config.js';
import { dispatchNotifications } from './notify.js';

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(dispatchNotifications(CONFIG, env));
  },
};
