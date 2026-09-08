import OpenAI from "openai";

import type { Env } from "./env.js";

export type Intent = "calendar" | "communications" | "web_search" | "unknown";

export interface RoutingDecision {
  intent: Intent;
  confidence: number;
  reason: string;
}

interface SearchSummaryResult {
  summary: string;
}

interface SearchResultInput {
  title: string;
  url: string;
  snippet: string;
}

export class OpenAIClient {
  private readonly client?: OpenAI;

  public constructor(private readonly env: Env) {
    if (env.OPENAI_API_KEY) {
      this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    }
  }

  public async routeIntent(message: string): Promise<RoutingDecision> {
    if (!this.client) {
      return this.fallbackRoute(message);
    }

    try {
      const response = await this.client.responses.create({
        model: this.env.OPENAI_ROUTER_MODEL,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "Classify the user request into exactly one intent: calendar, communications, web_search, or unknown. Return strict JSON with keys intent, confidence, and reason. communications is only for outbound Slack posting. calendar is read-only Google Calendar lookup. web_search is for external web lookups. If ambiguous, return unknown."
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: message
              }
            ]
          }
        ]
      });

      const parsed = safeJsonParse<RoutingDecision>(response.output_text);
      if (!parsed || !isIntent(parsed.intent)) {
        return this.fallbackRoute(message);
      }

      return {
        intent: parsed.intent,
        confidence: clampConfidence(parsed.confidence),
        reason: parsed.reason || "No reason provided"
      };
    } catch {
      return this.fallbackRoute(message);
    }
  }

  public async summarizeSearchResults(query: string, results: SearchResultInput[]): Promise<string> {
    if (!this.client) {
      return fallbackSearchSummary(results);
    }

    try {
      const response = await this.client.responses.create({
        model: this.env.OPENAI_RESPONSE_MODEL,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "Summarize the web search results in 2-4 short bullets. Be faithful to the provided results only. Do not mention sources in the summary because the caller appends them separately. Return strict JSON with a single key named summary."
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify({ query, results })
              }
            ]
          }
        ]
      });

      const parsed = safeJsonParse<SearchSummaryResult>(response.output_text);
      if (!parsed?.summary) {
        return fallbackSearchSummary(results);
      }

      return parsed.summary.trim();
    } catch {
      return fallbackSearchSummary(results);
    }
  }

  private fallbackRoute(message: string): RoutingDecision {
    const lower = message.toLowerCase();

    if (/(calendar|schedule|events|meeting|what do i have|this week|today)/.test(lower)) {
      return { intent: "calendar", confidence: 0.65, reason: "Calendar-like wording detected" };
    }

    if (/(post to slack|slack|announce|announcement|send to #)/.test(lower)) {
      return { intent: "communications", confidence: 0.7, reason: "Slack posting wording detected" };
    }

    if (/(search the web|web search|search for|look up|find on the web|google)/.test(lower)) {
      return { intent: "web_search", confidence: 0.7, reason: "Search wording detected" };
    }

    return { intent: "unknown", confidence: 0.2, reason: "No strong route match" };
  }
}

function safeJsonParse<T>(value: string): T | null {
  const trimmed = value.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

function clampConfidence(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function isIntent(value: string): value is Intent {
  return value === "calendar" || value === "communications" || value === "web_search" || value === "unknown";
}

function fallbackSearchSummary(results: SearchResultInput[]): string {
  const bullets = results.slice(0, 3).map((result) => `- ${result.title}: ${result.snippet}`);
  return bullets.join("\n");
}
