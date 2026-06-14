import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface NodeData {
  id: string;
  chapter_title: string;
  chunk_index: number;
  book_id: string;
}

export type NodesData = NodeData[];

interface NodesResponseBody {
  nodes: NodesData;
}

interface RagChunkNodeRow {
  id?: unknown;
  chapter_title?: unknown;
  chunk_index?: unknown;
  book_id?: unknown;
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function logServerError(context: string, error: unknown) {
  console.error(`[Nodes API] ${context}:`, error);
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

function isNodeData(row: RagChunkNodeRow): row is NodeData {
  return (
    typeof row.id === "string" &&
    typeof row.chapter_title === "string" &&
    typeof row.chunk_index === "number" &&
    Number.isInteger(row.chunk_index) &&
    typeof row.book_id === "string"
  );
}

export async function GET() {
  let supabaseUrl: string;
  let supabaseKey: string;

  try {
    supabaseUrl = getRequiredEnv("SUPABASE_URL");
    supabaseKey = getRequiredSupabaseKey();
  } catch (error) {
    logServerError("missing configuration", error);
    return jsonError("Nodes gateway is not configured.", 500);
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from("rag_chunks")
      .select("id, chapter_title, chunk_index, book_id")
      .order("chunk_index", { ascending: true });

    if (error) {
      logServerError("Supabase query failed", error);
      return jsonError("Nodes request failed.", 502);
    }

    const nodes = Array.isArray(data)
      ? (data as RagChunkNodeRow[]).filter(isNodeData)
      : [];

    return Response.json({ nodes } satisfies NodesResponseBody, { status: 200 });
  } catch (error) {
    logServerError("request failed", error);
    return jsonError("Nodes request failed.", 502);
  }
}
