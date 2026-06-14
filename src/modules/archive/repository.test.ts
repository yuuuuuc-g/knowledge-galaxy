import { describe, expect, it, vi } from "vitest";
import {
  ArchiveRepository,
  type ArchiveDocument,
  type ArchiveSupabaseClient,
  type ArchiveTopic,
} from "./repository";

function asClient(from: (table: string) => unknown): ArchiveSupabaseClient {
  return { from } as unknown as ArchiveSupabaseClient;
}

const topic: ArchiveTopic = {
  id: "topic-1",
  title: "制度分析",
  description: null,
  created_at: "2026-06-14T00:00:00.000Z",
  updated_at: "2026-06-14T00:00:00.000Z",
};

const document: ArchiveDocument = {
  id: "doc-1",
  title: "制度分析",
  content_markdown: "正文",
  source_module: "analytical-pipeline",
  topic_id: "topic-1",
  created_at: "2026-06-14T00:00:00.000Z",
  updated_at: "2026-06-14T00:00:00.000Z",
};

describe("ArchiveRepository", () => {
  it("creates a topic, document, and analytical session behind one interface", async () => {
    const sessionInsert = vi.fn().mockResolvedValue({ error: null });
    const client = asClient((table) => {
      if (table === "topics") {
        return {
          insert: vi.fn(() => ({
            select: () => ({
              single: async () => ({ data: topic, error: null }),
            }),
          })),
        };
      }
      if (table === "documents") {
        return {
          insert: vi.fn(() => ({
            select: () => ({
              single: async () => ({ data: document, error: null }),
            }),
          })),
        };
      }
      return { insert: sessionInsert };
    });

    const repository = new ArchiveRepository(client);
    const result = await repository.persistAnalyticalArchive({
      content: "正文",
      sourceText: "制度分析",
      phases: { a: "briefing" },
    });

    expect(result).toEqual({ document, topic, mode: "create" });
    expect(sessionInsert).toHaveBeenCalledWith({
      document_id: "doc-1",
      source_issue: "制度分析",
      phases: { a: "briefing" },
    });
  });

  it("appends content to the newest document for an existing topic", async () => {
    const sessionInsert = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({
      eq: () => ({
        eq: () => ({
          select: () => ({
            single: async () => ({
              data: { ...document, content_markdown: "旧正文\n\n---\n\n新正文" },
              error: null,
            }),
          }),
        }),
      }),
    }));
    const client = asClient((table) => {
      if (table === "documents") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: { id: "doc-1", content_markdown: "旧正文" },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          update,
        };
      }
      return { insert: sessionInsert };
    });

    const repository = new ArchiveRepository(client);
    const result = await repository.persistAnalyticalArchive({
      content: "新正文",
      sourceText: "追加问题",
      selectedTopicId: "topic-1",
      phases: { b: "events" },
    });

    expect(result.mode).toBe("append");
    expect(update).toHaveBeenCalledWith({ content_markdown: "旧正文\n\n---\n\n新正文" });
    expect(sessionInsert).toHaveBeenCalledWith({
      document_id: "doc-1",
      source_issue: "追加问题",
      phases: { b: "events" },
    });
  });

  it("lists and deletes archive documents", async () => {
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const client = asClient((table) => {
      expect(table).toBe("documents");
      return {
        select: () => ({
          order: async () => ({ data: [document], error: null }),
        }),
        delete: () => ({
          eq: deleteEq,
        }),
      };
    });

    const repository = new ArchiveRepository(client);

    await expect(repository.listDocuments()).resolves.toEqual([document]);
    await expect(repository.deleteDocument("doc-1")).resolves.toBeUndefined();
    expect(deleteEq).toHaveBeenCalledWith("id", "doc-1");
  });
});
