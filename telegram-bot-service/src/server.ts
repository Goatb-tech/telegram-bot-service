import Fastify from "fastify";

import { parseAllowlist } from "./auth/allowlist.js";
import { Database } from "./db/index.js";
import { TelegramClient } from "./integrations/telegram.js";
import { loadEnv } from "./lib/env.js";
import { buildLoggerOptions } from "./lib/logger.js";
import { Orchestrator } from "./orchestrator/router.js";
import { registerTelegramRoutes } from "./routes/telegram.js";

const env = loadEnv();
const app = Fastify({ logger: buildLoggerOptions(env) });
const db = new Database(env.DATABASE_URL);
const telegramClient = new TelegramClient(env);
const orchestrator = new Orchestrator(env, db);

await db.initialize();
await db.seedAllowlist(parseAllowlist(env.TELEGRAM_ALLOWED_USER_IDS), parseAllowlist(env.TELEGRAM_ALLOWED_CHAT_IDS));

app.get("/healthz", async () => {
  const databaseHealthy = env.HEALTHCHECK_DATABASE ? await db.ping() : db.enabled;

  return {
    ok: true,
    service: "telegram-bot-service",
    database: db.enabled ? (databaseHealthy ? "ok" : "error") : "disabled"
  };
});

await registerTelegramRoutes(app, {
  env,
  db,
  orchestrator,
  telegramClient
});

const closeSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
for (const signal of closeSignals) {
  process.on(signal, async () => {
    app.log.info({ signal }, "Shutting down");
    await app.close();
    await db.close();
    process.exit(0);
  });
}

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  app.log.info({ port: env.PORT }, "Server started");
} catch (error) {
  app.log.error({ err: error }, "Server failed to start");
  await db.close();
  process.exit(1);
}
