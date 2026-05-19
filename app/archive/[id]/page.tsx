import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Tag, Lightbulb } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createServerSupabase } from "@/src/lib/supabase/server";
import type { Database } from "@/src/lib/database.types";

type Document = Database["public"]["Tables"]["documents"]["Row"];
type AnalyticalSession = Database["public"]["Tables"]["analytical_sessions"]["Row"];

interface ArchivePageProps {
  params: Promise<{ id: string }>;
}

interface DocumentWithSession extends Document {
  analytical_sessions: AnalyticalSession[];
}

function extractBriefing(phases: AnalyticalSession["phases"]): string {
  if (!phases || typeof phases !== "object") return "No briefing available";
  const phaseA = (phases as Record<string, unknown>).a;
  if (!phaseA || typeof phaseA !== "object") return "No briefing available";
  const archive = (phaseA as Record<string, unknown>).archive;
  return typeof archive === "string" ? archive.slice(0, 300) + "..." : "No briefing available";
}

function extractKeywords(phases: AnalyticalSession["phases"]): string[] {
  if (!phases || typeof phases !== "object") return [];
  const phaseC = (phases as Record<string, unknown>).c;
  if (!phaseC || typeof phaseC !== "object") return [];
  const selectedItems = (phaseC as Record<string, unknown>).selected_items;
  if (!selectedItems || typeof selectedItems !== "object") return [];
  
  const keywords: string[] = [];
  Object.values(selectedItems).forEach((item) => {
    if (typeof item === "string") {
      const match = item.match(/词汇[：:]\s*(.+)/);
      if (match) keywords.push(match[1].trim());
    }
  });
  return keywords;
}

export default async function ArchivePage({ params }: ArchivePageProps) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("documents")
    .select("*, analytical_sessions(*)")
    .eq("id", id)
    .single();

  if (!data) {
    notFound();
  }

  const document = data as DocumentWithSession;
  const session = document.analytical_sessions?.[0];

  return (
    <div className="min-h-screen overflow-y-auto bg-zinc-950 text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-white/60 transition hover:text-[#deff9a]"
          >
            <ArrowLeft size={16} />
            <span>Back to Sun</span>
          </Link>
          <Link
            href="/knowledge-graph"
            className="flex items-center gap-2 text-sm text-white/60 transition hover:text-[#deff9a]"
          >
            <Tag size={16} />
            <span>Return to The Nexus</span>
          </Link>
          <span className="text-xs text-white/40">
            {new Date(document.created_at).toLocaleDateString()}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          <article className="lg:col-span-3">
            <div className="prose prose-invert prose-zinc max-w-none prose-headings:text-[#deff9a] prose-a:text-[#deff9a]">
              <h1 className="mb-8 font-serif text-4xl tracking-wide">{document.title}</h1>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {document.content_markdown}
              </ReactMarkdown>
            </div>
          </article>

          <aside className="space-y-6 lg:col-span-1">
            {session && (
              <>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
                  <div className="mb-4 flex items-center gap-2 text-[#deff9a]">
                    <Lightbulb size={16} />
                    <span className="text-sm font-semibold">Original Issue</span>
                  </div>
                  <p className="text-sm leading-relaxed text-white/70">
                    {session.source_issue}
                  </p>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
                  <div className="mb-4 flex items-center gap-2 text-[#deff9a]">
                    <Lightbulb size={16} />
                    <span className="text-sm font-semibold">Briefing</span>
                  </div>
                  <p className="text-sm leading-relaxed text-white/70">
                    {extractBriefing(session.phases)}
                  </p>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
                  <div className="mb-4 flex items-center gap-2 text-[#deff9a]">
                    <Tag size={16} />
                    <span className="text-sm font-semibold">Keywords & Concepts</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {extractKeywords(session.phases).map((keyword, index) => (
                      <span
                        key={index}
                        className="rounded-full border border-[#deff9a]/30 bg-[#deff9a]/10 px-3 py-1 text-xs text-[#deff9a]"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            
          </aside>
        </div>
      </main>
    </div>
  );
}
