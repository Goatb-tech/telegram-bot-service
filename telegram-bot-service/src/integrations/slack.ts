import { WebClient } from "@slack/web-api";

import type { Env } from "../lib/env.js";

export interface SlackChannel {
  id: string;
  name: string;
}

export interface SlackPostResult {
  channelId: string;
  channelName: string;
  timestamp: string;
}

export class SlackClient {
  private readonly client?: WebClient;

  public constructor(private readonly env: Env) {
    if (env.SLACK_BOT_TOKEN) {
      this.client = new WebClient(env.SLACK_BOT_TOKEN);
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.client);
  }

  public async resolveChannel(channelRef: string): Promise<SlackChannel> {
    if (!this.client) {
      throw new Error("Slack integration is not configured");
    }

    const normalized = channelRef.replace(/^#/, "");
    let cursor: string | undefined;

    do {
      const response = await this.client.conversations.list({
        limit: 200,
        exclude_archived: true,
        ...(cursor ? { cursor } : {}),
        types: "public_channel,private_channel"
      });

      const match = response.channels?.find((channel) => channel.name === normalized || channel.id === channelRef);
      if (match?.id && match.name) {
        return { id: match.id, name: match.name };
      }

      cursor = response.response_metadata?.next_cursor || undefined;
    } while (cursor);

    throw new Error(`Slack channel not found: ${channelRef}`);
  }

  public async postMessage(channelRef: string, text: string): Promise<SlackPostResult> {
    if (!this.client) {
      throw new Error("Slack integration is not configured");
    }

    const channel = await this.resolveChannel(channelRef);
    const response = await this.client.chat.postMessage({
      channel: channel.id,
      text
    });

    if (!response.ts) {
      throw new Error("Slack did not return a message timestamp");
    }

    return {
      channelId: channel.id,
      channelName: channel.name,
      timestamp: response.ts
    };
  }
}
