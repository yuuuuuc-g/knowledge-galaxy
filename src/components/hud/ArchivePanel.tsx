"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/src/lib/supabase/client";
import { GlassPanel } from "@/src/components/ui/GlassPanel";
import type { Database } from "@/src/lib/database.types";

type Document = Database["public"]["Tables"]["documents"]["Row"];

interface ArchivePanelProps {
  onClose: () => void;
}

export function ArchivePanel({ onClose }: ArchivePanelProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadDocuments() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setDocuments(data);
      }
      setLoading(false);
    }

    loadDocuments();
  }, []);

  const handleDocumentClick = (id: string) => {
    router.push(`/archive/${id}`);
  };

  const handleDeleteDocument = async (id: string) => {
    if (deletingId) {
      return;
    }

    setDeletingId(id);
    const supabase = createClient();

    const { error: sessionError } = await supabase
      .from("analytical_sessions")
      .delete()
      .eq("document_id", id);

    if (sessionError) {
      setDeletingId(null);
      return;
    }

    const { error: documentError } = await supabase
      .from("documents")
      .delete()
      .eq("id", id);

    if (!documentError) {
      setDocuments((current) => current.filter((doc) => doc.id !== id));
    }

    setDeletingId(null);
  };

  return (
    <GlassPanel className="pointer-events-auto absolute right-0 top-0 z-30 flex h-full w-96 flex-col border-y-0 border-r-0 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-serif text-2xl tracking-widest text-[#deff9a]">
          ARCHIVE
        </h2>
        <button
          onClick={onClose}
          className="text-sm text-white/50 transition-colors hover:text-white"
        >
          Close
        </button>
      </div>

      {loading ? (
        <div className="flex-1 text-white/50">Loading...</div>
      ) : documents.length === 0 ? (
        <div className="flex-1 text-white/50">
          No documents yet. Start an analytical pipeline to create your first document.
        </div>
      ) : (
        <div className="flex-1 space-y-4 overflow-y-auto">
          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => handleDocumentClick(doc.id)}
              className="group cursor-pointer border-b border-white/10 pb-4 transition-colors hover:border-white/20"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium text-white">{doc.title}</h3>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleDeleteDocument(doc.id);
                  }}
                  disabled={deletingId === doc.id}
                  className="shrink-0 rounded px-2 py-1 text-xs tracking-wide text-white/35 opacity-70 transition hover:bg-red-500/10 hover:text-red-300 disabled:pointer-events-none disabled:text-white/20 sm:opacity-0 sm:group-hover:opacity-100"
                  title="Delete document"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  <span className="sr-only">Delete</span>
                </button>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-white/50">
                <span className="rounded bg-white/10 px-1.5 py-0.5">
                  {doc.source_module}
                </span>
                <span>
                  {new Date(doc.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassPanel>
  );
}
