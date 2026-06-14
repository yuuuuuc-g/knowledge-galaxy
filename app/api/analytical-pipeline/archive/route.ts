import { NextResponse } from "next/server";
import type { Json } from "@/src/lib/database.types";
import { createSupabaseAdmin } from "@/src/lib/supabase/admin";

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
    const supabase = createSupabaseAdmin();

    if (selectedTopicId) {
      const { data: existingDoc, error: fetchError } = await supabase
        .from("documents")
        .select("id, content_markdown")
        .eq("topic_id", selectedTopicId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error("[Analytical Archive API] fetch document failed:", fetchError);
        return NextResponse.json({ error: "Unable to load topic document." }, { status: 502 });
      }

      if (!existingDoc) {
        return NextResponse.json(
          { error: "No existing document found for the selected topic." },
          { status: 404 }
        );
      }

      const updatedContent = `${existingDoc.content_markdown}\n\n---\n\n${content}`;
      const { data: document, error: updateError } = await supabase
        .from("documents")
        .update({ content_markdown: updatedContent })
        .eq("id", existingDoc.id)
        .eq("topic_id", selectedTopicId)
        .select()
        .single();

      if (updateError) {
        console.error("[Analytical Archive API] update document failed:", updateError);
        return NextResponse.json({ error: "Unable to update topic document." }, { status: 502 });
      }

      const { error: sessionError } = await supabase.from("analytical_sessions").insert({
        document_id: existingDoc.id,
        source_issue: sourceText,
        phases,
      });

      if (sessionError) {
        console.error("[Analytical Archive API] insert session failed:", sessionError);
        return NextResponse.json({ error: "Unable to record analytical session." }, { status: 502 });
      }

      return NextResponse.json({ document, topic: null, mode: "append" });
    }

    const topicTitle = sourceText.slice(0, 100) || "Untitled Topic";
    const { data: topic, error: topicError } = await supabase
      .from("topics")
      .insert({ title: topicTitle, description: null })
      .select()
      .single();

    if (topicError || !topic) {
      console.error("[Analytical Archive API] insert topic failed:", topicError);
      return NextResponse.json({ error: "Unable to create topic." }, { status: 502 });
    }

    const { data: document, error: docError } = await supabase
      .from("documents")
      .insert({
        title: sourceText.slice(0, 50) || "Untitled Analysis",
        content_markdown: content,
        source_module: "analytical-pipeline",
        topic_id: topic.id,
      })
      .select()
      .single();

    if (docError || !document) {
      console.error("[Analytical Archive API] insert document failed:", docError);
      return NextResponse.json({ error: "Unable to create archive document." }, { status: 502 });
    }

    const { error: sessionError } = await supabase.from("analytical_sessions").insert({
      document_id: document.id,
      source_issue: sourceText,
      phases,
    });

    if (sessionError) {
      console.error("[Analytical Archive API] insert session failed:", sessionError);
      return NextResponse.json({ error: "Unable to record analytical session." }, { status: 502 });
    }

    return NextResponse.json({ document, topic, mode: "create" });
  } catch (error) {
    console.error("[Analytical Archive API] request failed:", error);
    return NextResponse.json({ error: "Analytical archive gateway is not configured." }, { status: 500 });
  }
}
