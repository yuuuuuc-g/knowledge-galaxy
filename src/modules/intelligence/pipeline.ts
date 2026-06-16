import {
  buildApacSupplyChainPayloadFromArticles,
  type ApacSupplyItem,
} from "@/src/lib/apac-supply-chain";
import {
  buildMacroIntelPayloadFromArticles,
} from "@/src/modules/intelligence/macro-intel";
import {
  type BriefingItem,
  buildEditorialPrompt,
  createAiBriefingSelector,
  type RawHeadline,
} from "@/src/modules/intelligence/daily-briefing-job";
import type {
  IntelligenceRepository,
  PersistedSourceArticle,
  SourceArticleInput,
} from "@/src/modules/intelligence/repository";
import {
  fetchIntelligenceRssSources,
  type IntelligenceSourceFetchResult,
} from "@/src/modules/intelligence/rss-fetcher";
import {
  getAllIntelligenceSources,
  type IntelligenceSource,
} from "@/src/modules/intelligence/source-registry";
import type { LanguageModel } from "ai";

export interface IntelligencePipelineInput {
  repository: Pick<
    IntelligenceRepository,
    | "finishJob"
    | "listRecentSourceArticles"
    | "startJob"
    | "toMacroSourceArticles"
    | "updateModuleScanState"
    | "upsertApacSupplyChainSignals"
    | "upsertDailyBriefings"
    | "upsertMacroIntelItems"
    | "upsertSourceArticles"
    | "upsertSources"
  >;
  dailyBriefingModel?: LanguageModel;
  fetchSources?: (sources: IntelligenceSource[]) => Promise<IntelligenceSourceFetchResult[]>;
  now?: () => Date;
}

export interface IntelligencePipelineResult {
  status: "completed" | "failed";
  sourceCount: number;
  fetchedCount: number;
  insertedCount: number;
  macroItemsCount: number;
  apacSignalsCount: number;
  dailyBriefingsCount: number;
  error?: string;
}

const FETCH_TIMEOUT_MS = 12_000;
const PER_SOURCE_CAP = 12;

function toSourceArticleInputs(results: IntelligenceSourceFetchResult[]): SourceArticleInput[] {
  return results.flatMap((result) =>
    result.articles.map((article) => ({
      sourceId: result.source.id,
      sourceName: article.source,
      title: article.title,
      url: article.url,
      snippet: article.snippet,
      publishedAt: article.publishedAt,
      rawPayload: {
        sourceId: result.source.id,
        regions: result.source.regions,
        topics: result.source.topics,
      },
    }))
  );
}

function toRawHeadlines(articles: PersistedSourceArticle[]): RawHeadline[] {
  return articles.map((article) => ({
    source: article.source,
    title: article.title,
    url: article.url,
    snippet: article.snippet,
    publishedAt: article.publishedAt,
  }));
}

async function selectDailyBriefings(input: {
  articles: PersistedSourceArticle[];
  model?: LanguageModel;
}): Promise<BriefingItem[]> {
  const headlines = toRawHeadlines(input.articles);
  if (headlines.length === 0) {
    return [];
  }

  if (input.model) {
    return createAiBriefingSelector(input.model)(headlines);
  }

  return headlines.slice(0, 8).map((headline) => ({
    title: headline.title,
    source: headline.source,
    url: headline.url,
    ai_summary: headline.snippet.slice(0, 120) || headline.title,
  }));
}

function dateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

async function fetchSources(
  sources: IntelligenceSource[],
  input: IntelligencePipelineInput
): Promise<IntelligenceSourceFetchResult[]> {
  if (input.fetchSources) {
    return input.fetchSources(sources);
  }

  return fetchIntelligenceRssSources({
    sources,
    timeoutMs: FETCH_TIMEOUT_MS,
    perSourceCap: PER_SOURCE_CAP,
    userAgent: "Mozilla/5.0 (compatible; KnowledgeGalaxyIntelligenceIngest/1.0)",
    logWarning: (message, error) => console.warn(message, error),
  });
}

export async function runIntelligencePipeline(
  input: IntelligencePipelineInput
): Promise<IntelligencePipelineResult> {
  const sources = getAllIntelligenceSources();
  const job = await input.repository.startJob("intelligence-ingest");

  try {
    await input.repository.upsertSources(sources);
    const fetchResults = await fetchSources(sources, input);
    const articleInputs = toSourceArticleInputs(fetchResults);
    const persistedArticles = await input.repository.upsertSourceArticles(articleInputs);
    const recentArticles = await input.repository.listRecentSourceArticles(100);
    const macroPayload = buildMacroIntelPayloadFromArticles({
      articles: input.repository.toMacroSourceArticles(recentArticles),
      generatedAt: (input.now?.() ?? new Date()).toISOString(),
      sourceCount: sources.length,
      successfulSourceCount: fetchResults.filter((result) => result.articles.length > 0).length,
    });
    const apacPayload = buildApacSupplyChainPayloadFromArticles({
      articles: input.repository.toMacroSourceArticles(recentArticles),
      generatedAt: (input.now?.() ?? new Date()).toISOString(),
      sourceCount: sources.length,
    });
    const dailyBriefings = await selectDailyBriefings({
      articles: recentArticles,
      model: input.dailyBriefingModel,
    });
    const today = dateKey(input.now?.() ?? new Date());
    const lastScannedArticleAt = recentArticles[0]?.publishedAt ?? recentArticles[0]?.fetchedAt ?? null;

    await input.repository.upsertMacroIntelItems(macroPayload.items);
    await input.repository.upsertApacSupplyChainSignals(apacPayload.items);
    await input.repository.upsertDailyBriefings(
      dailyBriefings.map((briefing) => ({
        date: today,
        source: briefing.source,
        title: briefing.title,
        url: briefing.url,
        ai_summary: briefing.ai_summary,
      }))
    );
    await Promise.all([
      input.repository.updateModuleScanState("macro-intel", {
        itemCount: macroPayload.items.length,
      }, lastScannedArticleAt),
      input.repository.updateModuleScanState("apac-supply-chain", {
        itemCount: apacPayload.items.filter((item) => item.url).length,
      }, lastScannedArticleAt),
      input.repository.updateModuleScanState("daily-briefing", {
        promptPreview: buildEditorialPrompt(toRawHeadlines(recentArticles)).slice(0, 500),
        itemCount: dailyBriefings.length,
      }, lastScannedArticleAt),
    ]);

    const result = {
      status: "completed" as const,
      sourceCount: sources.length,
      fetchedCount: articleInputs.length,
      insertedCount: persistedArticles.length,
      macroItemsCount: macroPayload.items.length,
      apacSignalsCount: apacPayload.items.filter((item): item is ApacSupplyItem & { url: string } =>
        typeof item.url === "string"
      ).length,
      dailyBriefingsCount: dailyBriefings.length,
    };

    await input.repository.finishJob({
      id: job.id,
      status: "completed",
      sourceCount: result.sourceCount,
      fetchedCount: result.fetchedCount,
      insertedCount: result.insertedCount,
      metadata: {
        macroItemsCount: result.macroItemsCount,
        apacSignalsCount: result.apacSignalsCount,
        dailyBriefingsCount: result.dailyBriefingsCount,
      },
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown intelligence pipeline error.";
    await input.repository.finishJob({
      id: job.id,
      status: "failed",
      sourceCount: sources.length,
      fetchedCount: 0,
      insertedCount: 0,
      error: message,
    });

    return {
      status: "failed",
      sourceCount: sources.length,
      fetchedCount: 0,
      insertedCount: 0,
      macroItemsCount: 0,
      apacSignalsCount: 0,
      dailyBriefingsCount: 0,
      error: message,
    };
  }
}
