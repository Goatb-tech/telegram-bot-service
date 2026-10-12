import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerTelegramRoutes } from './src/routes/telegram.ts';
import { loadEnv } from './src/lib/env.ts';

const secret = 'sample-webhook-secret-0123456789-ABCDEF';
process.env.TELEGRAM_BOT_TOKEN = 'test-only-placeholder';
delete process.env.TELEGRAM_WEBHOOK_SECRET;
assert.throws(() => loadEnv());
process.env.TELEGRAM_WEBHOOK_SECRET = secret;
assert.equal(loadEnv().TELEGRAM_WEBHOOK_SECRET, secret);
const app = Fastify();
let calls = 0;
const db = {enabled:false, insertAuditLog:async()=>{}, touchSession:async()=>{}, appendSessionMessage:async()=>{}};
await registerTelegramRoutes(app, {
  env: {TELEGRAM_WEBHOOK_SECRET:secret, TELEGRAM_ALLOWED_USER_IDS:'123', TELEGRAM_ALLOWED_CHAT_IDS:''}, db,
  orchestrator:{handleMessage:async()=>{calls++;return {responseText:'safe test response',intent:'calendar',metadata:{}};}},
  telegramClient:{sendMessage:async()=>{}}
});
const payload = {message:{message_id:1, from:{id:123}, chat:{id:456,type:'private'},text:'calendar'}};
for (const header of [undefined, 'forged-header', 'a'.repeat(secret.length)]) {
  const response = await app.inject({method:'POST',url:'/webhooks/telegram',payload,headers:header ? {'x-telegram-bot-api-secret-token':header} : {}});
  assert.equal(response.statusCode,403);
}
assert.equal(calls,0);
const allowed = await app.inject({method:'POST',url:'/webhooks/telegram',payload,headers:{'x-telegram-bot-api-secret-token':secret}});
assert.equal(allowed.statusCode,200);
assert.equal(calls,1);
await app.close();
console.log('Telegram: required configuration, missing/forged secrets rejected, verified requests accepted.');
