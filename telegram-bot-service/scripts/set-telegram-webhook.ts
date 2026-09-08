import { loadEnv } from "../src/lib/env.js";
import { TelegramClient } from "../src/integrations/telegram.js";

const webhookUrl = process.argv[2];

if (!webhookUrl) {
  throw new Error("Usage: npm run set:telegram-webhook -- https://your-domain.com/webhooks/telegram");
}

const env = loadEnv();
const telegramClient = new TelegramClient(env);

await telegramClient.setWebhook(webhookUrl);
console.log(`Telegram webhook registered: ${webhookUrl}`);
