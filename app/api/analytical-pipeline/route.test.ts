import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createOpenAI: vi.fn(),
  streamText: vi.fn(),
  tool: vi.fn(),
  stepCountIs: vi.fn(),
  openAIConstructor: vi.fn(),
  createClient: vi.fn(),
  runLocalHybridSearch: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn((config: unknown) => {
    mocks.createOpenAI(config);
    return {
      chat: (modelId: string) => ({ provider: "mock-provider", modelId }),
    };
  }),
}));

vi.mock("ai", () => ({
  streamText: vi.fn((options: unknown) => {
    mocks.streamText(options);
    return {
      toTextStreamResponse: () =>
        new Response("mock-stream", {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }),
    };
  }),
  tool: vi.fn((definition: unknown) => {
    mocks.tool(definition);
    return definition;
  }),
  stepCountIs: vi.fn((count: number) => {
    mocks.stepCountIs(count);
    return { __kind: "stepCountIs", count };
  }),
}));

vi.mock("openai", () => ({
  default: vi.fn(function OpenAIMock(config: unknown) {
    mocks.openAIConstructor(config);
    return {
      embeddings: {
        create: vi.fn(),
      },
    };
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn((url: string, key: string) => {
    mocks.createClient(url, key);
    return { rpc: vi.fn() };
  }),
}));

vi.mock("@/src/lib/local-search", () => ({
  runLocalHybridSearch: vi.fn((...args: unknown[]) => mocks.runLocalHybridSearch(...args)),
}));

async function postAnalyticalPipeline(body: unknown) {
  const { POST } = await import("./route");

  return POST(
    new Request("http://localhost/api/analytical-pipeline", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/analytical-pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.DEEPSEEK_API_KEY = "deepseek-key";
    process.env.KIMI_API_KEY = "kimi-key";
    process.env.SILICONFLOW_API_KEY = "siliconflow-key";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_KEY = "supabase-key";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.REFINERY_MODEL;
  });

  it("A: phase C uses auto toolChoice and embeds extreme tool-calling sentinel in system prompt", async () => {
    const response = await postAnalyticalPipeline({
      prompt: "请做一期制度分析简报",
      phase: "C",
    });

    expect(response.status).toBe(200);
    expect(mocks.runLocalHybridSearch).not.toHaveBeenCalled();
    expect(mocks.streamText).toHaveBeenCalledTimes(1);

    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      prompt: string;
      system: string;
      toolChoice: { type: string; toolName: string } | string;
      stopWhen: { __kind: string; count: number };
      tools: Record<string, unknown>;
    };
    expect(streamOptions.system).toContain("你是一个顶级的跨国政经商业智库引擎");
    expect(streamOptions.system).toContain(
      "如果本地无记录，才允许使用原生知识 Fallback"
    );
    expect(streamOptions.system).toContain("最高级系统指令：绝对动作前置");
    expect(streamOptions.system).toContain("必须、必须、必须");
    expect(streamOptions.system).toContain("search_local_knowledge_base");
    expect(streamOptions.prompt).toBe("请做一期制度分析简报");
    expect(streamOptions.stopWhen).toEqual({ __kind: "stepCountIs", count: 5 });
    expect(mocks.stepCountIs).toHaveBeenCalledWith(5);
    expect(streamOptions.toolChoice).toBe("auto");
    expect(Object.keys(streamOptions.tools)).toContain("search_local_knowledge_base");
  });

  it("B: non-phase-C uses auto toolChoice and tool execute supports fallback signal", async () => {
    const response = await postAnalyticalPipeline({
      prompt: "请做一期货币政策争议分析",
      phase: "A",
    });

    expect(response.status).toBe(200);
    expect(mocks.runLocalHybridSearch).not.toHaveBeenCalled();
    expect(mocks.streamText).toHaveBeenCalledTimes(1);

    const streamOptions = mocks.streamText.mock.calls[0][0] as {
      prompt: string;
      model: unknown;
      stopWhen: { __kind: string; count: number };
      toolChoice: string;
      tools: {
        search_local_knowledge_base: {
          execute: (input: { query: string; match_count?: number }) => Promise<{
            query: string;
            results: unknown[];
            retrievedChunks: number;
            hasLocalEvidence: boolean;
          }>;
        };
      };
    };
    expect(streamOptions.prompt).toBe("请做一期货币政策争议分析");
    expect(streamOptions.model).toBeTruthy();
    expect(streamOptions.stopWhen).toEqual({ __kind: "stepCountIs", count: 5 });
    expect(streamOptions.toolChoice).toBe("auto");

    mocks.runLocalHybridSearch.mockResolvedValueOnce([]);
    const fallbackResult = await streamOptions.tools.search_local_knowledge_base.execute({
      query: "货币政策",
      match_count: 2,
    });
    expect(mocks.runLocalHybridSearch).toHaveBeenCalledTimes(1);
    expect(fallbackResult.hasLocalEvidence).toBe(false);

    mocks.runLocalHybridSearch.mockResolvedValueOnce([
      {
        id: "chunk-1",
        content: "索维尔强调激励机制与制度约束。",
        chapter_title: "制度与激励",
        similarity: 0.9,
        chapter_index: 1,
        chunk_index: 1,
      },
    ]);
    const evidenceResult = await streamOptions.tools.search_local_knowledge_base.execute({
      query: "制度与激励",
    });
    expect(mocks.runLocalHybridSearch).toHaveBeenCalledTimes(2);
    expect(evidenceResult.hasLocalEvidence).toBe(true);
  });

  it("C: phase C runtime path triggers local search when LLM voluntarily calls tool (auto toolChoice)", async () => {
    mocks.runLocalHybridSearch.mockResolvedValueOnce([
      {
        id: "chunk-c1",
        content: "政治秩序依赖制度约束与激励兼容。",
        chapter_title: "政治秩序与制度",
        similarity: 0.88,
        chapter_index: 3,
        chunk_index: 2,
      },
    ]);

    let toolExecutionPromise: Promise<unknown> = Promise.resolve();
    mocks.streamText.mockImplementationOnce((options: unknown) => {
      const typedOptions = options as {
        tools: {
          search_local_knowledge_base: {
            execute: (input: { query: string; match_count?: number }) => Promise<unknown>;
          };
        };
        toolChoice: string;
      };
      mocks.streamText(options);

      expect(typedOptions.toolChoice).toBe("auto");
      toolExecutionPromise = typedOptions.tools.search_local_knowledge_base.execute({
        query: "政治秩序 制度 激励",
        match_count: 1,
      });

      return {
        toTextStreamResponse: () =>
          new Response("mock-stream", {
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          }),
      };
    });

    const response = await postAnalyticalPipeline({
      prompt: "请提炼一个政治学关键词切口",
      phase: "C",
    });
    await toolExecutionPromise;

    expect(response.status).toBe(200);
    expect(mocks.runLocalHybridSearch).toHaveBeenCalledTimes(1);
    expect(mocks.runLocalHybridSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "政治秩序 制度 激励",
        matchCount: 1,
      })
    );
  });
});
