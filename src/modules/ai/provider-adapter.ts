import { createOpenAI } from "@ai-sdk/openai";
import OpenAI from "openai";
import type { LanguageModel } from "ai";

export type AiProviderId = "deepseek" | "gemini" | "kimi" | "openrouter" | "siliconflow";

interface AiProviderDefinition {
  apiKeyEnv: string;
  baseURL: string;
  defaultModel: string;
  modelEnv?: string;
  defaultHeaders?: Record<string, string>;
}

export interface AiProviderConfig {
  provider: AiProviderId;
  apiKey: string;
  baseURL: string;
  defaultModel: string;
  defaultHeaders?: Record<string, string>;
}

export interface AiProviderAdapterOptions {
  env?: Readonly<Record<string, string | undefined>>;
}

export interface AiLanguageModelOptions extends AiProviderAdapterOptions {
  modelId?: string;
}

export class AiProviderConfigurationError extends Error {
  constructor(provider: AiProviderId, envName: string) {
    super(`Missing ${envName} for ${provider} AI provider.`);
    this.name = "AiProviderConfigurationError";
  }
}

const PROVIDERS: Record<AiProviderId, AiProviderDefinition> = {
  deepseek: {
    apiKeyEnv: "DEEPSEEK_API_KEY",
    baseURL: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-v4-pro",
    modelEnv: "DEEPSEEK_MODEL",
  },
  gemini: {
    apiKeyEnv: "GEMINI_API_KEY",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultModel: "gemini-1.5-flash",
    modelEnv: "GEMINI_MODEL",
  },
  kimi: {
    apiKeyEnv: "KIMI_API_KEY",
    baseURL: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    modelEnv: "KIMI_MODEL",
  },
  openrouter: {
    apiKeyEnv: "OPENROUTER_API_KEY",
    baseURL: "https://openrouter.ai/api/v1",
    defaultModel: "qwen/qwen-2.5-72b-instruct",
    modelEnv: "OPENROUTER_MODEL",
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Exocortex",
    },
  },
  siliconflow: {
    apiKeyEnv: "SILICONFLOW_API_KEY",
    baseURL: "https://api.siliconflow.cn/v1",
    defaultModel: "BAAI/bge-m3",
    modelEnv: "SILICONFLOW_EMBEDDING_MODEL",
  },
};

export function resolveAiProviderConfig(
  provider: AiProviderId,
  options: AiProviderAdapterOptions = {}
): AiProviderConfig {
  const env = options.env ?? process.env;
  const definition = PROVIDERS[provider];
  const apiKey = env[definition.apiKeyEnv];

  if (!apiKey) {
    throw new AiProviderConfigurationError(provider, definition.apiKeyEnv);
  }

  const modelOverride = definition.modelEnv ? env[definition.modelEnv] : undefined;

  return {
    provider,
    apiKey,
    baseURL: definition.baseURL,
    defaultModel: modelOverride ?? definition.defaultModel,
    defaultHeaders: definition.defaultHeaders,
  };
}

export function createOpenAICompatibleClient(
  provider: AiProviderId,
  options: AiProviderAdapterOptions = {}
): OpenAI {
  const config = resolveAiProviderConfig(provider, options);

  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    defaultHeaders: config.defaultHeaders,
  });
}

export function createAiSdkLanguageModel(
  provider: AiProviderId,
  options: AiLanguageModelOptions = {}
): LanguageModel {
  const config = resolveAiProviderConfig(provider, options);
  const openaiProvider = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  return openaiProvider.chat(options.modelId ?? config.defaultModel);
}
