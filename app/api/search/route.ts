import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { HybridSearchRpcClient, SearchResult, runLocalHybridSearch } from "@/src/lib/local-search";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const QUERY_REWRITE_MODEL = "gemini-1.5-flash";
const AGENT_MODEL = "deepseek-v4-pro";
const MATCH_COUNT = 3;
const MAX_AGENT_ITERATIONS = 4;
const QUERY_REWRITE_TIMEOUT_MS = 4_000;
const AGENT_ITERATION_TIMEOUT_MS = 15_000;
const QUERY_REWRITE_SYSTEM_PROMPT =
  "你是一个专业的经济学与政治哲学搜索引擎的提示词工程师。你的任务是提取用户提问的核心概念，并扩充相关的学术同义词、英文专有名词。请直接输出扩充后的搜索词，不要包含任何解释、标点或聊天废话。例如，用户输入'游戏规则'，你输出'游戏规则 Rules of the game 制度 Institutions 产权'。";
const AGENT_SYSTEM_PROMPT = `你是一个绝对纯粹的本地文献学者。你必须且只能使用 search_knowledge_base 工具来回答问题。
如果工具返回的结果中包含了答案，请严格基于检索到的片段生成回答。
【极度重要】：如果检索工具未能找到相关内容，或者片段不足以回答问题，你绝对不能使用自身的原生大模型知识进行推测或解答！你必须直接输出，且仅输出这句话：'现有资料中没有相关内容。'`;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SearchRequestBody {
  query?: unknown;
  bookUuid?: unknown;
}

interface SearchResponseBody {
  results: SearchResult[];
}

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

function jsonError(message: string, status: number) {
  if (status >= 500) {
    console.error(`\n🚨 [API 致命错误 ${status}]:`, message, "\n");
  } else {
    console.warn(`\n⚠️ [API 警告 ${status}]:`, message, "\n");
  }
  return Response.json({ error: message }, { status });
}

async function readSearchRequest(request: Request): Promise<SearchRequestBody | null> {
  try {
    const body = (await request.json()) as unknown;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }

    return body;
  } catch {
    return null;
  }
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function toSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function parseHybridSearchToolArgs(rawArguments: string): {
  queryOverride?: string;
  matchCount: number;
} {
  try {
    const parsed = JSON.parse(rawArguments) as SearchKnowledgeBaseToolArgs;
    const matchCountCandidate =
      typeof parsed.match_count === "number" && Number.isFinite(parsed.match_count)
        ? Math.floor(parsed.match_count)
        : MATCH_COUNT;
    const queryOverride =
      typeof parsed.query === "string" && parsed.query.trim().length > 0
        ? parsed.query.trim()
        : undefined;
    return {
      queryOverride,
      matchCount: Math.min(Math.max(matchCountCandidate, 1), MATCH_COUNT),
    };
  } catch {
    return { queryOverride: undefined, matchCount: MATCH_COUNT };
  }
}

function logQueryRewrite(originalQuery: string, rewrittenQuery: string): void {
  const colorTag = "\x1b[1;96m";
  const colorOriginal = "\x1b[33m";
  const colorRewrite = "\x1b[32m";
  const reset = "\x1b[0m";

  console.log(
    `${colorTag}[Query Rewrite]${reset} 原始: ${colorOriginal}${originalQuery}${reset} -> 扩写: ${colorRewrite}${rewrittenQuery}${reset}`
  );
}

async function rewriteQuery(llmClient: OpenAI, query: string): Promise<string> {
  const abortController = new AbortController();
  const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
    abortController.abort();
  }, QUERY_REWRITE_TIMEOUT_MS);

  try {
    const completion = await llmClient.chat.completions.create(
      {
        model: QUERY_REWRITE_MODEL,
        messages: [
          { role: "system", content: QUERY_REWRITE_SYSTEM_PROMPT },
          { role: "user", content: query },
        ],
      },
      { signal: abortController.signal }
    );
    const rewritten = completion.choices[0]?.message?.content?.trim();

    return rewritten && rewritten.length > 0 ? rewritten : query;
  } catch {
    return query;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: Request) {
  const body = await readSearchRequest(request);
  const { query: rawQuery, bookUuid: rawBookUuid } = body ?? {};
  const query = typeof rawQuery === "string" ? rawQuery.trim() : "";

  if (!query) {
    return jsonError("A non-empty query string is required.", 400);
  }

  if (rawBookUuid !== undefined && typeof rawBookUuid !== "string") {
    return jsonError("bookUuid must be a string when provided.", 400);
  }

  const bookUuid = typeof rawBookUuid === "string" ? rawBookUuid.trim() : "";

  if (bookUuid.length > 0 && !isUuid(bookUuid)) {
    return jsonError("bookUuid must be a valid UUID when provided.", 400);
  }

  let siliconFlowApiKey: string;
  let geminiApiKey: string;
  let deepSeekApiKey: string;
  let supabaseUrl: string;
  let supabaseKey: string;

  try {
    siliconFlowApiKey = getRequiredEnv("SILICONFLOW_API_KEY");
    geminiApiKey = getRequiredEnv("GEMINI_API_KEY");
    deepSeekApiKey = getRequiredEnv("DEEPSEEK_API_KEY");
    supabaseUrl = getRequiredEnv("SUPABASE_URL");
    supabaseKey = getRequiredEnv("SUPABASE_KEY");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search gateway is not configured.";
    return jsonError(message, 500);
  }

  try {
    const llmClient = new OpenAI({
      apiKey: geminiApiKey,
      baseURL: GEMINI_BASE_URL,
    });
    const embeddingClient = new OpenAI({
      apiKey: siliconFlowApiKey,
      baseURL: SILICONFLOW_BASE_URL,
    });
    const agentClient = new OpenAI({
      apiKey: deepSeekApiKey,
      baseURL: DEEPSEEK_BASE_URL,
    });
    const supabase = createClient(supabaseUrl, supabaseKey) as unknown as HybridSearchRpcClient;
    const rewrittenQuery = await rewriteQuery(llmClient, query);
    logQueryRewrite(query, rewrittenQuery);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const sendEvent = (eventName: string, payload: unknown): void => {
          controller.enqueue(encoder.encode(toSseEvent(eventName, payload)));
        };

        const messages: AgentMessage[] = [
          { role: "system", content: AGENT_SYSTEM_PROMPT },
          { role: "user", content: query },
        ];
        let latestResults: SearchResult[] = [];

        try {
          sendEvent("agent_started", {
            query,
            rewrittenQuery,
            maxIterations: MAX_AGENT_ITERATIONS,
          });

          for (let iteration = 1; iteration <= MAX_AGENT_ITERATIONS; iteration += 1) {
            const iterationStart = Date.now();
            const abortController = new AbortController();
            const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
              abortController.abort();
            }, AGENT_ITERATION_TIMEOUT_MS);

            try {
              const completion = await agentClient.chat.completions.create(
                {
                  model: AGENT_MODEL,
                  messages,
                  tools: [
                    {
                      type: "function",
                      function: {
                        name: "search_knowledge_base",
                        description:
                          "Retrieve the top local knowledge chunks from the Supabase hybrid index.",
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
                    },
                  ],
                  tool_choice: "auto",
                  temperature: 0.2,
                },
                { signal: abortController.signal }
              );
              const assistantMessage = completion.choices[0]?.message;
              const toolCalls = Array.isArray(assistantMessage?.tool_calls)
                ? (assistantMessage.tool_calls as AgentToolCall[])
                : [];

              messages.push({
                role: "assistant",
                content: typeof assistantMessage?.content === "string" ? assistantMessage.content : "",
                tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
              });

              if (toolCalls.length > 0) {
                for (const toolCall of toolCalls) {
                  if (
                    toolCall.type !== "function" ||
                    toolCall.function.name !== "search_knowledge_base"
                  ) {
                    continue;
                  }

                  const parsedArgs = parseHybridSearchToolArgs(toolCall.function.arguments);
                  const queryForTool = parsedArgs.queryOverride ?? rewrittenQuery;

                  sendEvent("tool_call_started", {
                    iteration,
                    toolCallId: toolCall.id,
                    toolName: toolCall.function.name,
                    query: queryForTool,
                    matchCount: parsedArgs.matchCount,
                  });

                  const results = await runLocalHybridSearch({
                    supabase,
                    embeddingClient,
                    query: queryForTool,
                    matchCount: parsedArgs.matchCount,
                    bookUuid,
                  });
                  console.log(`[Local Search] 成功召回 ${results.length} 个混合匹配切片`);
                  latestResults = results;

                  sendEvent("tool_call_result", {
                    iteration,
                    toolCallId: toolCall.id,
                    results,
                    retrievedChunks: results.length,
                  });

                  messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({
                      query: queryForTool,
                      results,
                    } satisfies SearchResponseBody & { query: string }),
                  });
                }

                sendEvent("iteration_summary", {
                  iteration,
                  toolCallsCount: toolCalls.length,
                  retrievedChunks: latestResults.length,
                  latencyMs: Date.now() - iterationStart,
                  continueReason: "model_requested_tool",
                });
                continue;
              }

              const finalAnswer =
                typeof assistantMessage?.content === "string" ? assistantMessage.content.trim() : "";
              const guardedAnswer =
                latestResults.length === 0 ? "现有资料中没有相关内容。" : finalAnswer;

              if (guardedAnswer.length > 0) {
                sendEvent("model_delta", { iteration, delta: guardedAnswer });
              }

              sendEvent("iteration_summary", {
                iteration,
                toolCallsCount: 0,
                retrievedChunks: latestResults.length,
                latencyMs: Date.now() - iterationStart,
                continueReason: "final_answer",
              });
              sendEvent("agent_finished", {
                answer: guardedAnswer,
                results: latestResults,
                totalIterations: iteration,
              });
              controller.close();
              return;
            } finally {
              clearTimeout(timeoutId);
            }
          }

          sendEvent("agent_failed", {
            reason: "max_iterations_exceeded",
            message: "Agent reached the maximum tool loop iterations.",
          });
          controller.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Search request failed.";
          sendEvent("agent_failed", {
            reason: "runtime_error",
            message,
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
      },
      status: 200,
    });
  } catch (error) {
    console.error("\n🚨 [代码层崩溃捕获]:", error, "\n"); // ✨ 新增错误堆栈打印
    const message = error instanceof Error ? error.message : "Search request failed.";
    return jsonError(message, 500);
  }
}
