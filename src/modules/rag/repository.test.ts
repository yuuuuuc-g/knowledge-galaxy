import { describe, expect, it, vi } from "vitest";
import {
  RagRepository,
  type RagBook,
  type RagSupabaseClient,
} from "./repository";

function asClient(client: Partial<RagSupabaseClient>): RagSupabaseClient {
  return client as RagSupabaseClient;
}

const book: RagBook = {
  id: "book-1",
  title: "The Constitution of Liberty",
  author: "F. A. Hayek",
  total_chunks: 42,
  created_at: "2026-06-14T00:00:00.000Z",
  updated_at: "2026-06-14T00:00:00.000Z",
};

describe("RagRepository", () => {
  it("runs hybrid search and returns model evidence with full chunk content", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: "chunk-1",
          content: "Rules reduce uncertainty and transaction costs.",
          chapter_title: "Institutions",
          similarity: 0.91,
          chapter_index: 2,
          chunk_index: 7,
        },
        {
          id: null,
          content: "Malformed rows are ignored.",
          chapter_title: "Broken",
          similarity: 0.5,
          chapter_index: 3,
          chunk_index: 1,
        },
      ],
      error: null,
    });
    const repository = new RagRepository(asClient({ rpc }));

    const results = await repository.searchChunks({
      query: "institutions",
      queryEmbedding: [0.1, 0.2, 0.3],
      matchCount: 3,
      bookUuid: "",
    });

    expect(results).toEqual([
      {
        id: "chunk-1",
        content: "Rules reduce uncertainty and transaction costs.",
        chapter_title: "Institutions",
        similarity: 0.91,
        chapter_index: 2,
        chunk_index: 7,
      },
    ]);
    expect(rpc).toHaveBeenCalledWith("hybrid_search", {
      query_text: "institutions",
      query_embedding: [0.1, 0.2, 0.3],
      match_count: 3,
      book_uuid_param: null,
    });
  });

  it("turns model evidence into frontend-safe citations without exposing content", () => {
    const repository = new RagRepository(asClient({}));
    const citations = repository.toSearchResultCitations([
      {
        id: "chunk-1",
        content: `${"Evidence ".repeat(40)}final sentence.`,
        chapter_title: "Institutions",
        similarity: 0.91,
        chapter_index: null,
        chunk_index: 7,
      },
    ]);

    expect(citations[0]).toMatchObject({
      id: "chunk-1",
      chapter_title: "Institutions",
      similarity: 0.91,
      chapter_index: null,
      chunk_index: 7,
    });
    expect(citations[0]?.preview.length).toBeLessThanOrEqual(180);
    expect(citations[0]?.preview.endsWith("...")).toBe(true);
    expect(JSON.stringify(citations)).not.toContain("content");
  });

  it("lists lightweight chunk nodes for the galaxy graph", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        { id: "chunk-1", chapter_title: "Rules", chunk_index: 0, book_id: "book-1" },
        { id: "chunk-2", chapter_title: "Broken", chunk_index: 1, book_id: null },
      ],
      error: null,
    });
    const from = vi.fn().mockReturnValue({
      select: () => ({ order }),
    });
    const repository = new RagRepository(asClient({ from }));

    await expect(repository.listNodes()).resolves.toEqual([
      { id: "chunk-1", chapter_title: "Rules", chunk_index: 0, book_id: "book-1" },
    ]);
    expect(from).toHaveBeenCalledWith("rag_chunks");
    expect(order).toHaveBeenCalledWith("chunk_index", { ascending: true });
  });

  it("lists ingested books behind the same repository boundary", async () => {
    const order = vi.fn().mockResolvedValue({ data: [book], error: null });
    const from = vi.fn().mockReturnValue({
      select: () => ({ order }),
    });
    const repository = new RagRepository(asClient({ from }));

    await expect(repository.listBooks()).resolves.toEqual([book]);
    expect(from).toHaveBeenCalledWith("rag_books");
    expect(order).toHaveBeenCalledWith("updated_at", { ascending: false });
  });

  it("maps Supabase failures to a public repository error", async () => {
    const repository = new RagRepository(
      asClient({
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "permission denied for function hybrid_search" },
        }),
      })
    );

    await expect(
      repository.searchChunks({
        query: "institutions",
        queryEmbedding: [0.1],
        matchCount: 3,
      })
    ).rejects.toMatchObject({
      publicMessage: "Unable to search local knowledge.",
      status: 502,
    });
  });
});
