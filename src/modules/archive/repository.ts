import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/lib/database.types";

export type ArchiveSupabaseClient = SupabaseClient<Database>;
export type ArchiveTopic = Database["public"]["Tables"]["topics"]["Row"];
export type ArchiveDocument = Database["public"]["Tables"]["documents"]["Row"];
export type AnalyticalSession = Database["public"]["Tables"]["analytical_sessions"]["Row"];

export interface ArchiveDocumentWithSessions extends ArchiveDocument {
  analytical_sessions: AnalyticalSession[];
}

export interface PersistAnalyticalArchiveInput {
  content: string;
  sourceText: string;
  selectedTopicId?: string;
  phases: Record<string, Json>;
}

export interface PersistAnalyticalArchiveResult {
  document: ArchiveDocument;
  topic: ArchiveTopic | null;
  mode: "append" | "create";
}

export class ArchiveRepositoryError extends Error {
  constructor(
    message: string,
    readonly publicMessage: string,
    readonly status = 502
  ) {
    super(message);
    this.name = "ArchiveRepositoryError";
  }
}

function fail(message: string, publicMessage: string, status?: number): never {
  throw new ArchiveRepositoryError(message, publicMessage, status);
}

function assertRow<T>(row: T | null, message: string, publicMessage: string): T {
  if (!row) {
    fail(message, publicMessage);
  }
  return row;
}

export class ArchiveRepository {
  constructor(private readonly supabase: ArchiveSupabaseClient) {}

  async listDocuments(): Promise<ArchiveDocument[]> {
    const { data, error } = await this.supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      fail(error.message, "Unable to load archive documents.");
    }

    return data ?? [];
  }

  async listTopics(): Promise<ArchiveTopic[]> {
    const { data, error } = await this.supabase
      .from("topics")
      .select("id, title, description, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      fail(error.message, "Unable to load topics.");
    }

    return data ?? [];
  }

  async getDocumentWithSessions(id: string): Promise<ArchiveDocumentWithSessions | null> {
    const { data, error } = await this.supabase
      .from("documents")
      .select("*, analytical_sessions(*)")
      .eq("id", id)
      .single();

    if (error) {
      fail(error.message, "Unable to load archive document.");
    }

    return data as ArchiveDocumentWithSessions | null;
  }

  async listDocumentsWithSessions(): Promise<ArchiveDocumentWithSessions[]> {
    const { data, error } = await this.supabase
      .from("documents")
      .select("*, analytical_sessions(*)")
      .order("created_at", { ascending: false });

    if (error) {
      fail(error.message, "Unable to load archive graph.");
    }

    return (data ?? []) as ArchiveDocumentWithSessions[];
  }

  async deleteDocument(id: string): Promise<void> {
    const { error } = await this.supabase.from("documents").delete().eq("id", id);

    if (error) {
      fail(error.message, "Unable to delete archive document.");
    }
  }

  async persistAnalyticalArchive(
    input: PersistAnalyticalArchiveInput
  ): Promise<PersistAnalyticalArchiveResult> {
    if (input.selectedTopicId) {
      return this.appendToTopic(input);
    }

    return this.createTopicDocumentAndSession(input);
  }

  private async appendToTopic(
    input: PersistAnalyticalArchiveInput
  ): Promise<PersistAnalyticalArchiveResult> {
    const topicId = input.selectedTopicId;
    if (!topicId) {
      fail("Missing selected topic id for append.", "selectedTopicId is required for append mode.", 400);
    }

    const { data: existingDoc, error: fetchError } = await this.supabase
      .from("documents")
      .select("id, content_markdown")
      .eq("topic_id", topicId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      fail(fetchError.message, "Unable to load topic document.");
    }

    if (!existingDoc) {
      fail("No existing document found for selected topic.", "No existing document found for the selected topic.", 404);
    }

    const updatedContent = `${existingDoc.content_markdown}\n\n---\n\n${input.content}`;
    const { data: document, error: updateError } = await this.supabase
      .from("documents")
      .update({ content_markdown: updatedContent })
      .eq("id", existingDoc.id)
      .eq("topic_id", topicId)
      .select()
      .single();

    if (updateError) {
      fail(updateError.message, "Unable to update topic document.");
    }

    await this.insertSession(existingDoc.id, input);

    return {
      document: assertRow(document, "Updated document returned no row.", "Unable to update topic document."),
      topic: null,
      mode: "append",
    };
  }

  private async createTopicDocumentAndSession(
    input: PersistAnalyticalArchiveInput
  ): Promise<PersistAnalyticalArchiveResult> {
    const topicTitle = input.sourceText.slice(0, 100) || "Untitled Topic";
    const { data: topic, error: topicError } = await this.supabase
      .from("topics")
      .insert({ title: topicTitle, description: null })
      .select()
      .single();

    if (topicError) {
      fail(topicError.message, "Unable to create topic.");
    }

    const createdTopic = assertRow(topic, "Topic insert returned no row.", "Unable to create topic.");
    const { data: document, error: docError } = await this.supabase
      .from("documents")
      .insert({
        title: input.sourceText.slice(0, 50) || "Untitled Analysis",
        content_markdown: input.content,
        source_module: "analytical-pipeline",
        topic_id: createdTopic.id,
      })
      .select()
      .single();

    if (docError) {
      fail(docError.message, "Unable to create archive document.");
    }

    const createdDocument = assertRow(
      document,
      "Document insert returned no row.",
      "Unable to create archive document."
    );
    await this.insertSession(createdDocument.id, input);

    return {
      document: createdDocument,
      topic: createdTopic,
      mode: "create",
    };
  }

  private async insertSession(documentId: string, input: PersistAnalyticalArchiveInput): Promise<void> {
    const { error } = await this.supabase.from("analytical_sessions").insert({
      document_id: documentId,
      source_issue: input.sourceText,
      phases: input.phases,
    });

    if (error) {
      fail(error.message, "Unable to record analytical session.");
    }
  }
}

export function createArchiveRepository(supabase: ArchiveSupabaseClient): ArchiveRepository {
  return new ArchiveRepository(supabase);
}
