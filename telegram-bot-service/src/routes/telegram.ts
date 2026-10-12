import { timingSafeEqual } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { isAllowedTelegramSender } from "../auth/allowlist.js";
import type { Database } from "../db/index.js";
import { TelegramClient, type TelegramMessage, type TelegramUpdate } from "../integrations/telegram.js";
import type { Env } from "../lib/env.js";
import { Orchestrator } from "../orchestrator/router.js";

interface TelegramRouteDeps {
  env: Env;
  db: Database;
  orchestrator: Orchestrator;
  telegramClient: TelegramClient;
}

export async function registerTelegramRoutes(server: FastifyInstance, deps: TelegramRouteDeps): Promise<void> {
  server.post("/webhooks/telegram", async (request: FastifyRequest<{ Body: TelegramUpdate }>, reply: FastifyReply) => {
    {
      const secret = request.headers["x-telegram-bot-api-secret-token"];
      const expected = deps.env.TELEGRAM_WEBHOOK_SECRET;
      if (typeof secret !== "string" || !expected || Buffer.byteLength(secret) !== Buffer.byteLength(expected)
          || !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))) {
        await deps.db.insertAuditLog({
          service: "telegram",
          action: "webhook_secret_check",
          status: "denied",
          detail: "Webhook secret mismatch"
        });

        return reply.code(403).send({ ok: false });
      }
    }

    const message = request.body.message ?? request.body.edited_message;
    if (!message?.text) {
      return reply.code(200).send({ ok: true, ignored: true });
    }

    await handleTelegramMessage(server, deps, message);
    return reply.code(200).send({ ok: true });
  });
}

async function handleTelegramMessage(server: FastifyInstance, deps: TelegramRouteDeps, message: TelegramMessage): Promise<void> {
  const messageText = message.text;
  if (!messageText) {
    return;
  }

  const chatId = String(message.chat.id);
  const userId = message.from ? String(message.from.id) : undefined;

  const allowed = await isAllowedTelegramSender({
    env: deps.env,
    db: deps.db,
    userId,
    chatId
  });

  if (!allowed) {
    server.log.warn({ chatId, userId }, "Blocked unauthorized Telegram sender");
    await deps.db.insertAuditLog({
      service: "telegram",
      action: "receive_message",
      status: "denied",
      chatId,
      userId,
      detail: "Unauthorized sender",
      metadata: { text: messageText }
    });
    return;
  }

  await deps.db.touchSession(chatId, userId);
  await deps.db.appendSessionMessage({
    chatId,
    userId,
    direction: "inbound",
    messageText,
    metadata: {
      telegramMessageId: message.message_id,
      chatType: message.chat.type
    }
  });

  try {
    const result = await deps.orchestrator.handleMessage(messageText);
    await deps.telegramClient.sendMessage(chatId, result.responseText, message.message_id);

    await deps.db.touchSession(chatId, userId, result.intent);
    await deps.db.appendSessionMessage({
      chatId,
      userId,
      direction: "outbound",
      intent: result.intent,
      messageText: result.responseText,
      metadata: result.metadata
    });
    await deps.db.insertAuditLog({
      service: "telegram",
      action: "receive_message",
      status: "ok",
      chatId,
      userId,
      detail: `Handled ${result.intent} request`,
      metadata: result.metadata
    });
  } catch (error) {
    const detail = "Orchestrator request failed";

    server.log.error({ err: error, chatId, userId }, "Telegram message handling failed");
    await deps.db.insertAuditLog({
      service: "telegram",
      action: "receive_message",
      status: "error",
      chatId,
      userId,
      detail,
      metadata: { text: messageText }
    });
    await deps.telegramClient.sendMessage(
      chatId,
      "I could not process that request. Please try again later.",
      message.message_id
    );
  }
}
