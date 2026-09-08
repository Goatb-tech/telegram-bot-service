import type { Database } from "../../db/index.js";
import { WebSearchClient } from "../../integrations/web-search.js";
import { OpenAIClient } from "../../lib/openai.js";

export class WebSearchHandler {
  public constructor(
    private readonly db: Database,
    private readonly openAIClient: OpenAIClient,
    private readonly webSearchClient: WebSearchClient
  ) {}

  public async handle(message: string): Promise<string> {
    if (!this.webSearchClient.isConfigured()) {
      await this.db.setIntegrationHealth({
        service: "web_search",
        status: "unconfigured",
        message: "Missing Tavily API key"
      });

      return "Web search is not configured yet. Add TAVILY_API_KEY before using web search.";
    }

    const query = extractSearchQuery(message);
    if (!query) {
      return "Use a web search request like: Search the web for latest Railway Postgres limits";
    }

    try {
      const results = await this.webSearchClient.search(query);
      await this.db.setIntegrationHealth({
        service: "web_search",
        status: "ok",
        message: `Fetched ${results.length} search results`
      });

      if (results.length === 0) {
        return `I couldn't find any web results for: ${query}`;
      }

      const summary = await this.openAIClient.summarizeSearchResults(query, results);
      const sources = results.map((result, index) => `${index + 1}. ${result.title} - ${result.url}`);

      return [summary, "", "Sources:", ...sources].join("\n");
    } catch (error) {
      await this.db.setIntegrationHealth({
        service: "web_search",
        status: "error",
        message: error instanceof Error ? error.message : "Unknown web search error"
      });

      throw error;
    }
  }
}

function extractSearchQuery(message: string): string {
  return message
    .replace(/^(search the web for|web search|search for|look up)\s+/i, "")
    .trim();
}
