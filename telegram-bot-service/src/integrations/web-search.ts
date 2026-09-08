import type { Env } from "../lib/env.js";

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

interface TavilyResponse {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
  }>;
}

export class WebSearchClient {
  public constructor(private readonly env: Env) {}

  public isConfigured(): boolean {
    return Boolean(this.env.TAVILY_API_KEY);
  }

  public async search(query: string): Promise<SearchResultItem[]> {
    if (!this.env.TAVILY_API_KEY) {
      throw new Error("Web search integration is not configured");
    }

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        api_key: this.env.TAVILY_API_KEY,
        query,
        max_results: 5,
        search_depth: "basic",
        include_answer: false,
        include_raw_content: false
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Tavily search failed: ${response.status} ${body}`);
    }

    const payload = (await response.json()) as TavilyResponse;
    return (payload.results ?? []).map((result) => ({
      title: result.title ?? "Untitled result",
      url: result.url ?? "",
      snippet: result.content?.trim() || "No snippet available"
    }));
  }
}
