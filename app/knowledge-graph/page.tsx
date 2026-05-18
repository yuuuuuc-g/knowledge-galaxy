import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NexusGraphCanvas } from "./NexusGraphCanvas";
import { createServerSupabase } from "@/src/lib/supabase/server";
import type { Database, Json } from "@/src/lib/database.types";
import type { NexusGraphData, NexusLink, NexusNode } from "./types";

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
type AnalyticalSessionRow =
  Database["public"]["Tables"]["analytical_sessions"]["Row"];

interface DocumentWithSessions extends DocumentRow {
  analytical_sessions: AnalyticalSessionRow[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeConceptName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const conceptMatch = trimmed.match(/(?:词汇|概念|关键词)[：:]\s*([^\n]+)/);
  if (conceptMatch?.[1]) {
    return conceptMatch[1].trim();
  }

  return trimmed;
}

function extractPhaseCConcepts(phases: Json): string[] {
  if (!isRecord(phases)) {
    return [];
  }

  const phaseC = phases.c;
  if (!isRecord(phaseC)) {
    return [];
  }

  const concepts = new Set<string>();
  const selectedItems = phaseC.selected_items;
  if (isRecord(selectedItems)) {
    Object.values(selectedItems).forEach((item) => {
      const concept = normalizeConceptName(item);
      if (concept) {
        concepts.add(concept);
      }
    });
  }

  const customTags = phaseC.custom_tags;
  if (Array.isArray(customTags)) {
    customTags.forEach((tag) => {
      const concept = normalizeConceptName(tag);
      if (concept) {
        concepts.add(concept);
      }
    });
  }

  return [...concepts];
}

function buildNexusGraph(documents: DocumentWithSessions[]): NexusGraphData {
  const nodes: NexusNode[] = [];
  const links: NexusLink[] = [];
  const conceptIdsByName = new Map<string, string>();
  const linkIds = new Set<string>();

  documents.forEach((document) => {
    const documentNodeId = `document:${document.id}`;
    nodes.push({
      id: documentNodeId,
      name: document.title,
      type: "document",
      color: "#f8fafc",
      val: 10,
      documentId: document.id,
    });

    document.analytical_sessions.forEach((session) => {
      extractPhaseCConcepts(session.phases).forEach((conceptName) => {
        const conceptKey = conceptName.toLocaleLowerCase();
        let conceptNodeId = conceptIdsByName.get(conceptKey);

        if (!conceptNodeId) {
          conceptNodeId = `concept:${conceptKey}`;
          conceptIdsByName.set(conceptKey, conceptNodeId);
          nodes.push({
            id: conceptNodeId,
            name: conceptName,
            type: "concept",
            color: "#deff9a",
            val: 4,
          });
        }

        const linkId = `${documentNodeId}->${conceptNodeId}`;
        if (!linkIds.has(linkId)) {
          linkIds.add(linkId);
          links.push({
            source: documentNodeId,
            target: conceptNodeId,
          });
        }
      });
    });
  });

  return { nodes, links };
}

export default async function KnowledgeGraphPage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("documents")
    .select("*, analytical_sessions(*)")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const graphData = buildNexusGraph((data ?? []) as DocumentWithSessions[]);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(222,255,154,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.07),transparent_28%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-6 py-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.35em] text-[#deff9a]/70">
              THE NEXUS
            </p>
            <h1 className="mt-2 font-serif text-4xl tracking-widest text-white">
              THE NEXUS
            </h1>
            <p className="mt-2 text-sm tracking-wide text-white/45">
              Interconnected Cognitive Nodes
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold tracking-wide text-white/70 transition hover:border-[#deff9a]/40 hover:text-[#deff9a]"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            返回星系
          </Link>
        </header>

        <div className="relative">
          <NexusGraphCanvas graphData={graphData} />
          <div className="pointer-events-none absolute bottom-5 left-5 font-mono text-xs uppercase tracking-[0.28em] text-[#deff9a]">
            <p>Documents {data?.length ?? 0}</p>
            <p className="mt-1">Nodes {graphData.nodes.length}</p>
            <p className="mt-1">Links {graphData.links.length}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
