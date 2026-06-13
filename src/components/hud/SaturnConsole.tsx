"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Radar, RefreshCw, X } from "lucide-react";

interface RawMacroArticle {
  id: number;
  source: string;
  title: string;
  url: string;
  snippet: string;
  publishedAt: string | null;
  score: number;
}

interface RawMacroPayload {
  generatedAt?: string;
  sourceCount?: number;
  candidatesCount?: number;
  items?: unknown;
}

interface SaturnConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatTradingDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function isRawMacroArticle(value: unknown): value is RawMacroArticle {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as RawMacroArticle).id === "number" &&
    typeof (value as RawMacroArticle).source === "string" &&
    typeof (value as RawMacroArticle).title === "string" &&
    typeof (value as RawMacroArticle).url === "string" &&
    typeof (value as RawMacroArticle).snippet === "string"
  );
}

function isRawMacroArticleArray(value: unknown): value is RawMacroArticle[] {
  return Array.isArray(value) && value.every(isRawMacroArticle);
}

export function SaturnConsole({ isOpen, onClose }: SaturnConsoleProps) {
  const [articles, setArticles] = useState<RawMacroArticle[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    let cancelled = false;

    async function loadBriefings() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/data/macro-raw-articles.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Raw macro article feed returned ${response.status}`);
        }

        if (cancelled) return;
        const payload = (await response.json()) as RawMacroPayload;
        setArticles(isRawMacroArticleArray(payload.items) ? payload.items : []);
        setGeneratedAt(
          typeof payload.generatedAt === "string"
            ? payload.generatedAt
            : new Date().toISOString()
        );
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Load failed");
          setArticles([]);
          setGeneratedAt(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadBriefings();

    return () => {
      cancelled = true;
    };
  }, [isOpen, reloadKey]);

  const latestDate = generatedAt ?? new Date().toISOString();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          aria-modal="true"
          role="dialog"
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-[920px] max-w-[95vw] overflow-hidden rounded-2xl border border-yellow-300/25 bg-black/75 shadow-[0_0_80px_rgba(250,204,21,0.18)] backdrop-blur-xl"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-200/60 to-transparent" />

            <header className="flex items-start justify-between gap-4 border-b border-white/10 bg-gradient-to-b from-yellow-500/[0.06] to-transparent px-7 py-5">
              <div>
                <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.35em] text-yellow-300/90">
                  <Radar size={14} aria-hidden="true" />
                  <span>SATURN // RAW ARTICLE RADAR</span>
                </div>
                <h2 className="mt-2 font-serif text-2xl tracking-widest text-white/95">
                  Daily Macro Briefings
                </h2>
                <p className="mt-1 font-mono text-[11px] tracking-wider text-white/35">
                  RAW FEED · {formatTradingDate(latestDate)} BJT · {articles.length} ARTICLES
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReloadKey((value) => value + 1)}
                  disabled={loading}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/65 transition hover:border-yellow-200/40 hover:text-yellow-100 disabled:opacity-40"
                  aria-label="Reload briefings"
                >
                  <RefreshCw
                    size={14}
                    className={loading ? "animate-spin" : undefined}
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/65 transition hover:border-white/35 hover:text-white"
                  aria-label="Close Saturn radar"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            </header>

            <div className="max-h-[68vh] overflow-y-auto px-7 py-6">
              {loading && articles.length === 0 && (
                <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-yellow-200/70">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-yellow-300" />
                  <span>LOADING SHARED MACRO FEED...</span>
                </div>
              )}

              {error && (
                <div className="rounded border border-red-400/30 bg-red-500/10 px-4 py-3 font-mono text-xs text-red-200">
                  RADAR ERROR · {error}
                </div>
              )}

              {!loading && !error && articles.length === 0 && (
                <div className="flex flex-col items-start gap-2 font-mono text-xs text-white/55">
                  <span className="tracking-widest text-yellow-300/80">NO ARTICLES</span>
                  <span className="text-white/40">
                    Run `npm run fetch:macro-intel` to generate the shared raw article feed.
                  </span>
                </div>
              )}

              <ol className="space-y-3">
                {articles.map((item, index) => (
                  <li
                    key={item.id}
                    className="group relative overflow-hidden rounded-lg border border-white/10 bg-zinc-950/60 transition hover:border-yellow-300/35 hover:bg-zinc-900/70"
                  >
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[10px] tracking-widest text-yellow-300/70">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="rounded border border-white/15 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] tracking-widest text-white/65">
                            {item.source.toUpperCase()}
                          </span>
                          <span className="font-mono text-[10px] tracking-wider text-white/30">
                            {hostnameOf(item.url)}
                          </span>
                        </div>
                        <ExternalLink
                          size={12}
                          className="mt-1 text-white/30 transition group-hover:text-yellow-200/80"
                          aria-hidden="true"
                        />
                      </div>
                      <p className="mt-2 text-sm font-medium leading-snug text-white/90">
                        {item.title}
                      </p>
                      <p className="mt-2 border-l border-yellow-300/30 pl-3 text-xs leading-relaxed text-yellow-100/70">
                        {item.snippet || "No summary available from RSS source."}
                      </p>
                    </a>
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-yellow-300/60 to-transparent opacity-0 transition group-hover:opacity-100" />
                  </li>
                ))}
              </ol>
            </div>

            <footer className="border-t border-white/10 bg-black/40 px-7 py-3 font-mono text-[10px] tracking-widest text-white/35">
              SHARED FEED · SAME SOURCES AS URANUS · RAW ARTICLES BEFORE DEEPSEEK ANALYSIS
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
