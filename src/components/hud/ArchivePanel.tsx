"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { motion } from "framer-motion";
import { downloadAllDocumentsAsJson } from "@/src/lib/export-utils";
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
    let active = true;

    async function loadDocuments() {
      try {
        const response = await fetch("/api/archive", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Unable to load archive documents.");
        }
        const payload = (await response.json()) as { documents?: Document[] };
        if (active) {
          setDocuments(Array.isArray(payload.documents) ? payload.documents : []);
        }
      } catch (error) {
        console.error("[ArchivePanel] load failed:", error);
        if (active) {
          setDocuments([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDocuments();
    return () => {
      active = false;
    };
  }, []);

  const handleDocumentClick = (id: string) => {
    router.push(`/archive/${id}`);
  };

  const handleDeleteDocument = async (id: string) => {
    if (deletingId) {
      return;
    }

    setDeletingId(id);
    const response = await fetch(`/api/archive/${id}`, { method: "DELETE" });
    if (response.ok) {
      setDocuments((current) => current.filter((doc) => doc.id !== id));
    } else {
      console.error("[ArchivePanel] delete failed:", await response.text());
    }

    setDeletingId(null);
  };

  return (
    <motion.div
      aria-modal="true"
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
    >
      <GlassPanel
        className="pointer-events-auto flex h-[82vh] w-[760px] max-w-[95vw] flex-col overflow-hidden rounded-2xl border border-[#deff9a]/45 p-0 shadow-[0_0_80px_rgba(222,255,154,0.2)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-gradient-to-b from-[#deff9a]/[0.06] to-transparent px-7 py-5">
          <div>
            <p className="font-mono text-[11px] tracking-[0.35em] text-[#deff9a]/75">
              EARTH // ARCHIVE NODE
            </p>
            <h2 className="mt-2 font-serif text-2xl tracking-widest text-white/95">
              Archive
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {documents.length > 0 && (
              <button
                type="button"
                onClick={() => downloadAllDocumentsAsJson(documents)}
                className="border border-cyan-500/30 px-2 py-1 text-[10px] uppercase tracking-wider text-cyan-400/80 transition-all hover:border-cyan-400/50 hover:text-cyan-300"
              >
                [ EXPORT ALL AS JSON ]
              </button>
            )}
            <button
              aria-label="Close archive"
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/65 transition hover:border-white/35 hover:text-white"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 px-7 py-6 text-white/50">Loading...</div>
        ) : documents.length === 0 ? (
          <div className="flex-1 px-7 py-6 text-white/50">
            No documents yet. Start an analytical pipeline to create your first document.
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto px-7 py-6">
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
    </motion.div>
  );
}
