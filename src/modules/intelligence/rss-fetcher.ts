import Parser from "rss-parser";
import type { IntelligenceSource } from "./source-registry";

export interface RawIntelligenceArticle {
  source: string;
  title: string;
  url: string;
  snippet: string;
  publishedAt: string | null;
}

export interface IntelligenceSourceFetchResult {
  source: IntelligenceSource;
  articles: RawIntelligenceArticle[];
}

export interface FetchIntelligenceRssInput {
  sources: IntelligenceSource[];
  timeoutMs: number;
  perSourceCap?: number;
  userAgent: string;
  parser?: Pick<Parser, "parseString">;
  fetchImpl?: typeof fetch;
  logWarning?: (message: string, error?: unknown) => void;
  buildRequestInit?: (input: {
    source: IntelligenceSource;
    signal: AbortSignal;
    userAgent: string;
  }) => RequestInit;
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3).trim()}...`;
}

async function fetchOneSource(
  input: Omit<FetchIntelligenceRssInput, "sources"> & { source: IntelligenceSource }
): Promise<IntelligenceSourceFetchResult> {
  const parser = input.parser ?? new Parser({ timeout: input.timeoutMs });
  const fetchImpl = input.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const requestInit = input.buildRequestInit?.({
      source: input.source,
      signal: controller.signal,
      userAgent: input.userAgent,
    }) ?? {
      cache: "no-store",
      headers: {
        "User-Agent": input.userAgent,
      },
      signal: controller.signal,
    };
    const response = await fetchImpl(input.source.url, requestInit);

    if (!response.ok) {
      input.logWarning?.(`[IntelligenceRSS] ${input.source.name} returned ${response.status}`);
      return { source: input.source, articles: [] };
    }

    const xml = await response.text();
    const feed = await parser.parseString(xml);
    const items = input.perSourceCap ? (feed.items ?? []).slice(0, input.perSourceCap) : feed.items ?? [];
    const articles = items
      .map((item) => {
        const title = stripHtml(item.title ?? "");
        const url = (item.link ?? "").trim();
        if (!title || !url) {
          return null;
        }

        return {
          source: input.source.name,
          title,
          url,
          snippet: truncate(stripHtml(item.contentSnippet ?? item.content ?? ""), 900),
          publishedAt: item.isoDate ?? item.pubDate ?? null,
        };
      })
      .filter((item): item is RawIntelligenceArticle => item !== null);

    return { source: input.source, articles };
  } catch (error) {
    input.logWarning?.(`[IntelligenceRSS] ${input.source.name} failed`, error);
    return { source: input.source, articles: [] };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchIntelligenceRssSources(
  input: FetchIntelligenceRssInput
): Promise<IntelligenceSourceFetchResult[]> {
  return Promise.all(
    input.sources.map((source) =>
      fetchOneSource({
        ...input,
        source,
      })
    )
  );
}
