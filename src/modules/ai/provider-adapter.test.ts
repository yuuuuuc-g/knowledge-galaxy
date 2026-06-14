import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AiProviderConfigurationError,
  createAiSdkLanguageModel,
  createOpenAICompatibleClient,
  resolveAiProviderConfig,
} from "./provider-adapter";

const mocks = vi.hoisted(() => ({
  createOpenAI: vi.fn(),
  openAIConstructor: vi.fn(),
  chat: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn((config: unknown) => {
    mocks.createOpenAI(config);
    return {
      chat: (modelId: string) => {
        mocks.chat(modelId);
        return { provider: "mock-openai", modelId };
      },
    };
  }),
}));

vi.mock("openai", () => ({
  default: vi.fn(function OpenAIMock(config: unknown) {
    mocks.openAIConstructor(config);
    return { kind: "mock-openai-client" };
  }),
}));

describe("AI provider adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves provider base URL, API key, default headers, and model override", () => {
    const config = resolveAiProviderConfig("openrouter", {
      env: {
        OPENROUTER_API_KEY: "openrouter-key",
        OPENROUTER_MODEL: "anthropic/claude-sonnet-4.5",
      },
    });

    expect(config).toEqual({
      provider: "openrouter",
      apiKey: "openrouter-key",
      baseURL: "https://openrouter.ai/api/v1",
      defaultModel: "anthropic/claude-sonnet-4.5",
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Exocortex",
      },
    });
  });

  it("raises a typed configuration error when the required key is missing", () => {
    expect(() => resolveAiProviderConfig("deepseek", { env: {} })).toThrow(
      AiProviderConfigurationError
    );
  });

  it("creates OpenAI-compatible clients with provider-specific transport config", () => {
    createOpenAICompatibleClient("gemini", {
      env: { GEMINI_API_KEY: "gemini-key" },
    });

    expect(mocks.openAIConstructor).toHaveBeenCalledWith({
      apiKey: "gemini-key",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      defaultHeaders: undefined,
    });
  });

  it("creates AI SDK language models with the configured default model", () => {
    const model = createAiSdkLanguageModel("kimi", {
      env: { KIMI_API_KEY: "kimi-key" },
    });

    expect(model).toEqual({ provider: "mock-openai", modelId: "moonshot-v1-8k" });
    expect(mocks.createOpenAI).toHaveBeenCalledWith({
      apiKey: "kimi-key",
      baseURL: "https://api.moonshot.cn/v1",
    });
    expect(mocks.chat).toHaveBeenCalledWith("moonshot-v1-8k");
  });
});
