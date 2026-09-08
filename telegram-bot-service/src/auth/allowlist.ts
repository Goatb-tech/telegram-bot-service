import type { Database } from "../db/index.js";
import type { Env } from "../lib/env.js";

export interface AllowlistCheckInput {
  env: Env;
  db: Database;
  userId?: string;
  chatId?: string;
}

export function parseAllowlist(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function isAllowedTelegramSender(input: AllowlistCheckInput): Promise<boolean> {
  const allowedUserIds = parseAllowlist(input.env.TELEGRAM_ALLOWED_USER_IDS);
  const allowedChatIds = parseAllowlist(input.env.TELEGRAM_ALLOWED_CHAT_IDS);

  if (input.userId && allowedUserIds.includes(input.userId)) {
    return true;
  }

  if (input.chatId && allowedChatIds.includes(input.chatId)) {
    return true;
  }

  if (!input.db.enabled) {
    return false;
  }

  if (input.userId && (await input.db.isAllowedIdentity("user", input.userId))) {
    return true;
  }

  if (input.chatId && (await input.db.isAllowedIdentity("chat", input.chatId))) {
    return true;
  }

  return false;
}
