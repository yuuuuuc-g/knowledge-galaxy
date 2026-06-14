import { NextResponse } from "next/server";
import type { Json } from "@/src/lib/database.types";
import { createSupabaseAdmin } from "@/src/lib/supabase/admin";
import {
  ArchiveRepositoryError,
  createArchiveRepository,
} from "@/src/modules/archive/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONTENT_CHARS = 80_000;
const MAX_SOURCE_TEXT_CHARS = 4_000;

interface PersistArchiveBody {
  content?: unknown;
  sourceText?: unknown;
  selectedTopicId?: unknown;
  phases?: unknown;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(
    value
  );
}

function isJsonObject(value: unknown): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readBody(request: Request): Promise<PersistArchiveBody | null> {
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
  const body = await readBody(request);
  if (!body) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  const sourceText = typeof body.sourceText === "string" ? body.sourceText.trim() : "";
  const selectedTopicId = typeof body.selectedTopicId === "string" ? body.selectedTopicId.trim() : "";
  const phases = isJsonObject(body.phases) ? body.phases : {};

  if (!content) {
    return NextResponse.json({ error: "Content is required." }, { status: 400 });
  }
  if (content.length > MAX_CONTENT_CHARS) {
    return NextResponse.json(
      { error: `Content must be ${MAX_CONTENT_CHARS} characters or fewer.` },
      { status: 413 }
    );
  }
  if (!sourceText) {
    return NextResponse.json({ error: "sourceText is required." }, { status: 400 });
  }
  if (sourceText.length > MAX_SOURCE_TEXT_CHARS) {
    return NextResponse.json(
      { error: `sourceText must be ${MAX_SOURCE_TEXT_CHARS} characters or fewer.` },
      { status: 413 }
    );
  }
  if (selectedTopicId && !isUuid(selectedTopicId)) {
    return NextResponse.json({ error: "selectedTopicId must be a valid UUID." }, { status: 400 });
  }

  try {
    const repository = createArchiveRepository(createSupabaseAdmin());
    const result = await repository.persistAnalyticalArchive({
      content,
      sourceText,
      selectedTopicId: selectedTopicId || undefined,
      phases,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ArchiveRepositoryError) {
      console.error("[Analytical Archive API] repository failed:", error.message);
      return NextResponse.json({ error: error.publicMessage }, { status: error.status });
    }
    console.error("[Analytical Archive API] request failed:", error);
    return NextResponse.json({ error: "Analytical archive gateway is not configured." }, { status: 500 });
  }
}
