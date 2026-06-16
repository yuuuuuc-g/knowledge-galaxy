import { describe, expect, it, vi } from "vitest";
import { runIntelligencePipeline } from "./pipeline";
import type { IntelligenceRepository, PersistedSourceArticle } from "./repository";

const article: PersistedSourceArticle = {
  articleId: "article-1",
  sourceId: "nikkei-asia",
  source: "Nikkei Asia",
  title: "Tariff policy shifts China export outlook and port flows",
  url: "https://example.test/tariff",
  snippet: "Trade policy and manufacturing supply chains face tariff repricing in APAC ports.",
  publishedAt: "2026-06-16T00:00:00.000Z",
  fetchedAt: "2026-06-16T00:10:00.000Z",
};

describe("runIntelligencePipeline", () => {
  it("ingests shared source articles and updates module-specific outputs", async () => {
    const repository: Pick<
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
    > = {
      startJob: vi.fn().mockResolvedValue({ id: "job-1", status: "running" }),
      finishJob: vi.fn().mockResolvedValue(undefined),
      upsertSources: vi.fn().mockResolvedValue(undefined),
      upsertSourceArticles: vi.fn().mockResolvedValue([article]),
      listRecentSourceArticles: vi.fn().mockResolvedValue([article]),
      upsertMacroIntelItems: vi.fn().mockResolvedValue(undefined),
      upsertApacSupplyChainSignals: vi.fn().mockResolvedValue(undefined),
      upsertDailyBriefings: vi.fn().mockResolvedValue(undefined),
      updateModuleScanState: vi.fn().mockResolvedValue(undefined),
      toMacroSourceArticles: (articles) =>
        articles.map((item) => ({
          articleId: item.articleId,
          source: item.source,
          title: item.title,
          url: item.url,
          snippet: item.snippet,
          publishedAt: item.publishedAt,
        })),
    };

    const result = await runIntelligencePipeline({
      repository,
      fetchSources: async (sources) => [
        {
          source: sources.find((source) => source.id === "nikkei-asia") ?? sources[0],
          articles: [
            {
              source: "Nikkei Asia",
              title: article.title,
              url: article.url,
              snippet: article.snippet,
              publishedAt: article.publishedAt,
            },
          ],
        },
      ],
      now: () => new Date("2026-06-16T08:00:00.000Z"),
    });

    expect(result.status).toBe("completed");
    expect(repository.upsertSourceArticles).toHaveBeenCalledWith([
      expect.objectContaining({
        sourceName: "Nikkei Asia",
        title: article.title,
        url: article.url,
      }),
    ]);
    expect(repository.upsertMacroIntelItems).toHaveBeenCalledWith([
      expect.objectContaining({
        articleId: "article-1",
        eventType: "trade",
      }),
    ]);
    expect(repository.upsertApacSupplyChainSignals).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          articleId: "article-1",
          url: article.url,
        }),
      ])
    );
    expect(repository.upsertDailyBriefings).toHaveBeenCalledWith([
      expect.objectContaining({
        date: "2026-06-16",
        url: article.url,
      }),
    ]);
    expect(repository.finishJob).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "job-1",
        status: "completed",
        fetchedCount: 1,
        insertedCount: 1,
      })
    );
  });
});
