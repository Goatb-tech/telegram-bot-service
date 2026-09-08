import type { Env } from "../lib/env.js";

export interface TelegramChat {
  id: number;
  type: string;
}

export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  date: number;
  text?: string;
  chat: TelegramChat;
  from?: TelegramUser;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

export class TelegramClient {
  private readonly baseUrl: string;

  public constructor(private readonly env: Env) {
    this.baseUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
  }

  public async sendMessage(chatId: string, text: string, replyToMessageId?: number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sendMessage`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_to_message_id: replyToMessageId,
        allow_sending_without_reply: true
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram sendMessage failed: ${response.status} ${body}`);
    }
  }

  public async setWebhook(webhookUrl: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/setWebhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: this.env.TELEGRAM_WEBHOOK_SECRET || undefined,
        allowed_updates: ["message", "edited_message"]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram setWebhook failed: ${response.status} ${body}`);
    }
  }
}
