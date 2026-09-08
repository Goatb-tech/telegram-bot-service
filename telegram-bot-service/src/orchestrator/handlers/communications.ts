import type { Database } from "../../db/index.js";
import { SlackClient } from "../../integrations/slack.js";

export class CommunicationsHandler {
  public constructor(private readonly db: Database, private readonly slackClient: SlackClient) {}

  public async handle(message: string): Promise<string> {
    if (!this.slackClient.isConfigured()) {
      await this.db.setIntegrationHealth({
        service: "slack",
        status: "unconfigured",
        message: "Missing Slack token"
      });

      return "Slack is not configured yet. Add SLACK_BOT_TOKEN with outbound posting scopes before using Slack announcements.";
    }

    const parsed = parseSlackCommand(message);
    if (!parsed) {
      return "I can post outbound Slack messages in this format: Post to Slack #ops: Deployment completed successfully.";
    }

    try {
      const result = await this.slackClient.postMessage(parsed.channel, parsed.text);
      await this.db.setIntegrationHealth({
        service: "slack",
        status: "ok",
        message: `Posted to #${result.channelName}`
      });

      return `Posted to Slack #${result.channelName}. Message timestamp: ${result.timestamp}.`;
    } catch (error) {
      await this.db.setIntegrationHealth({
        service: "slack",
        status: "error",
        message: error instanceof Error ? error.message : "Unknown Slack error"
      });

      throw error;
    }
  }
}

function parseSlackCommand(message: string): { channel: string; text: string } | null {
  const match = message.match(/(?:post|send|announce)(?:\s+to)?\s+slack\s+(#[A-Za-z0-9._-]+|[A-Z0-9]{8,})\s*:\s*([\s\S]+)/i);
  if (!match) {
    return null;
  }

  const channel = match[1];
  const text = match[2];
  if (!channel || !text) {
    return null;
  }

  return {
    channel,
    text: text.trim()
  };
}
