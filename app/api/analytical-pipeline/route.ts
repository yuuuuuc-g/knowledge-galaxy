import type { LanguageModel } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createAiSdkLanguageModel, createOpenAICompatibleClient } from "@/src/modules/ai/provider-adapter";
import { createRagRepository } from "@/src/modules/rag/repository";
import {
  isRefineryPhase,
  runRefineryPhase,
} from "@/src/modules/refinery/phase";

interface RefineryRequestBody {
  prompt?: unknown;
  phase?: unknown;
  topicTitle?: unknown;
  bookUuid?: unknown;
}

const MAX_PROMPT_CHARS = 4_000;
const MAX_TOPIC_TITLE_CHARS = 200;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function getRequiredSupabaseKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY ?? "";
}

async function readRefineryRequest(request: Request): Promise<RefineryRequestBody | null> {
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

export async function POST(request: Request) {
  const body = await readRefineryRequest(request);
  if (!body) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }
  const prompt = body.prompt;
  const phase = isRefineryPhase(body.phase) ? body.phase : "A";
  const topicTitleCandidate = typeof body.topicTitle === "string" ? body.topicTitle.trim() : "";
  if (topicTitleCandidate.length > MAX_TOPIC_TITLE_CHARS) {
    return Response.json(
      { error: `topicTitle must be ${MAX_TOPIC_TITLE_CHARS} characters or fewer.` },
      { status: 413 }
    );
  }
  const topicTitle = topicTitleCandidate.length > 0 ? topicTitleCandidate : undefined;
  const rawBookUuid = body.bookUuid;
  if (rawBookUuid !== undefined && typeof rawBookUuid !== "string") {
    return Response.json({ error: "bookUuid must be a string when provided." }, { status: 400 });
  }
  const bookUuid = typeof rawBookUuid === "string" ? rawBookUuid.trim() : "";
  if (bookUuid.length > 0 && !isUuid(bookUuid)) {
    return Response.json({ error: "bookUuid must be a valid UUID when provided." }, { status: 400 });
  }

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return Response.json({ error: "A non-empty prompt string is required." }, { status: 400 });
  }
  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length > MAX_PROMPT_CHARS) {
    return Response.json(
      { error: `Prompt must be ${MAX_PROMPT_CHARS} characters or fewer.` },
      { status: 413 }
    );
  }

  const supabaseKey = getRequiredSupabaseKey();
  if (!process.env.SILICONFLOW_API_KEY || !process.env.SUPABASE_URL || !supabaseKey) {
    return Response.json(
      { error: "Local knowledge retrieval is not configured." },
      { status: 500 }
    );
  }

  let model: LanguageModel;
  try {
    model = process.env.REFINERY_MODEL === "kimi"
      ? createAiSdkLanguageModel("kimi")
      : createAiSdkLanguageModel("deepseek");
  } catch (error) {
    console.error("[Analytical Pipeline API] missing model configuration:", error);
    return Response.json({ error: "Analytical pipeline model is not configured." }, { status: 500 });
  }

  const embeddingClient = createOpenAICompatibleClient("siliconflow");
  const ragRepository = createRagRepository(createClient(process.env.SUPABASE_URL, supabaseKey));
  const result = runRefineryPhase({
    model,
    prompt: trimmedPrompt,
    phase,
    topicTitle,
    bookUuid,
    embeddingClient,
    ragRepository,
  });

  return result.toTextStreamResponse();
}
