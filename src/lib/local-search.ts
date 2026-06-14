import type { RagRepository, RagSearchResult } from "@/src/modules/rag/repository";

export const EMBEDDING_MODEL = "BAAI/bge-m3";

export type SearchResult = RagSearchResult;

export interface EmbeddingClient {
  embeddings: {
    create(input: { model: string; input: string }): Promise<{
      data: Array<{
        embedding?: number[];
      }>;
    }>;
  };
}

async function createQueryEmbedding(
  embeddingClient: EmbeddingClient,
  query: string
): Promise<number[]> {
  const embeddingResponse = await embeddingClient.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query,
  });
  const queryEmbedding = embeddingResponse.data[0]?.embedding;

  if (!queryEmbedding) {
    throw new Error("Embedding provider returned no vector.");
  }

  return queryEmbedding;
}

export async function runLocalHybridSearch(params: {
  repository: Pick<RagRepository, "searchChunks">;
  embeddingClient: EmbeddingClient;
  query: string;
  matchCount: number;
  bookUuid?: string;
}): Promise<RagSearchResult[]> {
  const queryEmbedding = await createQueryEmbedding(params.embeddingClient, params.query);

  return params.repository.searchChunks({
    query: params.query,
    queryEmbedding,
    matchCount: params.matchCount,
    bookUuid: params.bookUuid,
  });
}
