"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Box,
  Building2,
  ExternalLink,
  Factory,
  Lock,
  ShieldCheck,
  TrendingUp,
  X,
} from "lucide-react";
import { PLANETS } from "@/src/components/canvas/SolarSystem";

interface SunConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  onPlanetSelect?: (planetId: string) => void;
}

interface DataItem {
  id: number;
  label: string;
  value: string;
  variant?: "default" | "positive" | "warning" | "alert";
}

interface SupplyItem extends DataItem {
  icon: "port" | "factory" | "zone" | "chain" | "market" | "trade";
  subtitle: string;
  metricLabel: string;
  url?: string;
  publishedAt?: string | null;
}

interface MetricItem {
  key: "sourceCoverage" | "rawVolume" | "impactDensity" | "analystConfidence";
  label: string;
  detail: string;
  variant?: "default" | "positive";
  chart: "ring" | "line" | "bar";
}

interface MicroChartState {
  sourceCoverage: number;
  rawVolume: number[];
  impactDensity: number[];
  analystConfidence: number[];
}

interface SupplyPayload {
  generatedAt?: string;
  items?: unknown;
}

type MacroEventType =
  | "policy"
  | "macro_data"
  | "trade"
  | "fiscal"
  | "capital_market"
  | "geopolitics";

type MacroTimeHorizon = "short" | "medium" | "long";

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
  timeHorizon: MacroTimeHorizon;
  confidence: number;
  impactScore: number;
  evidence: string[];
  publishedAt?: string | null;
}

interface MacroIntelPayload {
  generatedAt?: string;
  sourceCount?: number;
  candidatesCount?: number;
  successfulSourceCount?: number;
  items?: unknown;
}

interface RawMacroPayload {
  generatedAt?: string;
  sourceCount?: number;
  candidatesCount?: number;
  successfulSourceCount?: number;
  items?: unknown;
}

type PlanetNavStatus = "online" | "standby";

interface PlanetNavItem {
  id: string;
  name: string;
  label: string;
  status: PlanetNavStatus;
  color: string;
  textureUrl?: string;
}

const PLANET_NAV_ITEMS: PlanetNavItem[] = PLANETS.map((planet) => {
  const hasMountedSystem = Boolean(planet.module) || planet.name === "Saturn";

  return {
    id: planet.name.toLowerCase(),
    name: planet.name,
    label:
      planet.name === "Saturn"
        ? "Macro Radar"
        : planet.label ?? "Module Placeholder",
    status: hasMountedSystem ? "online" : "standby",
    color: planet.color,
    textureUrl: planet.textureUrl,
  };
});

const PLANET_STATUS_LABEL: Record<PlanetNavStatus, string> = {
  online: "ONLINE",
  standby: "STANDBY",
};

const METRICS: MetricItem[] = [
  {
    key: "sourceCoverage",
    label: "SOURCE SYNC",
    detail: "Sources",
    variant: "positive",
    chart: "ring",
  },
  { key: "rawVolume", label: "RAW VOLUME", detail: "Candidates", chart: "line" },
  { key: "impactDensity", label: "IMPACT DENSITY", detail: "Score Buckets", chart: "bar" },
  { key: "analystConfidence", label: "ANALYST CONFIDENCE", detail: "LLM Evidence", chart: "bar" },
];

const INITIAL_MICRO_CHARTS: MicroChartState = {
  sourceCoverage: 0,
  rawVolume: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  impactDensity: [0, 0, 0, 0],
  analystConfidence: [0, 0, 0, 0],
};

const APAC_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const MACRO_INTEL_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

const CHAMFER_STYLE: CSSProperties = {
  clipPath:
    "polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px)",
};

const SMALL_CHAMFER_STYLE: CSSProperties = {
  clipPath:
    "polygon(9px 0, calc(100% - 9px) 0, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0 calc(100% - 9px), 0 9px)",
};

function valueClass(variant?: DataItem["variant"]) {
  switch (variant) {
    case "positive":
      return "text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.6)]";
    case "warning":
      return "text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]";
    case "alert":
      return "text-fuchsia-400 drop-shadow-[0_0_4px_rgba(232,121,249,0.6)]";
    default:
      return "text-slate-300";
  }
}

function supplyIcon(icon: SupplyItem["icon"]) {
  const iconClassName = "h-3.5 w-3.5";

  switch (icon) {
    case "port":
    case "trade":
      return <Building2 className={iconClassName} aria-hidden="true" />;
    case "factory":
      return <Factory className={iconClassName} aria-hidden="true" />;
    case "zone":
      return <Box className={iconClassName} aria-hidden="true" />;
    case "chain":
      return <Activity className={iconClassName} aria-hidden="true" />;
    case "market":
      return <BarChart3 className={iconClassName} aria-hidden="true" />;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSupplyIcon(value: unknown): value is SupplyItem["icon"] {
  return (
    value === "port" ||
    value === "factory" ||
    value === "zone" ||
    value === "chain" ||
    value === "market" ||
    value === "trade"
  );
}

function isDataVariant(value: unknown): value is DataItem["variant"] {
  return (
    value === undefined ||
    value === "default" ||
    value === "positive" ||
    value === "warning" ||
    value === "alert"
  );
}

function isSupplyItem(value: unknown): value is SupplyItem {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "number" &&
    typeof value.label === "string" &&
    typeof value.subtitle === "string" &&
    typeof value.value === "string" &&
    typeof value.metricLabel === "string" &&
    isSupplyIcon(value.icon) &&
    isDataVariant(value.variant) &&
    (value.url === undefined || typeof value.url === "string") &&
    (value.publishedAt === undefined ||
      value.publishedAt === null ||
      typeof value.publishedAt === "string")
  );
}

function isSupplyItemArray(value: unknown): value is SupplyItem[] {
  return Array.isArray(value) && value.every(isSupplyItem);
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

function isMacroTimeHorizon(value: unknown): value is MacroTimeHorizon {
  return value === "short" || value === "medium" || value === "long";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isMacroIntelItem(value: unknown): value is MacroIntelItem {
  if (!isRecord(value)) {
    return false;
  }

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
    isMacroTimeHorizon(value.timeHorizon) &&
    typeof value.confidence === "number" &&
    typeof value.impactScore === "number" &&
    isStringArray(value.evidence) &&
    (value.publishedAt === undefined ||
      value.publishedAt === null ||
      typeof value.publishedAt === "string")
  );
}

function isMacroIntelItemArray(value: unknown): value is MacroIntelItem[] {
  return Array.isArray(value) && value.every(isMacroIntelItem);
}

const BEIJING_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Asia/Shanghai",
});

const APAC_UPDATED_AT_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Shanghai",
});

function panelClassName(extra = "") {
  return `relative overflow-hidden border border-cyan-500/30 bg-slate-950/70 shadow-[0_0_28px_rgba(6,182,212,0.12),inset_0_0_32px_rgba(8,145,178,0.08)] ${extra}`;
}

const SVG_GLOW_CLASS = "drop-shadow-[0_0_4px_rgba(34,211,238,0.55)]";

function nextSeries(values: number[], min: number, max: number) {
  const last = values[values.length - 1] ?? min;
  const delta = ((Math.round(last * 10) * 13 + values.length * 7) % 19) - 9;
  const next = Math.min(max, Math.max(min, last + delta / 10));

  return [...values.slice(1), Number(next.toFixed(1))];
}

function nextIntegerSeries(values: number[], min: number, max: number) {
  const last = values[values.length - 1] ?? min;
  const delta = ((last * 11 + values.length * 5) % 5) - 2;
  const next = Math.min(max, Math.max(min, last + delta));

  return [...values.slice(1), next];
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function normalize(value: number, min: number, max: number) {
  if (max <= min) {
    return 0;
  }

  return (value - min) / (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function metricAverage(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return average(values);
}

function buildImpactDensity(items: MacroIntelItem[]) {
  const buckets = [0, 0, 0, 0];

  items.forEach((item) => {
    if (item.impactScore >= 90) {
      buckets[3] += 1;
    } else if (item.impactScore >= 80) {
      buckets[2] += 1;
    } else if (item.impactScore >= 70) {
      buckets[1] += 1;
    } else if (item.impactScore >= 60) {
      buckets[0] += 1;
    }
  });

  return buckets;
}

function buildConfidenceSeries(items: MacroIntelItem[]) {
  const values = items
    .map((item) => Math.round(clamp(item.confidence, 0, 1) * 100))
    .slice(0, 4);

  return values.length > 0 ? values : [0, 0, 0, 0];
}

function buildRawVolumeSeries(candidatesCount: number) {
  const base = Math.max(0, candidatesCount);

  return Array.from({ length: 9 }, (_, index) => {
    const offset = ((index * 7 + base) % 5) - 2;
    return Math.max(0, base + offset);
  });
}

function buildLinePath(values: number[], min: number, max: number) {
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 30 - normalize(value, min, max) * 22;

      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function formatApacUpdatedAt(value: string | null) {
  if (!value) {
    return "pending";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "pending";
  }

  return APAC_UPDATED_AT_FORMATTER.format(date);
}

function formatMacroGeneratedAt(value: string | null) {
  return formatApacUpdatedAt(value);
}

function hasReadableUrl(item: SupplyItem) {
  return typeof item.url === "string" && item.url.length > 0;
}

interface RingProgressChartProps {
  value: number;
}

function RingProgressChart({ value }: RingProgressChartProps) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - value / 100);

  return (
    <svg
      aria-label="Data sync circular progress chart"
      className={`h-12 w-full text-cyan-300 ${SVG_GLOW_CLASS}`}
      data-testid="micro-chart-ring"
      viewBox="0 0 64 64"
    >
      <circle
        className={SVG_GLOW_CLASS}
        cx="32"
        cy="32"
        fill="none"
        opacity="0.22"
        r={radius}
        stroke="currentColor"
        strokeWidth="5"
      />
      <circle
        className={SVG_GLOW_CLASS}
        cx="32"
        cy="32"
        fill="none"
        r={radius}
        stroke="currentColor"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        strokeWidth="5"
        transform="rotate(-90 32 32)"
      />
      <text
        className={SVG_GLOW_CLASS}
        fill="currentColor"
        fontFamily="monospace"
        fontSize="10"
        textAnchor="middle"
        x="32"
        y="36"
      >
        {value.toFixed(1)}%
      </text>
    </svg>
  );
}

interface LineMicroChartProps {
  values: number[];
  min: number;
  max: number;
}

function LineMicroChart({ values, min, max }: LineMicroChartProps) {
  const points = buildLinePath(values, min, max);

  return (
    <svg
      aria-label="Network latency line chart"
      className={`h-12 w-full text-cyan-300 ${SVG_GLOW_CLASS}`}
      data-testid="micro-chart-line"
      preserveAspectRatio="none"
      viewBox="0 0 100 34"
    >
      <path
        className={SVG_GLOW_CLASS}
        d="M0 29 H100"
        fill="none"
        opacity="0.2"
        stroke="currentColor"
        strokeWidth="1"
      />
      <polyline
        className={SVG_GLOW_CLASS}
        fill="none"
        points={points}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <polyline
        className={SVG_GLOW_CLASS}
        fill="none"
        opacity="0.24"
        points={points}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="6"
      />
    </svg>
  );
}

interface BarMicroChartProps {
  values: number[];
  min: number;
  max: number;
}

function BarMicroChart({ values, min, max }: BarMicroChartProps) {
  return (
    <svg
      aria-label="Telemetry bar chart"
      className={`h-12 w-full text-cyan-300 ${SVG_GLOW_CLASS}`}
      data-testid="micro-chart-bar"
      preserveAspectRatio="none"
      viewBox="0 0 100 34"
    >
      <path
        className={SVG_GLOW_CLASS}
        d="M0 31 H100"
        fill="none"
        opacity="0.18"
        stroke="currentColor"
        strokeWidth="1"
      />
      {values.map((value, index) => {
        const normalized = clamp(normalize(value, min, max), 0, 1);
        const height = 5 + normalized * 24;
        const slotWidth = 100 / Math.max(values.length, 1);
        const width = Math.min(10, Math.max(6, slotWidth * 0.46));
        const x = index * slotWidth + (slotWidth - width) / 2;
        const y = 31 - height;

        return (
          <rect
            key={`${value}-${index}`}
            className={SVG_GLOW_CLASS}
            fill="currentColor"
            height={height}
            opacity={0.42 + index / values.length / 2}
            rx="1"
            width="6"
            x={x}
            y={y}
          />
        );
      })}
    </svg>
  );
}

export function SunConsole({ isOpen, onClose, onPlanetSelect }: SunConsoleProps) {
  const [hoveredPlanetId, setHoveredPlanetId] = useState<string | null>(null);
  const [macroIntelItems, setMacroIntelItems] = useState<MacroIntelItem[]>([]);
  const [macroIntelGeneratedAt, setMacroIntelGeneratedAt] = useState<string | null>(null);
  const [supplyItems, setSupplyItems] = useState<SupplyItem[]>([]);
  const [supplyGeneratedAt, setSupplyGeneratedAt] = useState<string | null>(null);
  const [beijingTime, setBeijingTime] = useState(() =>
    BEIJING_TIME_FORMATTER.format(new Date())
  );
  const [microCharts, setMicroCharts] = useState<MicroChartState>(
    INITIAL_MICRO_CHARTS
  );

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setBeijingTime(BEIJING_TIME_FORMATTER.format(new Date()));
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    if (!isOpen || typeof fetch !== "function") {
      return;
    }

    let isDisposed = false;
    let controller: AbortController | null = null;

    async function loadSupplyChainData() {
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;

      try {
        const timestamp = Date.now();
        const response = await fetch(`/api/apac-supply-chain?t=${timestamp}`, {
          cache: "no-store",
          signal: requestController.signal,
        });
        if (!response.ok) {
          throw new Error(`APAC API returned ${response.status}`);
        }

        const apiPayload = (await response.json()) as SupplyPayload;
        const apiItems = isSupplyItemArray(apiPayload.items)
          ? apiPayload.items.filter(hasReadableUrl)
          : [];

        if (!isDisposed) {
          setSupplyItems(apiItems);
          setSupplyGeneratedAt(
            typeof apiPayload?.generatedAt === "string"
              ? apiPayload.generatedAt
              : new Date().toISOString()
          );
        }
      } catch (error) {
        if (!requestController.signal.aborted && !isDisposed) {
          console.warn("[SunConsole] APAC supply-chain data unavailable", error);
          setSupplyItems([]);
          setSupplyGeneratedAt(null);
        }
      }
    }

    loadSupplyChainData();
    const refreshTimerId = window.setInterval(
      loadSupplyChainData,
      APAC_REFRESH_INTERVAL_MS
    );

    return () => {
      isDisposed = true;
      window.clearInterval(refreshTimerId);
      controller?.abort();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof fetch !== "function") {
      return;
    }

    let isDisposed = false;
    let controller: AbortController | null = null;

    async function loadMacroIntelData() {
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;

      try {
        const timestamp = Date.now();
        const [intelResponse, rawResponse] = await Promise.all([
          fetch(`/data/macro-intel.json?t=${timestamp}`, {
            cache: "no-store",
            signal: requestController.signal,
          }),
          fetch(`/data/macro-raw-articles.json?t=${timestamp}`, {
            cache: "no-store",
            signal: requestController.signal,
          }),
        ]);
        if (!intelResponse.ok) {
          throw new Error(`Macro intel feed returned ${intelResponse.status}`);
        }
        if (!rawResponse.ok) {
          throw new Error(`Raw macro article feed returned ${rawResponse.status}`);
        }

        const payload = (await intelResponse.json()) as MacroIntelPayload;
        const rawPayload = (await rawResponse.json()) as RawMacroPayload;
        const items = isMacroIntelItemArray(payload.items) ? payload.items : [];
        const sourceCount =
          typeof rawPayload.sourceCount === "number"
            ? rawPayload.sourceCount
            : typeof payload.sourceCount === "number"
              ? payload.sourceCount
              : 0;
        const successfulSourceCount =
          typeof rawPayload.successfulSourceCount === "number"
            ? rawPayload.successfulSourceCount
            : typeof payload.successfulSourceCount === "number"
              ? payload.successfulSourceCount
              : sourceCount > 0
                ? sourceCount
                : 0;
        const candidatesCount =
          typeof rawPayload.candidatesCount === "number"
            ? rawPayload.candidatesCount
            : typeof payload.candidatesCount === "number"
              ? payload.candidatesCount
              : items.length;
        const sourceCoverage =
          sourceCount > 0
            ? Number(((successfulSourceCount / sourceCount) * 100).toFixed(1))
            : 0;

        if (!isDisposed) {
          setMacroIntelItems(items.slice(0, 4));
          setMicroCharts({
            sourceCoverage: clamp(sourceCoverage, 0, 100),
            rawVolume: buildRawVolumeSeries(candidatesCount),
            impactDensity: buildImpactDensity(items),
            analystConfidence: buildConfidenceSeries(items),
          });
          setMacroIntelGeneratedAt(
            typeof payload.generatedAt === "string"
              ? payload.generatedAt
              : new Date().toISOString()
          );
        }
      } catch (error) {
        if (!requestController.signal.aborted && !isDisposed) {
          console.warn("[SunConsole] macro intelligence feed unavailable", error);
          setMacroIntelItems([]);
          setMacroIntelGeneratedAt(null);
        }
      }
    }

    loadMacroIntelData();
    const refreshTimerId = window.setInterval(
      loadMacroIntelData,
      MACRO_INTEL_REFRESH_INTERVAL_MS
    );

    return () => {
      isDisposed = true;
      window.clearInterval(refreshTimerId);
      controller?.abort();
    };
  }, [isOpen]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setMicroCharts((current) => ({
        sourceCoverage: current.sourceCoverage,
        rawVolume: nextIntegerSeries(
          current.rawVolume,
          0,
          Math.max(12, Math.max(...current.rawVolume) + 2)
        ),
        impactDensity: current.impactDensity.map((value, index) => {
          const direction = ((current.rawVolume.at(-1) ?? 0) + index) % 2 === 0 ? 1 : -1;
          return clamp(value + direction, 0, Math.max(4, ...current.impactDensity));
        }),
        analystConfidence: nextSeries(current.analystConfidence, 0, 100),
      }));
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          aria-modal="true"
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4 py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          role="dialog"
        >
          <motion.div
            className="relative flex h-[94vh] w-full max-w-[1600px] flex-col overflow-hidden border border-cyan-400/60 bg-[#020914]/95 p-3 text-slate-100 shadow-[0_0_60px_rgba(6,182,212,0.18),inset_0_0_80px_rgba(8,47,73,0.45)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={(event) => event.stopPropagation()}
            style={CHAMFER_STYLE}
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.035)_1px,transparent_1px)] bg-[size:38px_38px]" />
            <div className="relative mb-2 flex shrink-0 items-center justify-between border-b border-cyan-500/20 pb-2">
              <div className="flex items-center gap-3">
                <div
                  className="grid h-10 w-10 place-items-center border border-cyan-400/40 bg-cyan-400/10 shadow-[0_0_24px_rgba(34,211,238,0.2)]"
                  style={SMALL_CHAMFER_STYLE}
                >
                  <ShieldCheck className="h-6 w-6 text-cyan-300" aria-hidden="true" />
                </div>
                <div>
                  <div className="font-mono text-xl tracking-wide text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.75)]">
                    主控台 / <span className="text-slate-200">CONTROL PANEL</span>
                  </div>
                  <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-cyan-200/55">
                    Central Command • System Override
                  </div>
                </div>
              </div>

              <div className="hidden min-w-0 flex-1 items-center justify-center gap-8 px-6 font-mono text-[9px] uppercase tracking-widest text-slate-400 lg:flex">
                <span>
                  System Status <span className="ml-2 text-emerald-400">● NOMINAL</span>
                </span>
                <span>
                  Time (BJT) <span className="ml-2 text-slate-200">{beijingTime}</span>
                </span>
                <span>
                  User: <span className="ml-2 text-slate-200">COMMANDER_01</span>
                </span>
              </div>

              <button
                aria-label="Close console"
                className="grid h-8 w-14 place-items-center border border-cyan-500/30 bg-cyan-950/20 font-mono text-xs text-cyan-300 transition-all duration-200 hover:border-cyan-300 hover:bg-cyan-500/20 hover:text-cyan-100"
                onClick={onClose}
                style={SMALL_CHAMFER_STYLE}
                type="button"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-auto xl:flex-row xl:overflow-hidden">
              <aside
                aria-label="Planet navigation"
                className={panelClassName("flex min-h-[420px] w-full shrink-0 flex-col p-2 xl:min-h-0 xl:w-[330px] 2xl:w-[360px]")}
                data-testid="planet-nav-sidebar"
                style={CHAMFER_STYLE}
              >
                <div className="mb-2 flex items-center justify-between border-b border-cyan-500/20 px-1.5 pb-2">
                  <h2 className="font-mono text-xs tracking-wider text-cyan-300">
                    行星导航 / PLANET NAV
                  </h2>
                  <span className="font-mono text-[8px] uppercase tracking-widest text-slate-500">
                    Fleet Index
                  </span>
                </div>

                <div className="min-h-0 flex-1 overflow-auto px-1">
                  <ul className="space-y-1.5">
                    {PLANET_NAV_ITEMS.map((planet) => (
                      <li key={planet.id}>
                        <button
                          aria-label={`Navigate to ${planet.name}`}
                          className={`group grid h-[52px] w-full grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2 border px-2 text-left transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-cyan-300/80 ${
                            hoveredPlanetId === planet.id
                              ? "border-cyan-300/80 bg-cyan-400/10 shadow-[0_0_22px_rgba(34,211,238,0.28),inset_0_0_18px_rgba(34,211,238,0.08)]"
                              : "border-cyan-900/60 bg-slate-950/55 hover:border-cyan-500/70 hover:bg-cyan-500/10"
                          }`}
                          onClick={() => onPlanetSelect?.(planet.id)}
                          onMouseEnter={() => setHoveredPlanetId(planet.id)}
                          onMouseLeave={() => setHoveredPlanetId(null)}
                          style={SMALL_CHAMFER_STYLE}
                          type="button"
                        >
                          <span
                            aria-hidden="true"
                            className="h-8 w-8 rounded-full border border-cyan-300/20 bg-cover bg-center shadow-[0_0_14px_currentColor]"
                            style={{
                              backgroundColor: planet.color,
                              backgroundImage: planet.textureUrl ? `url(${planet.textureUrl})` : undefined,
                              color: planet.color,
                            }}
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-mono text-[12px] uppercase tracking-wide text-slate-200 group-hover:text-cyan-100">
                              {planet.name}
                            </span>
                            <span className="block truncate font-mono text-[9px] text-slate-500">
                              {planet.label}
                            </span>
                          </span>
                          <span
                            className={`flex w-[60px] items-center justify-end gap-1 font-mono text-[8px] ${
                              planet.status === "online"
                                ? "text-emerald-400"
                                : "text-slate-500"
                            }`}
                          >
                            <span>{PLANET_STATUS_LABEL[planet.status]}</span>
                            <span className="inline-block w-[6px] text-cyan-300">
                              {hoveredPlanetId === planet.id ? ">" : ""}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div
                  className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border border-cyan-500/20 bg-slate-950/70 p-2"
                  style={SMALL_CHAMFER_STYLE}
                >
                  <div>
                    <div className="font-mono text-[8px] uppercase tracking-widest text-cyan-300">舰队状态 / Fleet Status</div>
                    <div className="mt-2 font-mono text-2xl text-cyan-300">07<span className="text-xs text-slate-500"> /12</span></div>
                  </div>
                  <div className="relative h-11 w-11 rounded-full border-[7px] border-cyan-400 border-r-slate-800 border-t-cyan-700 shadow-[0_0_20px_rgba(34,211,238,0.25)]" />
                  <div>
                    <div className="font-mono text-[8px] uppercase tracking-widest text-slate-500">System Health</div>
                    <div className="mt-1 font-mono text-xl text-emerald-300">98.7%</div>
                    <svg
                      aria-hidden="true"
                      className="mt-1 h-4 w-full overflow-visible text-cyan-300 drop-shadow-[0_0_4px_rgba(34,211,238,0.45)]"
                      data-testid="fleet-health-waveform"
                      preserveAspectRatio="none"
                      viewBox="0 0 96 18"
                    >
                      <path
                        d="M0 12 L8 12 L13 8 L18 14 L24 5 L30 12 L37 12 L43 3 L50 15 L57 9 L64 12 L71 6 L78 13 L85 10 L91 12 L96 12"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.7"
                      />
                      <path
                        d="M0 12 L8 12 L13 8 L18 14 L24 5 L30 12 L37 12 L43 3 L50 15 L57 9 L64 12 L71 6 L78 13 L85 10 L91 12 L96 12"
                        fill="none"
                        opacity="0.22"
                        stroke="currentColor"
                        strokeWidth="5"
                      />
                    </svg>
                  </div>
                </div>
              </aside>

              <main
                className="grid min-h-[700px] min-w-0 flex-1 grid-cols-1 gap-3 overflow-visible xl:min-h-0 xl:grid-cols-[1.05fr_0.95fr] xl:overflow-hidden"
                data-testid="sun-console-main"
              >
                <section
                  className={panelClassName("grid min-h-0 min-w-0 grid-rows-[30px_minmax(0,1fr)_104px] gap-2.5 p-3")}
                  style={CHAMFER_STYLE}
                >
                  <div className="flex items-center justify-between border-b border-cyan-500/20">
                    <h2 className="font-mono text-xs tracking-wider text-cyan-300">信息板 / INTELLIGENCE BOARD</h2>
                    <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-widest text-slate-500">
                      Updated {formatMacroGeneratedAt(macroIntelGeneratedAt)} BJT
                      <Activity className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                    </span>
                  </div>

                  <ul className="space-y-1.5 overflow-hidden">
                    {macroIntelItems.length > 0 ? (
                      macroIntelItems.map((item) => (
                        <li key={item.id}>
                          <a
                            aria-label={`Read macro intelligence source: ${item.title}`}
                            className="flex h-[33px] items-center border border-cyan-900/40 bg-slate-950/45 px-2.5 font-mono text-[10px] text-cyan-100 transition-all duration-200 hover:border-cyan-400/70 hover:bg-cyan-500/10 focus:outline-none focus:ring-1 focus:ring-cyan-300/80"
                            href={item.url}
                            rel="noreferrer"
                            style={SMALL_CHAMFER_STYLE}
                            target="_blank"
                          >
                            <span className="truncate">{item.title}</span>
                          </a>
                        </li>
                      ))
                    ) : (
                      <li
                        className="grid h-[33px] grid-cols-[58px_minmax(0,1fr)_72px] items-center gap-2 border border-cyan-900/40 bg-slate-950/45 px-2.5 font-mono text-[10px]"
                        style={SMALL_CHAMFER_STYLE}
                      >
                        <span className="grid h-4 place-items-center border border-cyan-400/40 text-[8px] text-cyan-300">
                          IDLE
                        </span>
                        <span className="truncate text-slate-400">
                          Awaiting macro intelligence pipeline output
                        </span>
                        <span className="text-right text-[8px] text-slate-600">No Signal</span>
                      </li>
                    )}
                  </ul>

                  <div className="grid min-h-0 grid-cols-2 gap-2 lg:grid-cols-4">
                    {METRICS.map((metric) => {
                      const rawVolumeMax = Math.max(12, ...microCharts.rawVolume);
                      const impactMax = Math.max(4, ...microCharts.impactDensity);
                      const value =
                        metric.key === "sourceCoverage"
                          ? `${microCharts.sourceCoverage.toFixed(1)}%`
                          : metric.key === "rawVolume"
                            ? `${microCharts.rawVolume.at(-1) ?? 0} raw`
                            : metric.key === "impactDensity"
                              ? `${microCharts.impactDensity.reduce((total, count) => total + count, 0)} sig`
                              : `${Math.round(metricAverage(microCharts.analystConfidence))}%`;
                      const chart =
                        metric.key === "sourceCoverage" ? (
                          <RingProgressChart value={microCharts.sourceCoverage} />
                        ) : metric.key === "rawVolume" ? (
                          <LineMicroChart values={microCharts.rawVolume} min={0} max={rawVolumeMax} />
                        ) : metric.key === "impactDensity" ? (
                          <BarMicroChart values={microCharts.impactDensity} min={0} max={impactMax} />
                        ) : (
                          <BarMicroChart values={microCharts.analystConfidence} min={0} max={100} />
                        );

                      return (
                        <div
                          key={metric.label}
                          className="border border-cyan-900/50 bg-slate-950/70 p-2"
                          style={SMALL_CHAMFER_STYLE}
                        >
                          <div className="whitespace-nowrap font-mono text-[7px] uppercase tracking-[0.12em] text-slate-500">{metric.label}</div>
                          <div className={`mt-1 font-mono text-[17px] leading-none ${metric.variant === "positive" ? "text-emerald-300" : "text-cyan-300"}`}>{value}</div>
                          <div className="mt-1">{chart}</div>
                          <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-slate-600">{metric.detail}</div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_128px] gap-3">
                  <div
                    className={panelClassName("grid min-h-0 grid-rows-[30px_130px_minmax(0,1fr)] gap-2.5 p-3")}
                    style={CHAMFER_STYLE}
                  >
                    <div className="flex items-center justify-between border-b border-cyan-500/20">
                      <h2 className="font-mono text-xs tracking-wider text-cyan-300">APAC / SUPPLY CHAIN</h2>
                      <span className="font-mono text-[8px] uppercase tracking-widest text-slate-500">
                        Updated {formatApacUpdatedAt(supplyGeneratedAt)} BJT
                      </span>
                    </div>

                    <div
                      className="relative overflow-hidden border border-cyan-900/50 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.26),transparent_34%),linear-gradient(135deg,rgba(34,211,238,0.04),rgba(8,47,73,0.16))]"
                      style={SMALL_CHAMFER_STYLE}
                    >
                      <div className="absolute inset-x-6 bottom-5 h-px bg-cyan-400/30" />
                      <div className="absolute bottom-5 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full border border-cyan-300/60 shadow-[0_0_35px_rgba(34,211,238,0.55)]" />
                      {[18, 32, 45, 58, 72, 84].map((left, index) => (
                        <span
                          key={left}
                          className="absolute bottom-5 w-3 bg-cyan-300/35 shadow-[0_0_12px_rgba(34,211,238,0.45)]"
                          style={{ left: `${left}%`, height: `${28 + (index % 3) * 18}px` }}
                        />
                      ))}
                      <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-200 shadow-[0_0_28px_10px_rgba(34,211,238,0.42)]" />
                    </div>

                    <ul className="min-h-0 space-y-1 overflow-hidden">
                      {supplyItems.map((item) => {
                        const rowContent = (
                          <>
                            <span className="grid h-7 w-7 place-items-center border border-cyan-500/35 bg-cyan-500/10 text-cyan-300">
                              {supplyIcon(item.icon)}
                            </span>
                            <span className="min-w-0">
                              <span className="flex min-w-0 items-center gap-1 text-xs text-slate-200">
                                <span className="truncate">{item.label}</span>
                                {item.url ? (
                                  <ExternalLink
                                    aria-hidden="true"
                                    className="h-3 w-3 shrink-0 text-cyan-300/70"
                                  />
                                ) : null}
                              </span>
                              <span className="block truncate font-mono text-[9px] text-slate-500">{item.subtitle}</span>
                            </span>
                            <span
                              className={`min-w-0 text-right font-mono text-[10px] ${valueClass(item.variant)}`}
                            >
                              <span className="block truncate">{item.value}</span>
                              <span className="block truncate text-[9px] text-slate-500">{item.metricLabel}</span>
                            </span>
                          </>
                        );

                        return (
                          <li key={item.id}>
                            {item.url ? (
                              <a
                                aria-label={`Read APAC supply-chain article: ${item.value}`}
                                className="grid h-[43px] grid-cols-[30px_minmax(0,1fr)_minmax(132px,auto)] items-center gap-2 border border-cyan-900/50 bg-slate-950/55 px-2.5 transition-all duration-200 hover:border-cyan-400/70 hover:bg-cyan-500/10 hover:shadow-[0_0_18px_rgba(34,211,238,0.18)] focus:outline-none focus:ring-1 focus:ring-cyan-300/80"
                                href={item.url}
                                rel="noreferrer"
                                style={SMALL_CHAMFER_STYLE}
                                target="_blank"
                              >
                                {rowContent}
                              </a>
                            ) : (
                              <div
                                className="grid h-[43px] grid-cols-[30px_minmax(0,1fr)_minmax(132px,auto)] items-center gap-2 border border-cyan-900/50 bg-slate-950/55 px-2.5"
                                style={SMALL_CHAMFER_STYLE}
                              >
                                {rowContent}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div
                    className={panelClassName("grid grid-cols-[96px_minmax(0,1fr)] gap-3 p-3")}
                    style={CHAMFER_STYLE}
                  >
                    <div className="grid place-items-center">
                      <div className="grid h-16 w-16 place-items-center rounded-full border-[7px] border-emerald-300 border-r-cyan-950 bg-emerald-400/10 font-mono text-xl text-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.24)]">
                        92%
                      </div>
                      <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-slate-500">Health Index</div>
                    </div>
                    <div>
                      <div className="font-mono text-[11px] uppercase tracking-wider text-cyan-300">供应链健康度 / Supply Chain Health</div>
                      <div className="mt-3 flex h-16 items-end gap-2 border-b border-l border-cyan-900/60 px-2">
                        {[52, 36, 68, 54, 31, 28, 38, 24, 42, 72].map((height, index) => (
                          <span key={index} className="relative h-full flex-1">
                            <span
                              className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.75)]"
                              style={{ bottom: `${height}%` }}
                            />
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </main>
            </div>

            <div className="relative mt-2 flex shrink-0 items-center justify-center gap-8 border-t border-cyan-500/20 pt-1.5 font-mono text-[8px] uppercase tracking-[0.3em] text-cyan-300/60">
              <span>Information is Power</span>
              <span className="hidden items-center gap-2 lg:flex"><Lock className="h-3 w-3" aria-hidden="true" /> Data Encrypted</span>
              <span className="hidden items-center gap-2 lg:flex"><TrendingUp className="h-3 w-3" aria-hidden="true" /> Secure Channel Active</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
