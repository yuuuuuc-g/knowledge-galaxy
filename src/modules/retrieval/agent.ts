import type { EmbeddingClient, SearchResult } from "@/src/lib/local-search";
import { runLocalHybridSearch } from "@/src/lib/local-search";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type {
  RagRepository,
  RagSearchResultCitation,
} from "@/src/modules/rag/repository";

export const QUERY_REWRITE_MODEL = "gemini-1.5-flash";
export const AGENT_MODEL = "deepseek-v4-pro";
export const MATCH_COUNT = 3;
export const MAX_AGENT_ITERATIONS = 4;
export const QUERY_REWRITE_TIMEOUT_MS = 4_000;
export const AGENT_ITERATION_TIMEOUT_MS = 15_000;
export const MAX_QUERY_CHARS = 2_000;

const QUERY_REWRITE_SYSTEM_PROMPT =
  "你是一个专业的经济学与政治哲学搜索引擎的提示词工程师。你的任务是提取用户提问的核心概念，并扩充相关的学术同义词、英文专有名词。请直接输出扩充后的搜索词，不要包含任何解释、标点或聊天废话。例如，用户输入'游戏规则'，你输出'游戏规则 Rules of the game 制度 Institutions 产权'。";
const AGENT_SYSTEM_PROMPT = `你是一个绝对纯粹的本地文献学者。你必须且只能使用 search_knowledge_base 工具来回答问题。
如果工具返回的结果中包含了答案，请严格基于检索到的片段生成回答。
【极度重要】：如果检索工具未能找到相关内容，或者片段不足以回答问题，你绝对不能使用自身的原生大模型知识进行推测或解答！你必须直接输出，且仅输出这句话：'现有资料中没有相关内容。'`;

type AgentSystemMessage = {
  role: "system";
  content: string;
};

type AgentUserMessage = {
  role: "user";
  content: string;
};

type AgentAssistantMessage = {
  role: "assistant";
  content: string;
  tool_calls?: AgentToolCall[];
};

type AgentToolMessage = {
  role: "tool";
  content: string;
  tool_call_id: string;
};

type AgentMessage =
  | AgentSystemMessage
  | AgentUserMessage
  | AgentAssistantMessage
  | AgentToolMessage;

interface AgentToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface SearchKnowledgeBaseToolArgs {
  query?: unknown;
  match_count?: unknown;
}

interface AgentCompletionMessage {
  content?: string | null;
  tool_calls?: unknown;
}

interface AgentCompletionResponse {
  choices: Array<{
    message?: AgentCompletionMessage;
  }>;
}

export interface RetrievalChatClient {
  chat: {
    completions: {
      create(
        input: {
          model: string;
          messages: AgentMessage[];
          tools?: ChatCompletionTool[];
          tool_choice?: "auto";
          temperature?: number;
        },
        options?: { signal?: AbortSignal }
      ): Promise<AgentCompletionResponse>;
    };
  };
}

export type RetrievalAgentEvent =
  | {
      type: "agent_started";
      data: {
        query: string;
        rewrittenQuery: string;
        maxIterations: number;
      };
    }
  | {
      type: "tool_call_started";
      data: {
        iteration: number;
        toolCallId: string;
        toolName: string;
        query: string;
        matchCount: number;
      };
    }
  | {
      type: "tool_call_result";
      data: {
        iteration: number;
        toolCallId: string;
        results: RagSearchResultCitation[];
        retrievedChunks: number;
      };
    }
  | {
      type: "model_delta";
      data: {
        iteration: number;
        delta: string;
      };
    }
  | {
      type: "iteration_summary";
      data: {
        iteration: number;
        toolCallsCount: number;
        retrievedChunks: number;
        latencyMs: number;
        continueReason: "model_requested_tool" | "final_answer";
      };
    }
  | {
      type: "agent_finished";
      data: {
        answer: string;
        results: RagSearchResultCitation[];
        totalIterations: number;
      };
    }
  | {
      type: "agent_failed";
      data: {
        reason: "max_iterations_exceeded" | "runtime_error";
        message: string;
      };
    };

export interface RetrievalAgentConfig {
  maxIterations?: number;
  queryRewriteTimeoutMs?: number;
  agentIterationTimeoutMs?: number;
  matchCount?: number;
}

export interface RunRetrievalAgentInput {
  query: string;
  bookUuid?: string;
  queryRewriteClient: RetrievalChatClient;
  agentClient: RetrievalChatClient;
  embeddingClient: EmbeddingClient;
  ragRepository: Pick<RagRepository, "searchChunks" | "toSearchResultCitations">;
  config?: RetrievalAgentConfig;
  log?: {
    info?(message: string): void;
    error?(context: string, error: unknown): void;
  };
}

interface SearchResponseBody {
  results: SearchResult[];
}

function getConfig(input?: RetrievalAgentConfig): Required<RetrievalAgentConfig> {
  return {
    maxIterations: input?.maxIterations ?? MAX_AGENT_ITERATIONS,
    queryRewriteTimeoutMs: input?.queryRewriteTimeoutMs ?? QUERY_REWRITE_TIMEOUT_MS,
    agentIterationTimeoutMs: input?.agentIterationTimeoutMs ?? AGENT_ITERATION_TIMEOUT_MS,
    matchCount: input?.matchCount ?? MATCH_COUNT,
  };
}

function isAgentToolCall(value: unknown): value is AgentToolCall {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    id?: unknown;
    type?: unknown;
    function?: {
      name?: unknown;
      arguments?: unknown;
    };
  };

  return (
    typeof candidate.id === "string" &&
    candidate.type === "function" &&
    typeof candidate.function?.name === "string" &&
    typeof candidate.function.arguments === "string"
  );
}

function parseHybridSearchToolArgs(
  rawArguments: string,
  maxMatchCount: number
): {
  queryOverride?: string;
  matchCount: number;
} {
  try {
    const parsed = JSON.parse(rawArguments) as SearchKnowledgeBaseToolArgs;
    const matchCountCandidate =
      typeof parsed.match_count === "number" && Number.isFinite(parsed.match_count)
        ? Math.floor(parsed.match_count)
        : maxMatchCount;
    const queryOverride =
      typeof parsed.query === "string" && parsed.query.trim().length > 0
        ? parsed.query.trim()
        : undefined;

    return {
      queryOverride,
      matchCount: Math.min(Math.max(matchCountCandidate, 1), maxMatchCount),
    };
  } catch {
    return { queryOverride: undefined, matchCount: maxMatchCount };
  }
}

function createAbortSignal(timeoutMs: number): {
  signal: AbortSignal;
  clear: () => void;
} {
  const abortController = new AbortController();
  const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
    abortController.abort();
  }, timeoutMs);

  return {
    signal: abortController.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

async function rewriteQuery(
  llmClient: RetrievalChatClient,
  query: string,
  timeoutMs: number
): Promise<string> {
  const abortSignal = createAbortSignal(timeoutMs);

  try {
    const completion = await llmClient.chat.completions.create(
      {
        model: QUERY_REWRITE_MODEL,
        messages: [
          { role: "system", content: QUERY_REWRITE_SYSTEM_PROMPT },
          { role: "user", content: query },
        ],
      },
      { signal: abortSignal.signal }
    );
    const rewritten = completion.choices[0]?.message?.content?.trim();

    return rewritten && rewritten.length > 0 ? rewritten : query;
  } catch {
    return query;
  } finally {
    abortSignal.clear();
  }
}

function buildSearchToolDefinition(): ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description: "Retrieve the top local knowledge chunks from the Supabase hybrid index.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Query text for retrieval.",
          },
          match_count: {
            type: "integer",
            description: "Maximum number of chunks to return (1-3).",
          },
        },
        required: ["query"],
      },
    },
  };
}

export async function* runRetrievalAgent(
  input: RunRetrievalAgentInput
): AsyncGenerator<RetrievalAgentEvent> {
  const config = getConfig(input.config);
  const rewrittenQuery = await rewriteQuery(
    input.queryRewriteClient,
    input.query,
    config.queryRewriteTimeoutMs
  );
  input.log?.info?.(`[Query Rewrite] 原始: ${input.query} -> 扩写: ${rewrittenQuery}`);

  const messages: AgentMessage[] = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    { role: "user", content: input.query },
  ];
  let latestResults: SearchResult[] = [];

  yield {
    type: "agent_started",
    data: {
      query: input.query,
      rewrittenQuery,
      maxIterations: config.maxIterations,
    },
  };

  try {
    for (let iteration = 1; iteration <= config.maxIterations; iteration += 1) {
      const iterationStart = Date.now();
      const abortSignal = createAbortSignal(config.agentIterationTimeoutMs);

      try {
        const completion = await input.agentClient.chat.completions.create(
          {
            model: AGENT_MODEL,
            messages,
            tools: [buildSearchToolDefinition()],
            tool_choice: "auto",
            temperature: 0.2,
          },
          { signal: abortSignal.signal }
        );
        const assistantMessage = completion.choices[0]?.message;
        const toolCalls = Array.isArray(assistantMessage?.tool_calls)
          ? assistantMessage.tool_calls.filter(isAgentToolCall)
          : [];

        messages.push({
          role: "assistant",
          content: typeof assistantMessage?.content === "string" ? assistantMessage.content : "",
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        });

        if (toolCalls.length > 0) {
          for (const toolCall of toolCalls) {
            if (toolCall.function.name !== "search_knowledge_base") {
              continue;
            }

            const parsedArgs = parseHybridSearchToolArgs(toolCall.function.arguments, config.matchCount);
            const queryForTool = parsedArgs.queryOverride ?? rewrittenQuery;
            if (queryForTool.length > MAX_QUERY_CHARS) {
              throw new Error("Tool query exceeded the maximum allowed length.");
            }

            yield {
              type: "tool_call_started",
              data: {
                iteration,
                toolCallId: toolCall.id,
                toolName: toolCall.function.name,
                query: queryForTool,
                matchCount: parsedArgs.matchCount,
              },
            };

            const results = await runLocalHybridSearch({
              repository: input.ragRepository,
              embeddingClient: input.embeddingClient,
              query: queryForTool,
              matchCount: parsedArgs.matchCount,
              bookUuid: input.bookUuid,
            });
            input.log?.info?.(`[Local Search] 成功召回 ${results.length} 个混合匹配切片`);
            latestResults = results;

            yield {
              type: "tool_call_result",
              data: {
                iteration,
                toolCallId: toolCall.id,
                results: input.ragRepository.toSearchResultCitations(results),
                retrievedChunks: results.length,
              },
            };

            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                query: queryForTool,
                results,
              } satisfies SearchResponseBody & { query: string }),
            });
          }

          yield {
            type: "iteration_summary",
            data: {
              iteration,
              toolCallsCount: toolCalls.length,
              retrievedChunks: latestResults.length,
              latencyMs: Date.now() - iterationStart,
              continueReason: "model_requested_tool",
            },
          };
          continue;
        }

        const finalAnswer =
          typeof assistantMessage?.content === "string" ? assistantMessage.content.trim() : "";
        const guardedAnswer = latestResults.length === 0 ? "现有资料中没有相关内容。" : finalAnswer;

        if (guardedAnswer.length > 0) {
          yield {
            type: "model_delta",
            data: { iteration, delta: guardedAnswer },
          };
        }

        yield {
          type: "iteration_summary",
          data: {
            iteration,
            toolCallsCount: 0,
            retrievedChunks: latestResults.length,
            latencyMs: Date.now() - iterationStart,
            continueReason: "final_answer",
          },
        };
        yield {
          type: "agent_finished",
          data: {
            answer: guardedAnswer,
            results: input.ragRepository.toSearchResultCitations(latestResults),
            totalIterations: iteration,
          },
        };
        return;
      } finally {
        abortSignal.clear();
      }
    }

    yield {
      type: "agent_failed",
      data: {
        reason: "max_iterations_exceeded",
        message: "Agent reached the maximum tool loop iterations.",
      },
    };
  } catch (error) {
    input.log?.error?.("stream failed", error);
    yield {
      type: "agent_failed",
      data: {
        reason: "runtime_error",
        message: "Search request failed.",
      },
    };
  }
}
