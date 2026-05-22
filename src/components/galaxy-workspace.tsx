"use client";

import { FormEvent, memo, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import type { SearchResult } from "@/app/api/search/route";
import type { NodeData, NodesData } from "@/app/api/nodes/route";
import { GalaxyNodes } from "@/src/components/canvas/GalaxyNodes";
import { CopyButton } from "@/src/components/ui/CopyButton";

const MAX_RENDERED_RESULTS = 3;

interface SearchResponseBody {
  results?: SearchResult[];
  error?: string;
}

interface NodesResponseBody {
  nodes?: NodesData;
  error?: string;
}

interface GalaxyCanvasLayerProps {
  highlightedNodeId: string | null;
  nodes: NodesData;
}

function isSearchResult(value: unknown): value is SearchResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const row = value as Partial<SearchResult>;

  return (
    typeof row.id === "string" &&
    typeof row.content === "string" &&
    typeof row.chapter_title === "string" &&
    typeof row.similarity === "number"
  );
}

function isNodeData(value: unknown): value is NodeData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const row = value as Partial<NodeData>;

  return (
    typeof row.id === "string" &&
    typeof row.chapter_title === "string" &&
    typeof row.chunk_index === "number" &&
    typeof row.book_id === "string"
  );
}

const GalaxyCanvasLayer = memo(function GalaxyCanvasLayer({
  highlightedNodeId,
  nodes,
}: GalaxyCanvasLayerProps) {
  return (
    <Canvas
      className="pointer-events-auto absolute inset-0 z-0 touch-none"
      camera={{ position: [0, 1.8, 5.6], fov: 45 }}
      dpr={[1, 1.25]}
      frameloop="always"
      onWheel={(event) => {
        event.stopPropagation();
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
    >
      <ambientLight intensity={0.55} />
      <pointLight color="#67e8f9" intensity={2.2} position={[3, 3, 4]} />
      <Stars radius={42} depth={32} count={120} factor={3} fade speed={0.25} />
      <GalaxyNodes highlightedNodeId={highlightedNodeId} nodesData={nodes} />
      <OrbitControls enablePan enableZoom minDistance={2.8} maxDistance={9} panSpeed={0.75} zoomSpeed={0.85} />
    </Canvas>
  );
});

export function GalaxyWorkspace() {
  const [query, setQuery] = useState("");
  const [nodes, setNodes] = useState<NodesData>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [aiResponse, setAiResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [nodesError, setNodesError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);

  const renderedResults = useMemo(
    () => results.slice(0, MAX_RENDERED_RESULTS),
    [results]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadNodes() {
      try {
        const response = await fetch("/api/nodes");
        const payload = (await response.json()) as NodesResponseBody;

        if (!response.ok) {
          throw new Error(payload.error ?? "Nodes request failed.");
        }

        const safeNodes = Array.isArray(payload.nodes)
          ? payload.nodes.filter(isNodeData)
          : [];

        if (isMounted) {
          setNodes(safeNodes);
          setNodesError(null);
        }
      } catch (nodeError) {
        const message =
          nodeError instanceof Error ? nodeError.message : "Nodes request failed.";

        if (isMounted) {
          setNodes([]);
          setNodesError(message);
        }
      }
    }

    void loadNodes();

    return () => {
      isMounted = false;
    };
  }, []);

  async function streamGeneration(trimmedQuery: string, safeResults: SearchResult[]) {
    if (safeResults.length === 0) {
      setAiResponse("");
      return;
    }

    setAiResponse("");
    setIsGenerating(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmedQuery,
          references: safeResults.map((result) => ({ content: result.content })),
        }),
      });

      if (!response.ok) {
        throw new Error("Generation request failed.");
      }

      if (!response.body) {
        throw new Error("Generation stream is empty.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        setAiResponse((current) => current + decoder.decode(value, { stream: true }));
      }

      const remainingText = decoder.decode();

      if (remainingText) {
        setAiResponse((current) => current + remainingText);
      }
    } catch (generationError) {
      const message =
        generationError instanceof Error
          ? generationError.message
          : "Generation request failed.";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setError("Enter a question to search the Exocortex.");
      return;
    }

    setError(null);
    setAiResponse("");
    setIsSearching(true);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmedQuery }),
      });
      const payload = (await response.json()) as SearchResponseBody;

      if (!response.ok) {
        throw new Error(payload.error ?? "Search request failed.");
      }

      const safeResults = Array.isArray(payload.results)
        ? payload.results.filter(isSearchResult).slice(0, MAX_RENDERED_RESULTS)
        : [];

      setResults(safeResults);
      setHighlightedNodeId(safeResults[0]?.id ?? null);
      setIsSearching(false);
      await streamGeneration(trimmedQuery, safeResults);
    } catch (searchError) {
      const message =
        searchError instanceof Error ? searchError.message : "Search request failed.";
      setError(message);
      setResults([]);
      setAiResponse("");
      setHighlightedNodeId(null);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <main className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-black text-white">
      <div className="flex-1 w-full relative min-h-0">
        <GalaxyCanvasLayer highlightedNodeId={highlightedNodeId} nodes={nodes} />

        <section
          className="pointer-events-none absolute inset-0 z-10 flex items-start justify-between gap-4 p-4 lg:gap-6 lg:p-6"
          data-testid="search-hud"
        >
          <div className="pointer-events-auto w-full max-w-[min(28rem,42vw)] rounded-2xl border border-white/10 bg-black/75 p-5 shadow-[0_0_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/70">
            Exocortex RAG
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Retrieval Gateway
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Search ingested knowledge chunks and let the top chapter light up in the
            galaxy view.
          </p>

          <form className="mt-5 flex gap-3" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="exocortex-query">
              Exocortex query
            </label>
            <input
              aria-label="Exocortex query"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-cyan-300/60"
              id="exocortex-query"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ask about rules, scarcity, property rights..."
              type="search"
              value={query}
            />
            <button
              className="rounded-xl border border-cyan-300/40 bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSearching || isGenerating}
              type="submit"
            >
              {isSearching ? "Searching..." : isGenerating ? "Generating..." : "Search"}
            </button>
          </form>

          <div
            className="group relative mt-5 min-h-32 rounded-2xl border border-cyan-300/20 bg-cyan-950/20 p-4 shadow-[inset_0_0_24px_rgba(34,211,238,0.08)]"
            data-testid="ai-response"
          >
            <CopyButton textToCopy={aiResponse} />
            <div className="mb-2 flex items-center justify-between gap-3 pr-8">
              <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/60">
                Generation
              </p>
              {isGenerating && (
                <span className="text-xs text-cyan-200/70">Streaming...</span>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-cyan-50/80">
              {aiResponse || "AI analysis will stream here after retrieval."}
            </p>
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-red-400/30 bg-red-950/40 px-3 py-2 text-sm text-red-100">
              {error}
            </p>
          )}
          {nodesError && (
            <p className="mt-3 rounded-lg border border-amber-300/30 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
              {nodesError}
            </p>
          )}
          </div>

          <aside
            className="pointer-events-auto max-h-[calc(100%-2rem)] w-full max-w-[min(22rem,34vw)] overflow-y-auto rounded-2xl border border-white/10 bg-transparent p-4 shadow-[0_0_40px_rgba(0,0,0,0.45)]"
            data-testid="search-results"
          >
            <p className="text-xs uppercase tracking-[0.28em] text-white/40">
              Top Matches
            </p>

            {renderedResults.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-white/50">
                Run a search to surface the three most relevant chunks.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {renderedResults.map((result, index) => (
                  <article
                    className="relative rounded-xl border border-white/10 bg-white/[0.04] p-4"
                    key={result.id}
                  >
                    <CopyButton textToCopy={result.content} />
                    <div className="flex items-center justify-between gap-3 pr-8">
                      <h2 className="text-sm font-semibold text-cyan-100">
                        {index + 1}. {result.chapter_title}
                      </h2>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/60">
                        {result.similarity.toFixed(3)}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-4 text-sm leading-6 text-white/65">
                      {result.content}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
