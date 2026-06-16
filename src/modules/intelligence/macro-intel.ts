import {
  fetchIntelligenceRssSources,
  type IntelligenceSourceFetchResult,
  type RawIntelligenceArticle,
} from "@/src/modules/intelligence/rss-fetcher";
import { getIntelligenceSourcesForModule } from "@/src/modules/intelligence/source-registry";

export type MacroEventType =
  | "policy"
  | "macro_data"
  | "trade"
  | "fiscal"
  | "capital_market"
  | "geopolitics";

export interface MacroIntelItem {
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
  publishedAt: string | null;
}

export interface RawMacroArticle extends RawIntelligenceArticle {
  id: number;
  score: number;
}

export interface MacroRawArticlePayload {
  generatedAt: string;
  sourceCount: number;
  successfulSourceCount: number;
  candidatesCount: number;
  items: RawMacroArticle[];
}

export interface MacroIntelPayload {
  generatedAt: string;
  sourceCount: number;
  successfulSourceCount: number;
  candidatesCount: number;
  llmEnabled: boolean;
  llmProvider: string | null;
  items: MacroIntelItem[];
}

interface BuildMacroPayloadOptions {
  now?: () => Date;
  fetchSources?: () => Promise<IntelligenceSourceFetchResult[]>;
}

const FETCH_TIMEOUT_MS = 12_000;
const MAX_CANDIDATES = 12;
const MAX_ITEMS = 4;
const MACRO_SOURCES = getIntelligenceSourcesForModule("macro-intel");

const MACRO_KEYWORDS = [
  "policy",
  "central bank",
  "tariff",
  "trade",
  "fiscal",
  "debt",
  "bond",
  "subsidy",
  "budget",
  "industrial",
  "manufacturing",
  "export",
  "import",
  "inflation",
  "credit",
  "property",
  "yuan",
  "renminbi",
  "china",
  "beijing",
  "asia",
  "geopolitical",
  "sanction",
];

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3).trim()}...`;
}

function scoreCandidate(candidate: RawIntelligenceArticle): number {
  const text = `${candidate.title} ${candidate.snippet}`.toLowerCase();
  const keywordScore = MACRO_KEYWORDS.reduce((score, keyword) => {
    return text.includes(keyword) ? score + 1 : score;
  }, 0);
  const recencyScore = candidate.publishedAt ? 2 : 0;

  return keywordScore * 10 + recencyScore;
}

function detectEventType(text: string): MacroEventType {
  const lower = text.toLowerCase();

  if (lower.includes("bond") || lower.includes("debt") || lower.includes("fiscal") || lower.includes("budget")) {
    return "fiscal";
  }
  if (lower.includes("export") || lower.includes("import") || lower.includes("tariff") || lower.includes("trade")) {
    return "trade";
  }
  if (lower.includes("market") || lower.includes("stocks") || lower.includes("capital") || lower.includes("yuan")) {
    return "capital_market";
  }
  if (lower.includes("inflation") || lower.includes("gdp") || lower.includes("credit")) {
    return "macro_data";
  }
  if (lower.includes("sanction") || lower.includes("war") || lower.includes("geopolitical")) {
    return "geopolitics";
  }

  return "policy";
}

function toMacroIntelItem(candidate: RawMacroArticle, index: number): MacroIntelItem {
  const text = `${candidate.title}. ${candidate.snippet}`;
  const eventType = detectEventType(text);
  const impactScore = Math.min(88, Math.max(55, candidate.score + 44));

  return {
    id: index + 1,
    title: candidate.title,
    source: candidate.source,
    url: candidate.url,
    eventType,
    coreLogic: truncate(candidate.snippet || candidate.title, 110),
    policyIntent:
      eventType === "fiscal"
        ? "Fiscal stance or funding conditions may be shifting; verify against primary data before acting."
        : "Signal requires primary-source verification; current extraction is heuristic until LLM extraction is enabled.",
    capitalImpact:
      eventType === "trade"
        ? "Trade-sensitive supply chains and exporters may reprice risk first."
        : "Capital impact is directional until evidence review and model extraction are enabled.",
    affectedRegions: text.toLowerCase().includes("china") ? ["China", "APAC"] : ["Global"],
    affectedSectors: eventType === "trade" ? ["trade", "manufacturing"] : ["macro"],
    timeHorizon: impactScore >= 80 ? "short" : "medium",
    confidence: 0.55,
    impactScore,
    evidence: [truncate(candidate.snippet || candidate.title, 140)],
    publishedAt: candidate.publishedAt,
  };
}

async function fetchMacroSourceResults(
  options: BuildMacroPayloadOptions = {}
): Promise<IntelligenceSourceFetchResult[]> {
  if (options.fetchSources) {
    return options.fetchSources();
  }

  return fetchIntelligenceRssSources({
    sources: MACRO_SOURCES,
    timeoutMs: FETCH_TIMEOUT_MS,
    userAgent: "Mozilla/5.0 (compatible; KnowledgeGalaxyMacroIntel/1.0)",
    logWarning: (message, error) => console.warn(message, error),
  });
}

async function getScoredCandidates(options: BuildMacroPayloadOptions = {}) {
  const sourceResults = await fetchMacroSourceResults(options);
  const candidates = sourceResults
    .flatMap((result) => result.articles)
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidate(candidate),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return String(b.publishedAt ?? "").localeCompare(String(a.publishedAt ?? ""));
    })
    .slice(0, MAX_CANDIDATES)
    .map((candidate, index) => ({
      id: index + 1,
      ...candidate,
    }));

  return {
    generatedAt: (options.now?.() ?? new Date()).toISOString(),
    sourceCount: MACRO_SOURCES.length,
    successfulSourceCount: sourceResults.filter((result) => result.articles.length > 0).length,
    candidates,
  };
}

export async function buildMacroRawArticlePayload(
  options: BuildMacroPayloadOptions = {}
): Promise<MacroRawArticlePayload> {
  const result = await getScoredCandidates(options);

  return {
    generatedAt: result.generatedAt,
    sourceCount: result.sourceCount,
    successfulSourceCount: result.successfulSourceCount,
    candidatesCount: result.candidates.length,
    items: result.candidates,
  };
}

export async function buildMacroIntelPayload(
  options: BuildMacroPayloadOptions = {}
): Promise<MacroIntelPayload> {
  const result = await getScoredCandidates(options);

  return {
    generatedAt: result.generatedAt,
    sourceCount: result.sourceCount,
    successfulSourceCount: result.successfulSourceCount,
    candidatesCount: result.candidates.length,
    llmEnabled: false,
    llmProvider: null,
    items: result.candidates.slice(0, MAX_ITEMS).map(toMacroIntelItem),
  };
}
