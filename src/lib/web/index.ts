// Web Search & Fetch utilities
//
// web_search: DuckDuckGo search (no API key needed)
// web_fetch: Fetch URL and extract text content (cheerio)

import { search as ddgSearch, SafeSearchType } from "duck-duck-scrape";
import * as cheerio from "cheerio";

// ===========================================
// WEB SEARCH (DuckDuckGo)
// ===========================================

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

const MAX_SEARCH_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

export async function webSearch(
  query: string,
  limit: number = 5,
): Promise<WebSearchResult[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_SEARCH_RETRIES; attempt++) {
    try {
      const results = await ddgSearch(query, {
        safeSearch: SafeSearchType.OFF,
      });

      return results.results.slice(0, limit).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.description,
      }));
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_SEARCH_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  throw lastError;
}

// ===========================================
// WEB FETCH (URL → text)
// ===========================================

export interface WebFetchResult {
  url: string;
  title: string;
  content: string;
  bytesFetched: number;
}

const MAX_FETCH_BYTES = 500_000; // 500KB max download
const MAX_TEXT_CHARS = 15_000;   // 15k chars max returned to LLM

export async function webFetch(url: string): Promise<WebFetchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000); // 15s timeout

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Codeteel/1.0)",
        Accept: "text/html,application/xhtml+xml,text/plain",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";

    // Plain text (e.g., raw GitHub files)
    if (contentType.includes("text/plain") || contentType.includes("application/json")) {
      const text = await response.text();
      return {
        url,
        title: url.split("/").pop() || url,
        content: text.slice(0, MAX_TEXT_CHARS),
        bytesFetched: text.length,
      };
    }

    // HTML — extract text with cheerio
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    const html = await response.text();
    const bytesFetched = html.length;

    const $ = cheerio.load(html.slice(0, MAX_FETCH_BYTES));

    // Remove non-content elements
    $("script, style, nav, header, footer, aside, iframe, noscript, svg, form, [role='navigation'], [role='banner'], [role='complementary']").remove();

    // Extract title
    const title = $("title").text().trim() || $("h1").first().text().trim() || url;

    // Try to find main content area
    let content = "";
    const mainSelectors = ["main", "article", "[role='main']", ".content", ".post-body", ".markdown-body", "#content"];
    for (const selector of mainSelectors) {
      const el = $(selector);
      if (el.length > 0) {
        content = el.text();
        break;
      }
    }

    // Fallback to body
    if (!content) {
      content = $("body").text();
    }

    // Clean up whitespace
    content = content
      .replace(/\s+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, MAX_TEXT_CHARS);

    return { url, title, content, bytesFetched };
  } finally {
    clearTimeout(timeoutId);
  }
}
