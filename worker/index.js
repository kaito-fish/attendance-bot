import { CONFIG } from './config.js';
import { dispatchNotifications } from './notify.js';

export default {
  // wrangler dev --test-scheduled でscheduledをローカル発火させるために必要(本番では未使用)
  async fetch() {
    return new Response('Not Found', { status: 404 });
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(dispatchNotifications(CONFIG, env, new Date(event.scheduledTime)));
  },
};
