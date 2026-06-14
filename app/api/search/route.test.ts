import { beforeEach, describe, expect, it, vi } from "vitest";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";

const mocks = vi.hoisted(() => ({
  rewriteCreate: vi.fn(),
  embeddingsCreate: vi.fn(),
  agentCreate: vi.fn(),
  rpc: vi.fn(),
  openAIConstructor: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("openai", () => ({
  default: vi.fn(function OpenAIMock(config: { baseURL?: string }) {
    mocks.openAIConstructor(config);

    if (config.baseURL === GEMINI_BASE_URL) {
      return {
        chat: {
          completions: {
            create: mocks.rewriteCreate,
          },
        },
        embeddings: {
          create: vi.fn(),
        },
      };
    }

    if (config.baseURL === SILICONFLOW_BASE_URL) {
      return {
        chat: {
          completions: {
            create: vi.fn(),
          },
        },
        embeddings: {
          create: mocks.embeddingsCreate,
        },
      };
    }

    if (config.baseURL === DEEPSEEK_BASE_URL) {
      return {
        chat: {
          completions: {
            create: mocks.agentCreate,
          },
        },
        embeddings: {
          create: vi.fn(),
        },
      };
    }

    throw new Error("Unexpected OpenAI client config.");
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn((url: string, key: string) => {
    mocks.createClient(url, key);

    return {
      rpc: mocks.rpc,
    };
  }),
}));

type ParsedSseEvent = {
  event: string;
  data: Record<string, unknown>;
};

function parseSseEvents(payload: string): ParsedSseEvent[] {
  return payload
    .split("\n\n")
    .map((frame) => frame.trim())
    .filter((frame) => frame.length > 0)
    .map((frame) => {
      const lines = frame.split("\n");
      const event = lines
        .find((line) => line.startsWith("event:"))
        ?.replace("event:", "")
        .trim();
      const dataLine = lines
        .find((line) => line.startsWith("data:"))
        ?.replace("data:", "")
        .trim();
      return {
        event: event ?? "message",
        data: dataLine ? (JSON.parse(dataLine) as Record<string, unknown>) : {},
      };
    });
}

async function postSearch(body: unknown) {
  const { POST } = await import("./route");

  return POST(
    new Request("http://localhost/api/search", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

describe("POST /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SILICONFLOW_API_KEY = "siliconflow-key";
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.DEEPSEEK_API_KEY = "deepseek-key";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_KEY = "supabase-key";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("rejects an empty query before starting the agent", async () => {
    const response = await postSearch({ query: "   " });

    await expect(response.json()).resolves.toEqual({
      error: "A non-empty query string is required.",
    });
    expect(response.status).toBe(400);
    expect(mocks.agentCreate).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("streams lifecycle events, tool telemetry, and the final answer", async () => {
    mocks.rewriteCreate.mockResolvedValue({
      choices: [{ message: { content: "规则 制度 Institutions 产权" } }],
    });
    mocks.embeddingsCreate.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
    });
    mocks.rpc.mockResolvedValue({
      data: [
        {
          id: "chunk-1",
          content: "规则降低交易成本。",
          chapter_title: "制度与合作",
          similarity: 0.91,
          chapter_index: 4,
          chunk_index: 2,
        },
        {
          id: "chunk-2",
          content: "专业化依赖可预期规则。",
          chapter_title: "分工",
          similarity: 0.82,
          chapter_index: 5,
          chunk_index: 1,
        },
      ],
      error: null,
    });
    mocks.agentCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
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
              role: "assistant",
              content: "制度通过降低不确定性促进合作。",
            },
          },
        ],
      });

    const response = await postSearch({ query: "规则如何促进合作？" });
    const raw = await response.text();
    const events = parseSseEvents(raw);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(events.map((event) => event.event)).toEqual([
      "agent_started",
      "tool_call_started",
      "tool_call_result",
      "iteration_summary",
      "model_delta",
      "iteration_summary",
      "agent_finished",
    ]);
    expect(events[2]?.data.results).toMatchObject([
      { id: "chunk-1", chapter_title: "制度与合作", preview: "规则降低交易成本。" },
      { id: "chunk-2", chapter_title: "分工", preview: "专业化依赖可预期规则。" },
    ]);
    expect(JSON.stringify(events[2]?.data.results)).not.toContain("content");
    expect(events[4]?.data.delta).toBe("制度通过降低不确定性促进合作。");
    expect(mocks.rpc).toHaveBeenCalledWith("hybrid_search", {
      query_text: "制度经济学",
      query_embedding: [0.1, 0.2, 0.3],
      match_count: 2,
      book_uuid_param: null,
    });
  });

  it("fails with terminal event when max iterations are exhausted", async () => {
    mocks.rewriteCreate.mockResolvedValue({
      choices: [{ message: { content: "制度 Institutions" } }],
    });
    mocks.embeddingsCreate.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
    });
    mocks.rpc.mockResolvedValue({
      data: [],
      error: null,
    });
    mocks.agentCreate.mockResolvedValue({
      choices: [
        {
          message: {
            role: "assistant",
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
    });

    const response = await postSearch({ query: "制度是什么？" });
    const events = parseSseEvents(await response.text());
    const lastEvent = events[events.length - 1];

    expect(lastEvent?.event).toBe("agent_failed");
    expect(lastEvent?.data.reason).toBe("max_iterations_exceeded");
    expect(mocks.rpc).toHaveBeenCalledTimes(4);
  });
});
