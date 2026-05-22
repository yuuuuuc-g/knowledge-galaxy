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

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
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
    supabaseKey = getRequiredEnv("SUPABASE_KEY");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nodes gateway is not configured.";
    return jsonError(message, 500);
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from("rag_chunks")
      .select("id, chapter_title, chunk_index, book_id")
      .order("chunk_index", { ascending: true });

    if (error) {
      return jsonError(error.message, 502);
    }

    const nodes = Array.isArray(data)
      ? (data as RagChunkNodeRow[]).filter(isNodeData)
      : [];

    return Response.json({ nodes } satisfies NodesResponseBody, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nodes request failed.";
    return jsonError(message, 502);
  }
}
