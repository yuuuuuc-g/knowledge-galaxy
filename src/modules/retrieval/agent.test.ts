import { describe, expect, it, vi } from "vitest";
import { runRetrievalAgent, type RetrievalAgentEvent } from "./agent";
import type { RagSearchResult } from "@/src/modules/rag/repository";

async function collectEvents(
  stream: AsyncGenerator<RetrievalAgentEvent>
): Promise<RetrievalAgentEvent[]> {
  const events: RetrievalAgentEvent[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  return events;
}

const evidence: RagSearchResult[] = [
  {
    id: "chunk-1",
    content: "规则降低交易成本。",
    chapter_title: "制度与合作",
    similarity: 0.91,
    chapter_index: 4,
    chunk_index: 2,
  },
];

describe("runRetrievalAgent", () => {
  it("streams retrieval telemetry and a grounded final answer", async () => {
    const searchChunks = vi.fn().mockResolvedValue(evidence);
    const events = await collectEvents(
      runRetrievalAgent({
        query: "规则如何促进合作？",
        bookUuid: "book-1",
        queryRewriteClient: {
          chat: {
            completions: {
              create: vi.fn().mockResolvedValue({
                choices: [{ message: { content: "规则 制度 Institutions 产权" } }],
              }),
            },
          },
        },
        embeddingClient: {
          embeddings: {
            create: vi.fn().mockResolvedValue({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
          },
        },
        agentClient: {
          chat: {
            completions: {
              create: vi
                .fn()
                .mockResolvedValueOnce({
                  choices: [
                    {
                      message: {
                        content: null,
                        tool_calls: [
                          {
                            id: "call_1",
                            type: "function",
                            function: {
                              name: "search_knowledge_base",
                              arguments: JSON.stringify({ query: "制度经济学", match_count: 2 }),
                            },
                          },
                        ],
                      },
                    },
                  ],
                })
                .mockResolvedValueOnce({
                  choices: [
                    {
                      message: {
                        content: "制度通过降低不确定性促进合作。",
                      },
                    },
                  ],
                }),
            },
          },
        },
        ragRepository: {
          searchChunks,
          toSearchResultCitations: () => [
            {
              id: "chunk-1",
              chapter_title: "制度与合作",
              similarity: 0.91,
              chapter_index: 4,
              chunk_index: 2,
              preview: "规则降低交易成本。",
            },
          ],
        },
      })
    );

    expect(events.map((event) => event.type)).toEqual([
      "agent_started",
      "tool_call_started",
      "tool_call_result",
      "iteration_summary",
      "model_delta",
      "iteration_summary",
      "agent_finished",
    ]);
    expect(events[0]?.data).toMatchObject({
      query: "规则如何促进合作？",
      rewrittenQuery: "规则 制度 Institutions 产权",
    });
    expect(events[2]?.data).toMatchObject({
      retrievedChunks: 1,
      results: [{ id: "chunk-1", preview: "规则降低交易成本。" }],
    });
    expect(JSON.stringify(events[2]?.data)).not.toContain("content");
    expect(events[4]?.data).toEqual({
      iteration: 2,
      delta: "制度通过降低不确定性促进合作。",
    });
    expect(searchChunks).toHaveBeenCalledWith({
      query: "制度经济学",
      queryEmbedding: [0.1, 0.2, 0.3],
      matchCount: 2,
      bookUuid: "book-1",
    });
  });

  it("stops with a terminal failure event when the tool loop is exhausted", async () => {
    const events = await collectEvents(
      runRetrievalAgent({
        query: "制度是什么？",
        queryRewriteClient: {
          chat: {
            completions: {
              create: vi.fn().mockResolvedValue({
                choices: [{ message: { content: "制度 Institutions" } }],
              }),
            },
          },
        },
        embeddingClient: {
          embeddings: {
            create: vi.fn().mockResolvedValue({ data: [{ embedding: [0.1] }] }),
          },
        },
        agentClient: {
          chat: {
            completions: {
              create: vi.fn().mockResolvedValue({
                choices: [
                  {
                    message: {
                      content: null,
                      tool_calls: [
                        {
                          id: "call_loop",
                          type: "function",
                          function: {
                            name: "search_knowledge_base",
                            arguments: JSON.stringify({ query: "制度", match_count: 1 }),
                          },
                        },
                      ],
                    },
                  },
                ],
              }),
            },
          },
        },
        ragRepository: {
          searchChunks: vi.fn().mockResolvedValue([]),
          toSearchResultCitations: () => [],
        },
        config: {
          maxIterations: 2,
        },
      })
    );

    expect(events.at(-1)).toEqual({
      type: "agent_failed",
      data: {
        reason: "max_iterations_exceeded",
        message: "Agent reached the maximum tool loop iterations.",
      },
    });
  });
});
