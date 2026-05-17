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
      documents: {
        Row: {
          id: string;
          title: string;
          content_markdown: string;
          source_module: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content_markdown: string;
          source_module: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content_markdown?: string;
          source_module?: string;
          created_at?: string;
          updated_at?: string;
        };
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
      };
    };
  };
}
