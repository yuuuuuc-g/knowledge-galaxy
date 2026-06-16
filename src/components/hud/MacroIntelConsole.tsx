"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Database, ExternalLink, RefreshCw, X } from "lucide-react";

type MacroEventType =
  | "policy"
  | "macro_data"
  | "trade"
  | "fiscal"
  | "capital_market"
  | "geopolitics";

interface MacroIntelItem {
  id: number;
  title: string;
  source: string;
  url: string;
  eventType: MacroEventType;
  coreLogic: string;
  policyIntent: string;
  capitalImpact: string;
  affectedRegions: string[];
  affectedSectors: string[];
  timeHorizon: "short" | "medium" | "long";
  confidence: number;
  impactScore: number;
  evidence: string[];
  publishedAt?: string | null;
}

interface MacroIntelPayload {
  generatedAt?: string;
  items?: unknown;
}

interface MacroIntelConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isMacroEventType(value: unknown): value is MacroEventType {
  return (
    value === "policy" ||
    value === "macro_data" ||
    value === "trade" ||
    value === "fiscal" ||
    value === "capital_market" ||
    value === "geopolitics"
  );
}

function isMacroIntelItem(value: unknown): value is MacroIntelItem {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "number" &&
    typeof value.title === "string" &&
    typeof value.source === "string" &&
    typeof value.url === "string" &&
    isMacroEventType(value.eventType) &&
    typeof value.coreLogic === "string" &&
    typeof value.policyIntent === "string" &&
    typeof value.capitalImpact === "string" &&
    isStringArray(value.affectedRegions) &&
    isStringArray(value.affectedSectors) &&
    (value.timeHorizon === "short" ||
      value.timeHorizon === "medium" ||
      value.timeHorizon === "long") &&
    typeof value.confidence === "number" &&
    typeof value.impactScore === "number" &&
    isStringArray(value.evidence)
  );
}

function isMacroIntelItemArray(value: unknown): value is MacroIntelItem[] {
  return Array.isArray(value) && value.every(isMacroIntelItem);
}

function eventTypeLabel(eventType: MacroEventType) {
  switch (eventType) {
    case "policy":
      return "POLICY";
    case "macro_data":
      return "MACRO DATA";
    case "trade":
      return "TRADE";
    case "fiscal":
      return "FISCAL";
    case "capital_market":
      return "CAPITAL";
    case "geopolitics":
      return "GEO";
  }
}

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatGeneratedAt(value: string | null) {
  if (!value) return "pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "pending";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

export function MacroIntelConsole({ isOpen, onClose }: MacroIntelConsoleProps) {
  const [items, setItems] = useState<MacroIntelItem[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isOpen || typeof fetch !== "function") return;

    const controller = new AbortController();
    let cancelled = false;

    async function loadMacroIntel() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/macro-intel?t=${Date.now()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Macro intel database returned ${response.status}`);
        }

        const payload = (await response.json()) as MacroIntelPayload;
        if (cancelled) return;

        setItems(isMacroIntelItemArray(payload.items) ? payload.items : []);
        setGeneratedAt(
          typeof payload.generatedAt === "string"
            ? payload.generatedAt
            : new Date().toISOString()
        );
      } catch (loadError) {
        if (!controller.signal.aborted && !cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Load failed");
          setItems([]);
          setGeneratedAt(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMacroIntel();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isOpen, reloadKey]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          aria-modal="true"
          role="dialog"
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-[1120px] max-w-[96vw] overflow-hidden rounded-2xl border border-cyan-300/25 bg-slate-950/85 shadow-[0_0_90px_rgba(34,211,238,0.16)] backdrop-blur-xl"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4 border-b border-cyan-300/10 bg-gradient-to-b from-cyan-500/[0.08] to-transparent px-7 py-5">
              <div>
                <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.35em] text-cyan-300/90">
                  <Database size={14} aria-hidden="true" />
                  <span>URANUS // INTELLIGENCE DATABASE</span>
                </div>
                <h2 className="mt-2 font-serif text-2xl tracking-widest text-white/95">
                  Macro Intelligence Archive
                </h2>
                <p className="mt-1 font-mono text-[11px] tracking-wider text-white/35">
                  UPDATED · {formatGeneratedAt(generatedAt)} BJT · {items.length} SIGNALS
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReloadKey((value) => value + 1)}
                  disabled={loading}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/65 transition hover:border-cyan-200/40 hover:text-cyan-100 disabled:opacity-40"
                  aria-label="Reload macro intelligence database"
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
                  aria-label="Close macro intelligence database"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            </header>

            <div className="max-h-[72vh] overflow-y-auto px-7 py-6">
              {loading && items.length === 0 && (
                <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-cyan-200/70">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
                  <span>LOADING MACRO SIGNALS...</span>
                </div>
              )}

              {error && (
                <div className="rounded border border-red-400/30 bg-red-500/10 px-4 py-3 font-mono text-xs text-red-200">
                  INTEL DB ERROR · {error}
                </div>
              )}

              {!loading && !error && items.length === 0 && (
                <div className="flex flex-col items-start gap-2 font-mono text-xs text-white/55">
                  <span className="tracking-widest text-cyan-300/80">NO SIGNALS</span>
                  <span className="text-white/40">
                    Macro intelligence API has not returned any signals yet.
                  </span>
                </div>
              )}

              <ol className="space-y-4">
                {items.map((item, index) => (
                  <li
                    key={item.id}
                    className="group relative overflow-hidden rounded-lg border border-white/10 bg-slate-950/70 transition hover:border-cyan-300/35 hover:bg-slate-900/70"
                  >
                    <article className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] tracking-widest text-cyan-300/70">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="rounded border border-cyan-300/20 bg-cyan-400/[0.05] px-2 py-0.5 font-mono text-[10px] tracking-widest text-cyan-100/75">
                            {eventTypeLabel(item.eventType)}
                          </span>
                          <span className="rounded border border-white/15 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] tracking-widest text-white/60">
                            {item.source.toUpperCase()}
                          </span>
                          <span className="font-mono text-[10px] tracking-wider text-white/30">
                            {hostnameOf(item.url)}
                          </span>
                        </div>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-cyan-200/70 transition hover:text-cyan-100"
                        >
                          Source <ExternalLink size={12} aria-hidden="true" />
                        </a>
                      </div>

                      <h3 className="mt-3 text-base font-medium leading-snug text-white/95">
                        {item.title}
                      </h3>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded border border-cyan-300/15 bg-cyan-400/[0.03] p-3">
                          <div className="font-mono text-[10px] uppercase tracking-widest text-cyan-300/70">
                            Core Logic
                          </div>
                          <p className="mt-2 text-xs leading-relaxed text-white/70">{item.coreLogic}</p>
                        </div>
                        <div className="rounded border border-cyan-300/15 bg-cyan-400/[0.03] p-3">
                          <div className="font-mono text-[10px] uppercase tracking-widest text-cyan-300/70">
                            Policy Intent
                          </div>
                          <p className="mt-2 text-xs leading-relaxed text-white/70">{item.policyIntent}</p>
                        </div>
                        <div className="rounded border border-cyan-300/15 bg-cyan-400/[0.03] p-3">
                          <div className="font-mono text-[10px] uppercase tracking-widest text-cyan-300/70">
                            Capital Impact
                          </div>
                          <p className="mt-2 text-xs leading-relaxed text-white/70">{item.capitalImpact}</p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_160px]">
                        <div className="font-mono text-[10px] text-white/45">
                          REGIONS · <span className="text-cyan-100/70">{item.affectedRegions.join(" / ")}</span>
                        </div>
                        <div className="font-mono text-[10px] text-white/45">
                          SECTORS · <span className="text-cyan-100/70">{item.affectedSectors.join(" / ")}</span>
                        </div>
                        <div className="font-mono text-[10px] text-white/45">
                          IMPACT · <span className="text-cyan-200">{item.impactScore}</span>
                          <span className="ml-3 text-white/35">
                            CONF · {(item.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      {item.evidence.length > 0 && (
                        <ul className="mt-3 space-y-1 border-l border-cyan-300/20 pl-3">
                          {item.evidence.map((evidence, evidenceIndex) => (
                            <li
                              key={`${item.id}-${evidenceIndex}`}
                              className="text-xs leading-relaxed text-cyan-100/60"
                            >
                              {evidence}
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  </li>
                ))}
              </ol>
            </div>

            <footer className="border-t border-white/10 bg-black/40 px-7 py-3 font-mono text-[10px] tracking-widest text-white/35">
              PIPELINE · RSS / RSSHUB READY · FULLTEXT RESOLUTION · DEEPSEEK STRUCTURED EXTRACTION
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
