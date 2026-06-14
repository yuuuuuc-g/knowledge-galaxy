import { createClient } from "@supabase/supabase-js";
import { createOpenAICompatibleClient } from "@/src/modules/ai/provider-adapter";
import { createRagRepository } from "@/src/modules/rag/repository";
import { MAX_QUERY_CHARS, runRetrievalAgent } from "@/src/modules/retrieval/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SearchRequestBody {
  query?: unknown;
  bookUuid?: unknown;
}

function jsonError(message: string, status: number) {
  if (status >= 500) {
    console.error(`\n🚨 [API 致命错误 ${status}]:`, message, "\n");
  } else {
    console.warn(`\n⚠️ [API 警告 ${status}]:`, message, "\n");
  }
  return Response.json({ error: message }, { status });
}

function logServerError(context: string, error: unknown): void {
  console.error(`[Search API] ${context}:`, error);
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

function getRequiredSupabaseKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? getRequiredEnv("SUPABASE_KEY");
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function toSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const body = await readSearchRequest(request);
  const { query: rawQuery, bookUuid: rawBookUuid } = body ?? {};
  const query = typeof rawQuery === "string" ? rawQuery.trim() : "";

  if (!query) {
    return jsonError("A non-empty query string is required.", 400);
  }
  if (query.length > MAX_QUERY_CHARS) {
    return jsonError(`Query must be ${MAX_QUERY_CHARS} characters or fewer.`, 413);
  }

  if (rawBookUuid !== undefined && typeof rawBookUuid !== "string") {
    return jsonError("bookUuid must be a string when provided.", 400);
  }

  const bookUuid = typeof rawBookUuid === "string" ? rawBookUuid.trim() : "";

  if (bookUuid.length > 0 && !isUuid(bookUuid)) {
    return jsonError("bookUuid must be a valid UUID when provided.", 400);
  }

  let supabaseUrl: string;
  let supabaseKey: string;
  let llmClient: ReturnType<typeof createOpenAICompatibleClient>;
  let embeddingClient: ReturnType<typeof createOpenAICompatibleClient>;
  let agentClient: ReturnType<typeof createOpenAICompatibleClient>;

  try {
    supabaseUrl = getRequiredEnv("SUPABASE_URL");
    supabaseKey = getRequiredSupabaseKey();
    llmClient = createOpenAICompatibleClient("gemini");
    embeddingClient = createOpenAICompatibleClient("siliconflow");
    agentClient = createOpenAICompatibleClient("deepseek");
  } catch (error) {
    logServerError("missing configuration", error);
    return jsonError("Search gateway is not configured.", 500);
  }

  try {
    const ragRepository = createRagRepository(createClient(supabaseUrl, supabaseKey));
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const sendEvent = (eventName: string, payload: unknown): void => {
          controller.enqueue(encoder.encode(toSseEvent(eventName, payload)));
        };

        for await (const event of runRetrievalAgent({
          query,
          bookUuid,
          queryRewriteClient: llmClient,
          agentClient,
          embeddingClient,
          ragRepository,
          log: {
            info: (message) => console.log(message),
            error: logServerError,
          },
        })) {
          sendEvent(event.type, event.data);
        }
        controller.close();
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
    logServerError("request failed", error);
    return jsonError("Search request failed.", 500);
  }
}
