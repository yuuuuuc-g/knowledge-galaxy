import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/lib/database.types";

export type RagSupabaseClient = SupabaseClient<Database>;
export type RagBook = Database["public"]["Tables"]["rag_books"]["Row"];

export interface RagSearchResult {
  id: string;
  content: string;
  chapter_title: string;
  similarity: number;
  chapter_index: number | null;
  chunk_index: number | null;
}

export interface RagSearchResultCitation {
  id: string;
  chapter_title: string;
  similarity: number;
  chapter_index: number | null;
  chunk_index: number | null;
  preview: string;
}

export interface RagNode {
  id: string;
  chapter_title: string;
  chunk_index: number;
  book_id: string;
}

export interface SearchChunksInput {
  query: string;
  queryEmbedding: number[];
  matchCount: number;
  bookUuid?: string;
}

interface SearchChunksRow {
  id?: unknown;
  content?: unknown;
  chapter_title?: unknown;
  similarity?: unknown;
  chapter_index?: unknown;
  chunk_index?: unknown;
}

interface RagChunkNodeRow {
  id?: unknown;
  chapter_title?: unknown;
  chunk_index?: unknown;
  book_id?: unknown;
}

export class RagRepositoryError extends Error {
  constructor(
    message: string,
    readonly publicMessage: string,
    readonly status = 502
  ) {
    super(message);
    this.name = "RagRepositoryError";
  }
}

function fail(message: string, publicMessage: string, status?: number): never {
  throw new RagRepositoryError(message, publicMessage, status);
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeSearchResult(row: SearchChunksRow): RagSearchResult | null {
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

function isSearchResult(value: RagSearchResult | null): value is RagSearchResult {
  return value !== null;
}

function isNodeData(row: RagChunkNodeRow): row is RagNode {
  return (
    typeof row.id === "string" &&
    typeof row.chapter_title === "string" &&
    typeof row.chunk_index === "number" &&
    Number.isInteger(row.chunk_index) &&
    typeof row.book_id === "string"
  );
}

function toCitationPreview(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length <= 180 ? normalized : `${normalized.slice(0, 177).trim()}...`;
}

export class RagRepository {
  constructor(private readonly supabase: RagSupabaseClient) {}

  async listBooks(): Promise<RagBook[]> {
    const { data, error } = await this.supabase
      .from("rag_books")
      .select("id, title, author, total_chunks, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      fail(error.message, "Unable to load local knowledge books.");
    }

    return data ?? [];
  }

  async listNodes(): Promise<RagNode[]> {
    const { data, error } = await this.supabase
      .from("rag_chunks")
      .select("id, chapter_title, chunk_index, book_id")
      .order("chunk_index", { ascending: true });

    if (error) {
      fail(error.message, "Unable to load local knowledge nodes.");
    }

    return Array.isArray(data) ? (data as RagChunkNodeRow[]).filter(isNodeData) : [];
  }

  async searchChunks(input: SearchChunksInput): Promise<RagSearchResult[]> {
    const { data, error } = await this.supabase.rpc("hybrid_search", {
      query_text: input.query,
      query_embedding: input.queryEmbedding,
      match_count: input.matchCount,
      book_uuid_param: input.bookUuid && input.bookUuid.length > 0 ? input.bookUuid : null,
    });

    if (error) {
      fail(error.message, "Unable to search local knowledge.");
    }

    const rows = Array.isArray(data) ? (data as SearchChunksRow[]) : [];
    return rows.map(normalizeSearchResult).filter(isSearchResult).slice(0, input.matchCount);
  }

  toSearchResultCitations(results: RagSearchResult[]): RagSearchResultCitation[] {
    return results.map((result) => ({
      id: result.id,
      chapter_title: result.chapter_title,
      similarity: result.similarity,
      chapter_index: result.chapter_index,
      chunk_index: result.chunk_index,
      preview: toCitationPreview(result.content),
    }));
  }
}

export function createRagRepository(supabase: RagSupabaseClient): RagRepository {
  return new RagRepository(supabase);
}
