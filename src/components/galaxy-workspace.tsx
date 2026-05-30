"use client";

import { FormEvent, memo, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SearchResult } from "@/src/lib/local-search";
import type { NodeData, NodesData } from "@/app/api/nodes/route";
import { GalaxyNodes } from "@/src/components/canvas/GalaxyNodes";
import { CopyButton } from "@/src/components/ui/CopyButton";
import { useDevRenderCounter } from "@/src/lib/dev-render-profiler";

const MAX_RENDERED_RESULTS = 3;

interface SearchResponseBody {
  results?: SearchResult[];
  error?: string;
}

interface NodesResponseBody {
  nodes?: NodesData;
  error?: string;
}

interface AgentToolCallResultEvent {
  results?: unknown;
}

interface AgentLogEntry {
  event: string;
  summary: string;
  tone: "info" | "success" | "warn" | "error";
}

type AgentStatus = "idle" | "searching" | "streaming" | "finished" | "failed";

interface ParsedSseFrame {
  eventName: string;
  payload: Record<string, unknown>;
}

function resolveAgentLogTone(eventName: string): AgentLogEntry["tone"] {
  if (eventName === "agent_finished") {
    return "success";
  }
  if (eventName === "agent_failed") {
    return "error";
  }
  if (eventName === "iteration_summary") {
    return "warn";
  }
  return "info";
}

function getAgentLogToneClass(tone: AgentLogEntry["tone"]): string {
  if (tone === "success") {
    return "text-emerald-300/90";
  }
  if (tone === "error") {
    return "text-red-300/90";
  }
  if (tone === "warn") {
    return "text-amber-200/85";
  }
  return "text-cyan-100/80";
}

function dedupeSearchResults(items: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const deduped: SearchResult[] = [];

  for (const item of items) {
    const key =
      item.chunk_index !== null ? `${item.id}:${item.chunk_index}` : `${item.id}:null`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
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
  useDevRenderCounter("GalaxyWorkspace::MemoizedGalaxyScene");
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
      <ambientLight intensity={1.85} />
      <directionalLight color="#dbeafe" intensity={1.4} position={[0, 4, 5]} />
      <pointLight color="#67e8f9" intensity={6.2} position={[3, 3, 4]} />
      <pointLight color="#e879f9" intensity={3.3} position={[-3, -2, 3]} />
      <Stars radius={42} depth={32} count={120} factor={3} fade speed={0.25} />
      <GalaxyNodes highlightedNodeId={highlightedNodeId} nodesData={nodes} />
      <OrbitControls enablePan enableZoom minDistance={2.8} maxDistance={9} panSpeed={0.75} zoomSpeed={0.85} />
    </Canvas>
  );
});

export const MemoizedGalaxyScene = GalaxyCanvasLayer;

interface GalaxyWorkspaceHudProps {
  onHighlightedNodeChange: (nodeId: string | null) => void;
  nodesError: string | null;
}

function GalaxyWorkspaceHud({ onHighlightedNodeChange, nodesError }: GalaxyWorkspaceHudProps) {
  useDevRenderCounter("GalaxyWorkspace::HUD");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [aiResponse, setAiResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [agentLogs, setAgentLogs] = useState<AgentLogEntry[]>([]);

  const renderedResults = useMemo(
    () => results.slice(0, MAX_RENDERED_RESULTS),
    [results]
  );
  const shouldShowAgentLogs =
    aiResponse.trim().length === 0 && isSearching && agentStatus !== "finished";

  function buildAgentLogSummary(eventName: string, payload: Record<string, unknown>): string {
    const iteration =
      typeof payload.iteration === "number" && Number.isFinite(payload.iteration)
        ? `#${payload.iteration}`
        : null;

    if (eventName === "agent_started") {
      const rewrittenQuery =
        typeof payload.rewrittenQuery === "string" ? payload.rewrittenQuery : "n/a";
      return `start ${iteration ?? ""} rewritten="${rewrittenQuery}"`.trim();
    }

    if (eventName === "tool_call_started") {
      const toolName = typeof payload.toolName === "string" ? payload.toolName : "tool";
      const query = typeof payload.query === "string" ? payload.query : "";
      return `${toolName} ${iteration ?? ""} query="${query}"`.trim();
    }

    if (eventName === "tool_call_result") {
      const retrievedChunks =
        typeof payload.retrievedChunks === "number" ? payload.retrievedChunks : 0;
      return `retrieved ${retrievedChunks} chunks ${iteration ?? ""}`.trim();
    }

    if (eventName === "iteration_summary") {
      const reason = typeof payload.continueReason === "string" ? payload.continueReason : "unknown";
      return `summary ${iteration ?? ""} reason=${reason}`.trim();
    }

    if (eventName === "model_delta") {
      const delta = typeof payload.delta === "string" ? payload.delta : "";
      return `delta ${iteration ?? ""} "${delta}"`.trim();
    }

    if (eventName === "agent_finished") {
      const totalIterations =
        typeof payload.totalIterations === "number" ? payload.totalIterations : "n/a";
      return `finished in ${totalIterations} iterations`;
    }

    if (eventName === "agent_failed") {
      const message = typeof payload.message === "string" ? payload.message : "failed";
      return `failed ${iteration ?? ""} "${message}"`.trim();
    }

    return JSON.stringify(payload);
  }

  function appendAgentLog(eventName: string, payload: Record<string, unknown>) {
    const summary = buildAgentLogSummary(eventName, payload);
    const tone = resolveAgentLogTone(eventName);
    setAgentLogs((current) => [...current, { event: eventName, summary, tone }]);
  }

  function parseSseFrame(frame: string): ParsedSseFrame | null {
    const lines = frame
      .split("\n")
      .map((line) => line.replace(/\r$/, ""))
      .filter((line) => line.length > 0 && !line.startsWith(":"));
    let eventName = "message";
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice("event:".length).trim() || "message";
        continue;
      }
      if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trim());
      }
    }

    const dataValue = dataLines.join("\n").trim();

    try {
      if (dataValue.length === 0) {
        return { eventName, payload: {} };
      }

      const parsed = JSON.parse(dataValue) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return {
          eventName,
          payload: parsed as Record<string, unknown>,
        };
      }

      return {
        eventName,
        payload: { value: parsed },
      };
    } catch {
      return {
        eventName,
        payload: { value: dataValue },
      };
    }
  }

  function handleAgentEvent(eventName: string, payload: Record<string, unknown>) {
    if (eventName === "tool_call_result") {
      const toolPayload = payload as AgentToolCallResultEvent;
      const parsedResults = Array.isArray(toolPayload.results)
        ? toolPayload.results.filter(isSearchResult).slice(0, MAX_RENDERED_RESULTS)
        : [];
      const safeResults = dedupeSearchResults(parsedResults).slice(0, MAX_RENDERED_RESULTS);
      // Keep right panel as the latest retrieval snapshot, not an accumulated list.
      setResults(safeResults);
      onHighlightedNodeChange(safeResults[0]?.id ?? null);
      appendAgentLog(eventName, payload);
      return;
    }

    if (eventName === "model_delta") {
      setAgentStatus("streaming");
      setIsSearching(false);
      const delta =
        typeof payload.delta === "string"
          ? payload.delta
          : typeof payload.value === "string"
            ? payload.value
            : "";
      if (delta.length > 0) {
        setAiResponse((current) => current + delta);
      }
      return;
    }

    appendAgentLog(eventName, payload);

    if (eventName === "agent_failed") {
      setAgentStatus("failed");
      setIsSearching(false);
      const errorMessage =
        typeof payload.message === "string" ? payload.message : "Search request failed.";
      throw new Error(errorMessage);
    }

    if (eventName === "agent_finished") {
      setAgentStatus("finished");
      setIsSearching(false);
    }
  }

  async function streamGeneration(trimmedQuery: string) {
    setAiResponse("");
    setResults([]);
    onHighlightedNodeChange(null);
    setAgentLogs([]);
    setIsGenerating(true);
    setAgentStatus("searching");

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmedQuery,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as SearchResponseBody;
        throw new Error(payload.error ?? "Search request failed.");
      }

      if (!response.body) {
        throw new Error("Search stream is empty.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const parsedFrame = parseSseFrame(frame);
            if (!parsedFrame) {
              continue;
            }
            handleAgentEvent(parsedFrame.eventName, parsedFrame.payload);
          }
        }

        if (done) {
          break;
        }
      }

      const remainingText = decoder.decode();
      if (remainingText.length > 0) {
        buffer += remainingText;
      }
      if (buffer.trim().length > 0) {
        const parsedFrame = parseSseFrame(buffer);
        if (parsedFrame) {
          handleAgentEvent(parsedFrame.eventName, parsedFrame.payload);
        }
      }
    } catch (generationError) {
      setAgentStatus("failed");
      setIsSearching(false);
      const message =
        generationError instanceof Error
          ? generationError.message
          : "Search request failed.";
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
    setAgentLogs([]);
    setIsSearching(true);
    setAgentStatus("searching");

    try {
      await streamGeneration(trimmedQuery);
    } catch (searchError) {
      const message =
        searchError instanceof Error ? searchError.message : "Search request failed.";
      setError(message);
      setResults([]);
      setAiResponse("");
      onHighlightedNodeChange(null);
      setAgentStatus("failed");
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <section
      className="pointer-events-none absolute inset-0 z-10 flex min-h-0 items-stretch justify-between gap-4 overflow-y-auto p-4 lg:gap-6 lg:p-6"
      data-testid="search-hud"
    >
      <div className="pointer-events-auto flex max-h-full min-h-0 w-full max-w-[min(28rem,42vw)] flex-col rounded-2xl border border-white/10 bg-black/75 p-5 shadow-[0_0_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
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

        <div className="mt-5 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          <div
            className="group relative flex min-h-32 flex-col rounded-2xl border border-cyan-300/20 bg-cyan-950/20 p-4 shadow-[inset_0_0_24px_rgba(34,211,238,0.08)]"
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
            <div className="min-h-0 flex-1 overflow-y-auto">
              {aiResponse ? (
                <div className="prose prose-invert prose-emerald max-w-none text-sm leading-6 text-cyan-50/85 prose-headings:text-emerald-300 prose-strong:text-cyan-100 prose-a:text-sky-300 prose-li:marker:text-emerald-400">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResponse}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm leading-6 text-cyan-50/80">
                  AI analysis will stream here after retrieval.
                </p>
              )}
            </div>
          </div>

          {shouldShowAgentLogs && (
            <div
              className="rounded-lg border border-cyan-300/20 bg-black/20 p-2"
              data-testid="agent-logs"
            >
              <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/55">
                Agent Logs
              </p>
              {agentLogs.length > 0 ? (
                <div className="mt-1 max-h-48 space-y-1 overflow-y-auto text-xs leading-5">
                  {agentLogs.map((entry, index) => (
                    <p className={getAgentLogToneClass(entry.tone)} key={`${entry.event}-${index}`}>
                      {entry.event} | {entry.summary}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-cyan-100/70">
                  Awaiting agent lifecycle events...
                </p>
              )}
            </div>
          )}
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
        className="pointer-events-auto flex max-h-full min-h-0 w-full max-w-[min(22rem,34vw)] flex-col overflow-y-auto rounded-2xl border border-white/10 bg-black/75 p-4 shadow-[0_0_40px_rgba(0,0,0,0.45)] backdrop-blur-xl"
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
                <div className="mb-2 flex items-center gap-1 font-mono text-xs text-emerald-400/80">
                  <span aria-hidden>◆</span>
                  <span>Source: {result.chapter_title}</span>
                </div>
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
  );
}

export function GalaxyWorkspace() {
  useDevRenderCounter("GalaxyWorkspace::Root");
  const [nodes, setNodes] = useState<NodesData>([]);
  const [nodesError, setNodesError] = useState<string | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);

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

  return (
    <main className="flex h-full min-h-0 w-full flex-col overflow-x-hidden bg-black text-white">
      <div className="relative min-h-0 w-full flex-1">
        <MemoizedGalaxyScene highlightedNodeId={highlightedNodeId} nodes={nodes} />
        <GalaxyWorkspaceHud
          nodesError={nodesError}
          onHighlightedNodeChange={setHighlightedNodeId}
        />
      </div>
    </main>
  );
}
