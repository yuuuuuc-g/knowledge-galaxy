import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const QUERY_REWRITE_MODEL = "openai/gpt-4o-mini";
const MATCH_COUNT = 3;
const QUERY_REWRITE_TIMEOUT_MS = 4_000;
const QUERY_REWRITE_SYSTEM_PROMPT =
  "你是一个专业的经济学与政治哲学搜索引擎的提示词工程师。你的任务是提取用户提问的核心概念，并扩充相关的学术同义词、英文专有名词。请直接输出扩充后的搜索词，不要包含任何解释、标点或聊天废话。例如，用户输入'游戏规则'，你输出'游戏规则 Rules of the game 制度 Institutions 产权'。";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface SearchResult {
  id: string;
  content: string;
  chapter_title: string;
  similarity: number;
  chapter_index: number | null;
  chunk_index: number | null;
}

interface SearchRequestBody {
  query?: unknown;
  bookUuid?: unknown;
}

interface SearchResponseBody {
  results: SearchResult[];
}

interface SearchChunksRow {
  id?: unknown;
  content?: unknown;
  chapter_title?: unknown;
  similarity?: unknown;
  chapter_index?: unknown;
  chunk_index?: unknown;
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

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function normalizeSearchResult(row: SearchChunksRow): SearchResult | null {
  if (typeof row.id !== "string") {
    return null;
  }

  return {
    id: row.id,
    content: typeof row.content === "string" ? row.content : "",
    chapter_title: typeof row.chapter_title === "string" ? row.chapter_title : "Unknown Chapter",
    similarity: nullableNumber(row.similarity) ?? 0,
    chapter_index: nullableNumber(row.chapter_index),
    chunk_index: nullableNumber(row.chunk_index),
  };
}

function isSearchResult(value: SearchResult | null): value is SearchResult {
  return value !== null;
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

async function rewriteQuery(openai: OpenAI, query: string): Promise<string> {
  const abortController = new AbortController();
  const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
    abortController.abort();
  }, QUERY_REWRITE_TIMEOUT_MS);

  try {
    const completion = await openai.chat.completions.create(
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

  let openrouterApiKey: string;
  let supabaseUrl: string;
  let supabaseKey: string;

  try {
    openrouterApiKey = getRequiredEnv("OPENROUTER_API_KEY");
    supabaseUrl = getRequiredEnv("SUPABASE_URL");
    supabaseKey = getRequiredEnv("SUPABASE_KEY");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search gateway is not configured.";
    return jsonError(message, 500);
  }

  try {
    const openai = new OpenAI({
      apiKey: openrouterApiKey,
      baseURL: OPENROUTER_BASE_URL,
    });
    const supabase = createClient(supabaseUrl, supabaseKey);
    const rewrittenQuery = await rewriteQuery(openai, query);
    logQueryRewrite(query, rewrittenQuery);

    const embeddingResponse = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: rewrittenQuery,
    });
    const queryEmbedding = embeddingResponse.data[0]?.embedding;

    if (!queryEmbedding) {
      return jsonError("Embedding provider returned no vector.", 500);
    }

    const { data, error } = await supabase.rpc("hybrid_search", {
      query_text: rewrittenQuery,
      query_embedding: queryEmbedding,
      match_count: MATCH_COUNT,
      book_uuid_param: bookUuid || null,
    });

    if (error) {
      return jsonError(error.message, 500);
    }

    const rows = Array.isArray(data) ? (data as SearchChunksRow[]) : [];
    console.log(`[Hybrid Search] 成功召回 ${rows.length} 个混合匹配切片`);
    const results = rows.map(normalizeSearchResult).filter(isSearchResult).slice(0, MATCH_COUNT);

    return Response.json({ results } satisfies SearchResponseBody, { status: 200 });
  } catch (error) {
    console.error("\n🚨 [代码层崩溃捕获]:", error, "\n"); // ✨ 新增错误堆栈打印
    const message = error instanceof Error ? error.message : "Search request failed.";
    return jsonError(message, 500);
  }
}
