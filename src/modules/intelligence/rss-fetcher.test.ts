import { describe, expect, it, vi } from "vitest";
import { fetchIntelligenceRssSources } from "./rss-fetcher";
import type { IntelligenceSource } from "./source-registry";

const source: IntelligenceSource = {
  id: "test-source",
  name: "Test Source",
  url: "https://example.test/rss",
  modules: ["macro-intel"],
  regions: ["global"],
  topics: ["macro"],
};

describe("fetchIntelligenceRssSources", () => {
  it("normalizes RSS items into raw intelligence articles", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "<rss />",
    });
    const parser = {
      parseString: vi.fn().mockResolvedValue({
        items: [
          {
            title: " <b>Tariff shift</b> ",
            link: "https://example.test/tariff",
            contentSnippet: "Trade policy &amp; supply chains",
            isoDate: "2026-06-16T00:00:00.000Z",
          },
          {
            title: "",
            link: "https://example.test/empty",
          },
        ],
      }),
    };

    const results = await fetchIntelligenceRssSources({
      sources: [source],
      timeoutMs: 1000,
      userAgent: "KnowledgeGalaxyTest/1.0",
      fetchImpl,
      parser,
    });

    expect(results).toEqual([
      {
        source,
        articles: [
          {
            source: "Test Source",
            title: "Tariff shift",
            url: "https://example.test/tariff",
            snippet: "Trade policy & supply chains",
            publishedAt: "2026-06-16T00:00:00.000Z",
          },
        ],
      },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.test/rss",
      expect.objectContaining({
        cache: "no-store",
        headers: { "User-Agent": "KnowledgeGalaxyTest/1.0" },
      })
    );
  });

  it("returns an empty article list when a source fails", async () => {
    const logWarning = vi.fn();
    const results = await fetchIntelligenceRssSources({
      sources: [source],
      timeoutMs: 1000,
      userAgent: "KnowledgeGalaxyTest/1.0",
      fetchImpl: vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      }),
      logWarning,
    });

    expect(results).toEqual([{ source, articles: [] }]);
    expect(logWarning).toHaveBeenCalledWith("[IntelligenceRSS] Test Source returned 503");
  });
});
