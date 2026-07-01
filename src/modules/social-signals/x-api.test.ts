import { describe, expect, it, vi } from "vitest";
import {
  fetchXRecentSearchSignals,
  runXSignalIngest,
  type FetchLike,
} from "./x-api";
import type { SocialSignalRepositoryLike } from "./repository";

describe("X API social signal ingest", () => {
  it("fetches recent-search posts with bearer authentication", async () => {
    const fetchMock: FetchLike = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "1",
            text: "China export tariff signal",
            created_at: "2026-07-01T00:00:00.000Z",
            lang: "en",
          },
        ],
      }),
    });

    const items = await fetchXRecentSearchSignals({
      bearerToken: "token",
      fetch: fetchMock,
      maxResults: 10,
      rule: {
        id: "china-trade",
        label: "China Trade",
        query: "(China OR 中国) tariff -is:retweet",
        domains: ["trade"],
      },
      capturedAt: "2026-07-01T00:01:00.000Z",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [requestUrl, init] = vi.mocked(fetchMock).mock.calls[0] ?? [];
    expect(String(requestUrl)).toContain("https://api.x.com/2/tweets/search/recent?");
    expect(String(requestUrl)).toContain("tweet.fields=");
    expect(String(requestUrl)).toContain("expansions=");
    expect(init).toMatchObject({
      headers: {
        Authorization: "Bearer token",
      },
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      externalId: "x-post-1",
      watchRuleId: "china-trade",
      domains: expect.arrayContaining(["trade"]),
    });
  });

  it("runs the first-phase ingest against default watch rules", async () => {
    const repository: SocialSignalRepositoryLike = {
      upsertWatchRules: vi.fn().mockResolvedValue(undefined),
      upsertSignalItems: vi.fn().mockImplementation(async (items) => items),
      listSignalItems: vi.fn().mockResolvedValue([]),
    };
    const jobRepository = {
      startJob: vi.fn().mockResolvedValue({ id: "job-1", status: "running" }),
      finishJob: vi.fn().mockResolvedValue(undefined),
      updateModuleScanState: vi.fn().mockResolvedValue(undefined),
    };
    const fetchMock: FetchLike = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "1",
            text: "China property policy signal",
            created_at: "2026-07-01T00:00:00.000Z",
            lang: "en",
          },
        ],
      }),
    });

    const result = await runXSignalIngest({
      bearerToken: "token",
      fetch: fetchMock,
      jobRepository,
      maxResultsPerRule: 10,
      now: () => new Date("2026-07-01T00:01:00.000Z"),
      repository,
    });

    expect(result).toMatchObject({
      status: "completed",
      ruleCount: 6,
      fetchedCount: 6,
      insertedCount: 6,
    });
    expect(repository.upsertWatchRules).toHaveBeenCalledOnce();
    expect(jobRepository.finishJob).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "job-1",
        status: "completed",
        fetchedCount: 6,
        insertedCount: 6,
      })
    );
    expect(jobRepository.updateModuleScanState).toHaveBeenCalledWith(
      "social-signals",
      expect.objectContaining({
        ruleCount: 6,
        insertedCount: 6,
      }),
      "2026-07-01T00:00:00.000Z"
    );
  });
});
