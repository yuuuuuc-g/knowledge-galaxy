export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      topics: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          title: string;
          content_markdown: string;
          source_module: string;
          topic_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content_markdown: string;
          source_module: string;
          topic_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content_markdown?: string;
          source_module?: string;
          topic_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_topic_id_fkey";
            columns: ["topic_id"];
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
        ];
      };
      analytical_sessions: {
        Row: {
          id: string;
          document_id: string;
          source_issue: string;
          phases: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          source_issue: string;
          phases?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          source_issue?: string;
          phases?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "analytical_sessions_document_id_fkey";
            columns: ["document_id"];
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_briefings: {
        Row: {
          id: string;
          date: string;
          source: string;
          title: string;
          url: string;
          ai_summary: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          date?: string;
          source: string;
          title: string;
          url: string;
          ai_summary: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          source?: string;
          title?: string;
          url?: string;
          ai_summary?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      rag_books: {
        Row: {
          id: string;
          title: string;
          author: string;
          total_chunks: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          author: string;
          total_chunks?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          author?: string;
          total_chunks?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rag_chunks: {
        Row: {
          id: string;
          book_id: string;
          part_title: string | null;
          chapter_index: number;
          chapter_title: string;
          chunk_index: number;
          content: string;
          chapter_summary: string;
          word_count: number;
          embedding: number[];
          created_at: string;
        };
        Insert: {
          id?: string;
          book_id: string;
          part_title?: string | null;
          chapter_index: number;
          chapter_title: string;
          chunk_index: number;
          content: string;
          chapter_summary: string;
          word_count: number;
          embedding: number[];
          created_at?: string;
        };
        Update: {
          id?: string;
          book_id?: string;
          part_title?: string | null;
          chapter_index?: number;
          chapter_title?: string;
          chunk_index?: number;
          content?: string;
          chapter_summary?: string;
          word_count?: number;
          embedding?: number[];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rag_chunks_book_id_fkey";
            columns: ["book_id"];
            referencedRelation: "rag_books";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      hybrid_search: {
        Args: {
          query_text: string;
          query_embedding: number[];
          match_count?: number;
          book_uuid_param?: string | null;
        };
        Returns: {
          id: string;
          content: string;
          chapter_title: string;
          similarity: number;
          chapter_index: number;
          chunk_index: number;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
