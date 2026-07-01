import { describe, expect, it } from "vitest";
import {
  buildDefaultXWatchRules,
  normalizeXRecentSearchResponse,
  summarizeSignalBoards,
} from "./x-signals";

describe("X social signals", () => {
  it("normalizes X recent-search posts into tagged signal items", () => {
    const payload = {
      data: [
        {
          id: "1800000000000000001",
          text: "China property stimulus and yuan policy are driving market debate today.",
          author_id: "42",
          created_at: "2026-07-01T02:00:00.000Z",
          lang: "en",
          public_metrics: {
            retweet_count: 12,
            reply_count: 4,
            like_count: 88,
            quote_count: 7,
          },
          attachments: {
            media_keys: ["media-1"],
          },
        },
      ],
      includes: {
        users: [
          {
            id: "42",
            name: "China Macro Watch",
            username: "cnmacro",
            verified: true,
          },
        ],
        media: [
          {
            media_key: "media-1",
            type: "photo",
            url: "https://pbs.twimg.com/media/example.jpg",
          },
        ],
      },
    };

    const items = normalizeXRecentSearchResponse(payload, {
      capturedAt: "2026-07-01T02:05:00.000Z",
      watchRuleId: "china-macro",
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      externalId: "x-post-1800000000000000001",
      sourceType: "post",
      title: "China property stimulus and yuan policy are driving market debate today.",
      authorUsername: "cnmacro",
      actorType: "analyst",
      signalType: "policy_hint",
      stance: "neutral",
      urgency: "medium",
      captureMethod: "recent_search",
      processingState: "raw",
      domains: expect.arrayContaining(["macro", "finance", "politics"]),
      topicTags: expect.arrayContaining(["property", "yuan", "policy"]),
      mediaUrls: ["https://pbs.twimg.com/media/example.jpg"],
    });
  });

  it("builds default watch rules for China signal coverage", () => {
    const rules = buildDefaultXWatchRules();

    expect(rules.map((rule) => rule.id)).toEqual([
      "china-macro",
      "china-policy",
      "china-society",
      "china-trade",
      "china-finance-investment",
      "china-geopolitics-history",
    ]);
    expect(rules[0]?.query).toContain("(China OR 中国)");
  });

  it("summarizes boards from normalized signal items", () => {
    const boards = summarizeSignalBoards([
      {
        externalId: "x-post-1",
        sourceType: "post",
        title: "China tariff debate",
        body: "China tariff debate",
        url: "https://x.com/i/web/status/1",
        authorId: "1",
        authorUsername: "trade",
        authorDisplayName: "Trade",
        actorType: "analyst",
        publishedAt: "2026-07-01T00:00:00.000Z",
        capturedAt: "2026-07-01T00:01:00.000Z",
        domains: ["trade", "geopolitics"],
        topicTags: ["tariff"],
        regionScope: "us_china",
        signalType: "policy_hint",
        stance: "mixed",
        confidence: "medium",
        urgency: "high",
        timeHorizon: "weekly",
        language: "en",
        captureMethod: "recent_search",
        processingState: "raw",
        engagementScore: 20,
        mediaUrls: [],
        rawPayload: {},
        watchRuleId: "china-trade",
      },
    ]);

    expect(boards).toEqual([
      expect.objectContaining({
        id: "trade",
        label: "Trade & Supply Chains",
        itemCount: 1,
        highUrgencyCount: 1,
      }),
      expect.objectContaining({
        id: "geopolitics",
        label: "Geopolitical Sensorium",
        itemCount: 1,
      }),
    ]);
  });
});
