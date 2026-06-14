import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  chatCreate: vi.fn(),
  openAIConstructor: vi.fn(),
}));

vi.mock("openai", () => ({
  default: vi.fn(function OpenAIMock(config: unknown) {
    mocks.openAIConstructor(config);

    return {
      chat: {
        completions: {
          create: mocks.chatCreate,
        },
      },
    };
  }),
}));

async function postChat(body: unknown) {
  const { POST } = await import("./route");

  return POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

async function* streamParts(parts: string[]) {
  for (const part of parts) {
    yield {
      choices: [
        {
          delta: {
            content: part,
          },
        },
      ],
    };
  }
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = "openrouter-key";
  });

  it("rejects an empty query before calling OpenRouter", async () => {
    const response = await postChat({
      query: " ",
      references: [{ content: "参考资料" }],
    });

    await expect(response.json()).resolves.toEqual({
      error: "A non-empty query string is required.",
    });
    expect(response.status).toBe(400);
    expect(mocks.chatCreate).not.toHaveBeenCalled();
  });

  it("streams a grounded answer from OpenRouter using the supplied references", async () => {
    mocks.chatCreate.mockResolvedValue(streamParts(["制度", "降低", "交易成本"]));

    const response = await postChat({
      query: "规则如何促进合作？",
      references: [
        { content: "规则让行动者形成稳定预期。" },
        { content: "产权边界降低冲突。" },
        { content: "分工依赖可预期的游戏规则。" },
        { content: "第四条不应进入 prompt。" },
      ],
    });

    await expect(response.text()).resolves.toBe("制度降低交易成本");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(mocks.openAIConstructor).toHaveBeenCalledWith({
      apiKey: "openrouter-key",
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Exocortex",
      },
    });
    expect(mocks.chatCreate).toHaveBeenCalledWith({
      model: "qwen/qwen-2.5-72b-instruct",
      messages: [
        {
          role: "system",
          content: expect.stringContaining(
            "你是一个严肃的经济学外脑。请严格基于以下检索到的参考资料回答用户问题。不要捏造资料中没有的信息。"
          ),
        },
        {
          role: "user",
          content: "规则如何促进合作？",
        },
      ],
      stream: true,
      temperature: 0.2,
    });
    const systemPrompt = mocks.chatCreate.mock.calls[0][0].messages[0].content;
    expect(systemPrompt).toContain("规则让行动者形成稳定预期。");
    expect(systemPrompt).toContain("产权边界降低冲突。");
    expect(systemPrompt).toContain("分工依赖可预期的游戏规则。");
    expect(systemPrompt).not.toContain("第四条不应进入 prompt。");
  });
});
