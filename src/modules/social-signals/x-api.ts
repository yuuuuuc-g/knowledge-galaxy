import { ProxyAgent, Socks5ProxyAgent } from "undici";
import type { IntelligenceJobSummary } from "@/src/modules/intelligence/repository";
import type { SocialSignalItem, XWatchRule } from "@/src/modules/social-signals/x-signals";
import {
  buildDefaultXWatchRules,
  normalizeXRecentSearchResponse,
} from "@/src/modules/social-signals/x-signals";
import type { SocialSignalRepositoryLike } from "@/src/modules/social-signals/repository";

export type FetchLike = (
  input: string | URL,
  init?: {
    dispatcher?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  }
) => Promise<{
  ok: boolean;
  status: number;
  statusText?: string;
  json: () => Promise<unknown>;
}>;

interface FetchXRecentSearchSignalsInput {
  bearerToken: string;
  capturedAt: string;
  fetch?: FetchLike;
  maxResults?: number;
  rule: XWatchRule;
  signal?: AbortSignal;
}

interface JobRepositoryLike {
  finishJob(input: {
    id: string;
    status: "completed" | "failed";
    sourceCount: number;
    fetchedCount: number;
    insertedCount: number;
    error?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  startJob(jobType: string): Promise<IntelligenceJobSummary>;
  updateModuleScanState(
    moduleId: string,
    metadata: Record<string, unknown>,
    lastScannedArticleAt: string | null
  ): Promise<void>;
}

export interface XSignalIngestInput {
  bearerToken: string;
  fetch?: FetchLike;
  jobRepository?: JobRepositoryLike;
  maxResultsPerRule?: number;
  now?: () => Date;
  repository: Pick<SocialSignalRepositoryLike, "upsertSignalItems" | "upsertWatchRules">;
  rules?: XWatchRule[];
}

export interface XSignalIngestResult {
  status: "completed" | "failed";
  failedRules?: Array<{ error: string; id: string }>;
  ruleCount: number;
  fetchedCount: number;
  insertedCount: number;
  error?: string;
}

const X_RECENT_SEARCH_URL = "https://api.x.com/2/tweets/search/recent";
const DEFAULT_MAX_RESULTS = 10;

function readProxyEnv(name: string): string | undefined {
  return process.env[name] ?? process.env[name.toLowerCase()];
}

function createProxyDispatcher(proxyUrl: string) {
  const normalizedProxyUrl = proxyUrl.toLowerCase();

  if (normalizedProxyUrl.startsWith("socks5://") || normalizedProxyUrl.startsWith("socks5h://")) {
    const undiciProxyUrl = normalizedProxyUrl.startsWith("socks5h://")
      ? `socks5://${proxyUrl.slice("socks5h://".length)}`
      : proxyUrl;
    return new Socks5ProxyAgent(undiciProxyUrl);
  }

  return new ProxyAgent(proxyUrl);
}

function createXApiProxyDispatcherFromEnv(): ProxyAgent | Socks5ProxyAgent | undefined {
  const explicitProxy = process.env.X_API_PROXY;
  if (explicitProxy) {
    return createProxyDispatcher(explicitProxy);
  }

  const allProxy = readProxyEnv("ALL_PROXY");
  if (allProxy) {
    process.env.HTTPS_PROXY = readProxyEnv("HTTPS_PROXY") ?? allProxy;
    process.env.HTTP_PROXY = readProxyEnv("HTTP_PROXY") ?? allProxy;
  }

  const proxy = readProxyEnv("HTTPS_PROXY") ?? readProxyEnv("HTTP_PROXY");
  if (!proxy) {
    return undefined;
  }

  return createProxyDispatcher(proxy);
}

function getFetch(fetchInput?: FetchLike): FetchLike {
  if (fetchInput) {
    return fetchInput;
  }
  return fetch;
}

function buildRecentSearchUrl(rule: XWatchRule, maxResults: number): URL {
  const url = new URL(X_RECENT_SEARCH_URL);
  url.searchParams.set("query", rule.query);
  url.searchParams.set("max_results", String(maxResults));
  url.searchParams.set(
    "tweet.fields",
    [
      "attachments",
      "author_id",
      "context_annotations",
      "conversation_id",
      "created_at",
      "entities",
      "geo",
      "lang",
      "public_metrics",
      "referenced_tweets",
    ].join(",")
  );
  url.searchParams.set("user.fields", ["description", "id", "name", "public_metrics", "username", "verified"].join(","));
  url.searchParams.set("media.fields", ["media_key", "preview_image_url", "type", "url"].join(","));
  url.searchParams.set("expansions", ["author_id", "attachments.media_keys", "referenced_tweets.id"].join(","));
  return url;
}

export async function fetchXRecentSearchSignals(
  input: FetchXRecentSearchSignalsInput
): Promise<SocialSignalItem[]> {
  const dispatcher = input.fetch ? undefined : createXApiProxyDispatcherFromEnv();
  const response = await getFetch(input.fetch)(buildRecentSearchUrl(input.rule, input.maxResults ?? DEFAULT_MAX_RESULTS), {
    ...(dispatcher ? { dispatcher } : {}),
    headers: {
      Authorization: `Bearer ${input.bearerToken}`,
      Accept: "application/json",
    },
    signal: input.signal,
  });

  if (!response.ok) {
    throw new Error(`X recent search failed with ${response.status} ${response.statusText ?? ""}`.trim());
  }

  const payload = await response.json();
  return normalizeXRecentSearchResponse(payload, {
    capturedAt: input.capturedAt,
    watchRuleId: input.rule.id,
  });
}

function latestPublishedAt(items: SocialSignalItem[]): string | null {
  const sorted = items
    .map((item) => item.publishedAt)
    .filter((value): value is string => typeof value === "string")
    .sort((a, b) => b.localeCompare(a));

  return sorted[0] ?? null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? `: ${error.cause.message}` : "";
    return `${error.message}${cause}`;
  }
  return "Unknown error";
}

export async function runXSignalIngest(input: XSignalIngestInput): Promise<XSignalIngestResult> {
  const rules = input.rules ?? buildDefaultXWatchRules();
  const capturedAt = (input.now?.() ?? new Date()).toISOString();
  const job = input.jobRepository ? await input.jobRepository.startJob("x-social-signals-ingest") : null;

  try {
    await input.repository.upsertWatchRules(rules);

    const fetchedItems: SocialSignalItem[] = [];
    const failedRules: Array<{ error: string; id: string }> = [];
    for (const rule of rules) {
      try {
        const items = await fetchXRecentSearchSignals({
          bearerToken: input.bearerToken,
          capturedAt,
          fetch: input.fetch,
          maxResults: input.maxResultsPerRule,
          rule,
        });
        fetchedItems.push(...items);
      } catch (error) {
        failedRules.push({
          id: rule.id,
          error: errorMessage(error),
        });
      }
    }

    if (fetchedItems.length === 0 && failedRules.length > 0) {
      throw new Error(`All X watch rules failed: ${failedRules.map((rule) => `${rule.id}: ${rule.error}`).join("; ")}`);
    }

    const insertedItems = await input.repository.upsertSignalItems(fetchedItems);
    const result: XSignalIngestResult = {
      status: "completed",
      ruleCount: rules.length,
      fetchedCount: fetchedItems.length,
      insertedCount: insertedItems.length,
      ...(failedRules.length > 0 ? { failedRules } : {}),
    };

    if (input.jobRepository && job) {
      await input.jobRepository.updateModuleScanState(
        "social-signals",
        {
          ruleCount: result.ruleCount,
          fetchedCount: result.fetchedCount,
          failedRules,
          insertedCount: result.insertedCount,
        },
        latestPublishedAt(insertedItems)
      );
      await input.jobRepository.finishJob({
        id: job.id,
        status: "completed",
        sourceCount: result.ruleCount,
        fetchedCount: result.fetchedCount,
        insertedCount: result.insertedCount,
        metadata: {
          failedRules,
          moduleId: "social-signals",
        },
      });
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown X social signal ingest error.";
    if (input.jobRepository && job) {
      await input.jobRepository.finishJob({
        id: job.id,
        status: "failed",
        sourceCount: rules.length,
        fetchedCount: 0,
        insertedCount: 0,
        error: message,
        metadata: {
          moduleId: "social-signals",
        },
      });
    }

    return {
      status: "failed",
      ruleCount: rules.length,
      fetchedCount: 0,
      insertedCount: 0,
      error: message,
    };
  }
}
