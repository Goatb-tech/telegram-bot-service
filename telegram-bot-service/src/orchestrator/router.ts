import type { Database } from "../db/index.js";
import { GoogleCalendarClient } from "../integrations/google-calendar.js";
import { SlackClient } from "../integrations/slack.js";
import { WebSearchClient } from "../integrations/web-search.js";
import type { Env } from "../lib/env.js";
import { OpenAIClient, type Intent } from "../lib/openai.js";
import { CalendarHandler } from "./handlers/calendar.js";
import { CommunicationsHandler } from "./handlers/communications.js";
import { WebSearchHandler } from "./handlers/web-search.js";

export interface OrchestratorResult {
  intent: Intent;
  responseText: string;
  metadata?: Record<string, unknown>;
}

export class Orchestrator {
  private readonly openAIClient: OpenAIClient;
  private readonly calendarHandler: CalendarHandler;
  private readonly communicationsHandler: CommunicationsHandler;
  private readonly webSearchHandler: WebSearchHandler;

  public constructor(private readonly env: Env, private readonly db: Database) {
    this.openAIClient = new OpenAIClient(env);
    this.calendarHandler = new CalendarHandler(env, db, new GoogleCalendarClient(env));
    this.communicationsHandler = new CommunicationsHandler(db, new SlackClient(env));
    this.webSearchHandler = new WebSearchHandler(db, this.openAIClient, new WebSearchClient(env));
  }

  public async handleMessage(message: string): Promise<OrchestratorResult> {
    const route = await this.openAIClient.routeIntent(message);

    switch (route.intent) {
      case "calendar":
        return {
          intent: "calendar",
          responseText: await this.calendarHandler.handle(message),
          metadata: { routeReason: route.reason, confidence: route.confidence }
        };

      case "communications":
        return {
          intent: "communications",
          responseText: await this.communicationsHandler.handle(message),
          metadata: { routeReason: route.reason, confidence: route.confidence }
        };

      case "web_search":
        return {
          intent: "web_search",
          responseText: await this.webSearchHandler.handle(message),
          metadata: { routeReason: route.reason, confidence: route.confidence }
        };

      default:
        return {
          intent: "unknown",
          responseText:
            "I can help with three v1 actions: Google Calendar read/query, Slack outbound posts, and web search. Try: What do I have this week?, Post to Slack #ops: ..., or Search the web for ...",
          metadata: { routeReason: route.reason, confidence: route.confidence }
        };
    }
  }
}
