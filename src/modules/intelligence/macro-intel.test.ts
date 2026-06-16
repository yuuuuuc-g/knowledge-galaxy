import { describe, expect, it } from "vitest";
import {
  buildMacroIntelPayload,
  buildMacroRawArticlePayload,
} from "./macro-intel";
import type { IntelligenceSourceFetchResult } from "./rss-fetcher";

const fetchResults: IntelligenceSourceFetchResult[] = [
  {
    source: {
      id: "macro-desk",
      name: "Macro Desk",
      url: "https://example.test/rss",
      modules: ["macro-intel"],
      regions: ["global"],
      topics: ["macro"],
    },
    articles: [
      {
        source: "Macro Desk",
        title: "Tariff policy shifts China export outlook",
        url: "https://example.test/tariff",
        snippet: "Trade policy and manufacturing supply chains face tariff repricing.",
        publishedAt: "2026-06-16T00:00:00.000Z",
      },
      {
        source: "Macro Desk",
        title: "Sports item should be ignored",
        url: "https://example.test/sports",
        snippet: "No macro signal here.",
        publishedAt: null,
      },
    ],
  },
];

describe("macro intelligence payloads", () => {
  it("builds raw macro articles from shared source fetch results", async () => {
    const payload = await buildMacroRawArticlePayload({
      fetchSources: async () => fetchResults,
      now: () => new Date("2026-06-16T08:00:00.000Z"),
    });

    expect(payload.generatedAt).toBe("2026-06-16T08:00:00.000Z");
    expect(payload.successfulSourceCount).toBe(1);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({
      id: 1,
      source: "Macro Desk",
      title: "Tariff policy shifts China export outlook",
      score: expect.any(Number),
    });
  });

  it("builds heuristic macro archive items without reading static JSON snapshots", async () => {
    const payload = await buildMacroIntelPayload({
      fetchSources: async () => fetchResults,
      now: () => new Date("2026-06-16T08:00:00.000Z"),
    });

    expect(payload.llmEnabled).toBe(false);
    expect(payload.items[0]).toMatchObject({
      id: 1,
      eventType: "trade",
      affectedRegions: ["China", "APAC"],
      affectedSectors: ["trade", "manufacturing"],
    });
  });
});
