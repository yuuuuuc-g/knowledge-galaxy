"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ExternalLink,
  Filter,
  MessageSquareText,
  Radio,
  RefreshCw,
  Tags,
  X,
} from "lucide-react";
import type {
  SignalBoardSummary,
  SocialSignalDomain,
  SocialSignalItem,
  SocialSignalUrgency,
} from "@/src/modules/social-signals/x-signals";

interface SocialSignalPayload {
  generatedAt?: string;
  items?: unknown;
  boards?: unknown;
  error?: string;
}

interface SocialSignalConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

const BOARD_LABELS: Record<SocialSignalDomain, string> = {
  macro: "Macro",
  politics: "Policy",
  society: "Society",
  history: "History",
  trade: "Trade",
  finance: "Finance",
  investment: "Investment",
  geopolitics: "Geo",
};

const URGENCY_LABELS: Array<{ id: SocialSignalUrgency | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isDomain(value: unknown): value is SocialSignalDomain {
  return (
    value === "macro" ||
    value === "politics" ||
    value === "society" ||
    value === "history" ||
    value === "trade" ||
    value === "finance" ||
    value === "investment" ||
    value === "geopolitics"
  );
}

function isUrgency(value: unknown): value is SocialSignalUrgency {
  return value === "low" || value === "medium" || value === "high";
}

function isSignalItem(value: unknown): value is SocialSignalItem {
  if (!isRecord(value)) return false;

  return (
    typeof value.externalId === "string" &&
    typeof value.sourceType === "string" &&
    typeof value.title === "string" &&
    typeof value.body === "string" &&
    typeof value.url === "string" &&
    (value.authorUsername === null || typeof value.authorUsername === "string") &&
    typeof value.actorType === "string" &&
    isStringArray(value.domains) &&
    value.domains.every(isDomain) &&
    isStringArray(value.topicTags) &&
    isUrgency(value.urgency) &&
    typeof value.signalType === "string" &&
    typeof value.regionScope === "string" &&
    typeof value.engagementScore === "number" &&
    isStringArray(value.mediaUrls)
  );
}

function isBoardSummary(value: unknown): value is SignalBoardSummary {
  if (!isRecord(value)) return false;

  return (
    isDomain(value.id) &&
    typeof value.label === "string" &&
    typeof value.description === "string" &&
    typeof value.itemCount === "number" &&
    typeof value.highUrgencyCount === "number"
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "undated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "undated";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

function urgencyClass(urgency: SocialSignalUrgency) {
  switch (urgency) {
    case "high":
      return "border-red-300/30 bg-red-400/10 text-red-100";
    case "medium":
      return "border-amber-300/30 bg-amber-400/10 text-amber-100";
    case "low":
      return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  }
}

function buildQuery(activeBoard: SocialSignalDomain | "all", activeUrgency: SocialSignalUrgency | "all") {
  const params = new URLSearchParams();
  params.set("limit", "80");
  if (activeBoard !== "all") {
    params.set("domain", activeBoard);
  }
  if (activeUrgency !== "all") {
    params.set("urgency", activeUrgency);
  }
  return `/api/social-signals?${params.toString()}`;
}

export function SocialSignalConsole({ isOpen, onClose }: SocialSignalConsoleProps) {
  const [items, setItems] = useState<SocialSignalItem[]>([]);
  const [boards, setBoards] = useState<SignalBoardSummary[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [activeBoard, setActiveBoard] = useState<SocialSignalDomain | "all">("all");
  const [activeUrgency, setActiveUrgency] = useState<SocialSignalUrgency | "all">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const totalUrgent = useMemo(
    () => boards.reduce((total, board) => total + board.highUrgencyCount, 0),
    [boards]
  );

  useEffect(() => {
    if (!isOpen || typeof fetch !== "function") return;

    const controller = new AbortController();
    let cancelled = false;

    async function loadSignals() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(buildQuery(activeBoard, activeUrgency), {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as SocialSignalPayload;

        if (!response.ok) {
          throw new Error(payload.error ?? `Social signal API returned ${response.status}`);
        }
        if (cancelled) return;

        setItems(Array.isArray(payload.items) ? payload.items.filter(isSignalItem) : []);
        setBoards(Array.isArray(payload.boards) ? payload.boards.filter(isBoardSummary) : []);
        setGeneratedAt(typeof payload.generatedAt === "string" ? payload.generatedAt : new Date().toISOString());
      } catch (loadError) {
        if (!controller.signal.aborted && !cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Load failed");
          setItems([]);
          setBoards([]);
          setGeneratedAt(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSignals();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeBoard, activeUrgency, isOpen, reloadKey]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          aria-modal="true"
          role="dialog"
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative grid h-[88vh] w-[1180px] max-w-[96vw] grid-cols-1 grid-rows-[auto_1fr] overflow-hidden rounded-xl border border-sky-300/25 bg-slate-950/88 shadow-[0_0_90px_rgba(14,165,233,0.18)] backdrop-blur-xl md:h-[84vh] md:grid-cols-[280px_1fr] md:grid-rows-none"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
          >
            <aside className="flex max-h-[42vh] min-h-0 flex-col overflow-y-auto border-b border-sky-200/10 bg-black/25 p-5 md:max-h-none md:border-b-0 md:border-r">
              <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.28em] text-sky-200/80">
                <Radio size={14} aria-hidden="true" />
                <span>X SIGNAL ORBIT</span>
              </div>
              <h2 className="mt-2 font-serif text-2xl tracking-widest text-white">
                Social Signal Boards
              </h2>
              <p className="mt-2 font-mono text-[11px] leading-5 text-white/40">
                UPDATED · {formatDate(generatedAt)} BJT · {items.length} ITEMS · {totalUrgent} HIGH
              </p>

              <div className="mt-6 flex items-center gap-2 font-mono text-[10px] tracking-widest text-white/45">
                <Filter size={13} aria-hidden="true" />
                <span>BOARDS</span>
              </div>
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => setActiveBoard("all")}
                  className={`w-full rounded border px-3 py-2 text-left font-mono text-xs transition ${
                    activeBoard === "all"
                      ? "border-sky-200/45 bg-sky-300/15 text-sky-100"
                      : "border-white/10 bg-white/[0.03] text-white/55 hover:border-sky-200/25 hover:text-white"
                  }`}
                >
                  ALL SIGNALS
                </button>
                {(Object.keys(BOARD_LABELS) as SocialSignalDomain[]).map((board) => (
                  <button
                    type="button"
                    key={board}
                    onClick={() => setActiveBoard(board)}
                    className={`w-full rounded border px-3 py-2 text-left font-mono text-xs transition ${
                      activeBoard === board
                        ? "border-sky-200/45 bg-sky-300/15 text-sky-100"
                        : "border-white/10 bg-white/[0.03] text-white/55 hover:border-sky-200/25 hover:text-white"
                    }`}
                  >
                    {BOARD_LABELS[board].toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="mt-6 flex items-center gap-2 font-mono text-[10px] tracking-widest text-white/45">
                <Tags size={13} aria-hidden="true" />
                <span>URGENCY</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {URGENCY_LABELS.map((urgency) => (
                  <button
                    type="button"
                    key={urgency.id}
                    onClick={() => setActiveUrgency(urgency.id)}
                    className={`rounded border px-2 py-2 font-mono text-[11px] transition ${
                      activeUrgency === urgency.id
                        ? "border-emerald-200/45 bg-emerald-300/15 text-emerald-100"
                        : "border-white/10 bg-white/[0.03] text-white/55 hover:border-emerald-200/25 hover:text-white"
                    }`}
                  >
                    {urgency.label}
                  </button>
                ))}
              </div>
            </aside>

            <section className="flex min-h-0 flex-col">
              <header className="flex items-start justify-between gap-4 border-b border-sky-200/10 px-6 py-5">
                <div>
                  <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.3em] text-sky-200/80">
                    <MessageSquareText size={14} aria-hidden="true" />
                    <span>REAL-TIME PUBLIC DISCOURSE</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/50">
                    X posts normalized into weak-signal boards for China macro, politics, society, trade, finance, investment, history, and geopolitics.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReloadKey((value) => value + 1)}
                    disabled={loading}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/65 transition hover:border-sky-200/40 hover:text-sky-100 disabled:opacity-40"
                    aria-label="Reload X social signals"
                  >
                    <RefreshCw size={14} className={loading ? "animate-spin" : undefined} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/65 transition hover:border-white/35 hover:text-white"
                    aria-label="Close X social signal board"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                {loading && items.length === 0 && (
                  <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-sky-200/70">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-300" />
                    <span>LOADING X SIGNALS...</span>
                  </div>
                )}

                {error && (
                  <div className="rounded border border-red-400/30 bg-red-500/10 px-4 py-3 font-mono text-xs text-red-200">
                    SIGNAL DB ERROR · {error}
                  </div>
                )}

                {!loading && !error && items.length === 0 && (
                  <div className="rounded border border-white/10 bg-white/[0.03] px-5 py-4">
                    <p className="font-mono text-xs tracking-widest text-sky-200/80">NO X SIGNALS</p>
                    <p className="mt-2 text-sm leading-6 text-white/45">
                      Run `/api/cron/x-signals-ingest` after applying the Supabase migration and setting `X_BEARER_TOKEN`.
                    </p>
                  </div>
                )}

                <ol className="space-y-3">
                  {items.map((item) => (
                    <li
                      key={item.externalId}
                      className="overflow-hidden rounded-lg border border-white/10 bg-slate-950/70 transition hover:border-sky-300/35 hover:bg-slate-900/70"
                    >
                      <article className="p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded border px-2 py-0.5 font-mono text-[10px] tracking-widest ${urgencyClass(item.urgency)}`}>
                            {item.urgency.toUpperCase()}
                          </span>
                          <span className="rounded border border-sky-300/20 bg-sky-400/[0.06] px-2 py-0.5 font-mono text-[10px] tracking-widest text-sky-100/75">
                            {item.signalType.replace("_", " ").toUpperCase()}
                          </span>
                          <span className="font-mono text-[10px] tracking-widest text-white/35">
                            {formatDate(item.publishedAt)}
                          </span>
                          {item.authorUsername && (
                            <span className="font-mono text-[10px] tracking-widest text-white/45">
                              @{item.authorUsername}
                            </span>
                          )}
                        </div>

                        <h3 className="mt-3 text-base font-medium leading-6 text-white/90">
                          {item.title}
                        </h3>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.domains.map((domain) => (
                            <span
                              key={domain}
                              className="rounded border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[10px] tracking-wider text-white/45"
                            >
                              {BOARD_LABELS[domain]}
                            </span>
                          ))}
                          {item.topicTags.slice(0, 5).map((tag) => (
                            <span
                              key={tag}
                              className="rounded border border-emerald-300/15 bg-emerald-300/[0.04] px-2 py-1 font-mono text-[10px] tracking-wider text-emerald-100/55"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <p className="font-mono text-[10px] tracking-widest text-white/35">
                            {item.regionScope.toUpperCase()} · {item.actorType.toUpperCase()} · ENG {item.engagementScore}
                          </p>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-[10px] tracking-widest text-sky-200/75 transition hover:text-sky-100"
                          >
                            OPEN X
                            <ExternalLink size={12} aria-hidden="true" />
                          </a>
                        </div>
                      </article>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
