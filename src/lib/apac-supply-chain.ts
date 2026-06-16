import {
  fetchIntelligenceRssSources,
  type RawIntelligenceArticle,
} from "@/src/modules/intelligence/rss-fetcher";
import { getIntelligenceSourcesForModule } from "@/src/modules/intelligence/source-registry";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_ITEMS = 6;

const APAC_SOURCES = getIntelligenceSourcesForModule("apac-supply-chain");

const SUPPLY_KEYWORD_WEIGHTS = [
  ["supply chain", 8],
  ["shipping", 7],
  ["shipment", 7],
  ["shipments", 7],
  ["container", 7],
  ["cargo", 7],
  ["port", 7],
  ["export", 6],
  ["import", 6],
  ["logistics", 6],
  ["freight", 6],
  ["factory", 5],
  ["manufacturing", 5],
  ["semiconductor", 5],
  ["tariff", 5],
  ["trade", 5],
  ["coal", 4],
  ["copper", 4],
  ["newbuild", 4],
  ["newbuilds", 4],
  ["warehouse", 4],
  ["customs", 4],
  ["red sea", 4],
  ["congestion", 4],
  ["disruption", 4],
  ["strike", 4],
] satisfies [string, number][];

const APAC_KEYWORD_WEIGHTS = [
  ["china", 3],
  ["japan", 3],
  ["korea", 3],
  ["singapore", 3],
  ["india", 3],
  ["vietnam", 3],
  ["taiwan", 3],
  ["hong kong", 3],
  ["shenzhen", 3],
  ["shanghai", 3],
  ["malaysia", 3],
  ["thailand", 3],
  ["indonesia", 3],
  ["philippines", 3],
  ["australia", 2],
  ["asia", 2],
  ["apac", 2],
] satisfies [string, number][];

export type SupplyIcon = "port" | "factory" | "zone" | "chain" | "market" | "trade";
export type SupplyVariant = "default" | "positive" | "warning" | "alert";

export interface ApacSupplyItem {
  articleId?: string;
  id: number;
  label: string;
  subtitle: string;
  value: string;
  metricLabel: string;
  icon: SupplyIcon;
  variant?: SupplyVariant;
  url?: string;
  publishedAt?: string | null;
}

export interface ApacSupplyPayload {
  generatedAt: string;
  sourceCount: number;
  candidatesCount: number;
  items: ApacSupplyItem[];
}

export interface ApacSourceArticle extends RawIntelligenceArticle {
  articleId?: string;
}

type Candidate = ApacSourceArticle;

const FALLBACK_ITEMS: ApacSupplyItem[] = [
  {
    id: 1,
    label: "深圳港",
    subtitle: "Shenzhen Port",
    value: "Awaiting live crawl result",
    metricLabel: "Throughput",
    icon: "port",
  },
  {
    id: 2,
    label: "苏州工业园",
    subtitle: "Suzhou Industrial Park",
    value: "Awaiting live crawl result",
    metricLabel: "FDI Inflow",
    icon: "factory",
  },
  {
    id: 3,
    label: "上海出口加工区",
    subtitle: "Shanghai Export Processing Zone",
    value: "Awaiting live crawl result",
    metricLabel: "Logistics Status",
    icon: "zone",
  },
  {
    id: 4,
    label: "东莞供应链",
    subtitle: "Dongguan Supply Chain",
    value: "Awaiting live crawl result",
    metricLabel: "Alert: Interruption",
    icon: "chain",
    variant: "warning",
  },
  {
    id: 5,
    label: "义乌小商品",
    subtitle: "Yiwu Commodities",
    value: "Awaiting live crawl result",
    metricLabel: "Price Index",
    icon: "market",
  },
  {
    id: 6,
    label: "香港自贸港",
    subtitle: "Hong Kong FTZ",
    value: "Awaiting live crawl result",
    metricLabel: "Maritime Traffic",
    icon: "trade",
  },
];

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trim()}...`;
}

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function scoreCandidate(candidate: Candidate) {
  const haystack = `${candidate.title} ${candidate.snippet}`.toLowerCase();
  const title = candidate.title.toLowerCase();
  const supplyScore = SUPPLY_KEYWORD_WEIGHTS.reduce((score, [keyword, weight]) => {
    return haystack.includes(keyword) ? score + weight : score;
  }, 0);
  const titleSupplyScore = SUPPLY_KEYWORD_WEIGHTS.reduce((score, [keyword, weight]) => {
    return title.includes(keyword) ? score + weight : score;
  }, 0);
  const apacScore = APAC_KEYWORD_WEIGHTS.reduce((score, [keyword, weight]) => {
    return haystack.includes(keyword) ? score + weight : score;
  }, 0);
  const titleApacScore = APAC_KEYWORD_WEIGHTS.reduce((score, [keyword, weight]) => {
    return title.includes(keyword) ? score + weight : score;
  }, 0);

  if (titleApacScore === 0 || titleSupplyScore === 0 || apacScore === 0 || supplyScore === 0) {
    return 0;
  }

  return supplyScore + titleSupplyScore + apacScore + titleApacScore;
}

function detectIcon(candidate: Candidate): SupplyIcon {
  const text = `${candidate.title} ${candidate.snippet}`.toLowerCase();

  if (text.includes("port") || text.includes("shipping") || text.includes("container")) {
    return "port";
  }
  if (text.includes("factory") || text.includes("manufacturing") || text.includes("industrial")) {
    return "factory";
  }
  if (text.includes("export") || text.includes("customs")) {
    return "zone";
  }
  if (text.includes("disruption") || text.includes("strike") || text.includes("congestion")) {
    return "chain";
  }
  if (text.includes("price") || text.includes("tariff") || text.includes("commodity")) {
    return "market";
  }

  return "trade";
}

function detectVariant(candidate: Candidate): SupplyVariant | undefined {
  const text = `${candidate.title} ${candidate.snippet}`.toLowerCase();

  if (
    text.includes("disruption") ||
    text.includes("strike") ||
    text.includes("delay") ||
    text.includes("congestion") ||
    text.includes("tariff")
  ) {
    return "warning";
  }

  if (
    text.includes("growth") ||
    text.includes("increase") ||
    text.includes("rebound") ||
    text.includes("record") ||
    text.includes("expansion")
  ) {
    return "positive";
  }

  return undefined;
}

function detectLabel(candidate: Candidate) {
  const text = `${candidate.title} ${candidate.snippet}`.toLowerCase();

  if (text.includes("shenzhen")) return "深圳港";
  if (text.includes("shanghai")) return "上海出口加工区";
  if (text.includes("hong kong")) return "香港自贸港";
  if (text.includes("singapore")) return "新加坡枢纽";
  if (text.includes("taiwan")) return "台湾制造链";
  if (text.includes("korea")) return "韩国制造链";
  if (text.includes("japan")) return "日本供应链";
  if (text.includes("vietnam")) return "越南制造链";
  if (text.includes("india")) return "印度物流链";
  if (text.includes("china")) return "中国供应链";
  if (text.includes("port") || text.includes("shipping")) return "亚太航运";
  if (text.includes("semiconductor")) return "半导体链";
  if (text.includes("factory") || text.includes("manufacturing")) return "制造业链";

  return "APAC Supply";
}

function metricLabelFor(icon: SupplyIcon) {
  switch (icon) {
    case "port":
      return "Maritime Signal";
    case "factory":
      return "Manufacturing Signal";
    case "zone":
      return "Trade Flow";
    case "chain":
      return "Supply Risk";
    case "market":
      return "Price / Tariff";
    case "trade":
      return "Regional Trade";
  }
}

function toSupplyItem(candidate: Candidate, index: number): ApacSupplyItem {
  const icon = detectIcon(candidate);
  const variant = detectVariant(candidate);

  return {
    articleId: candidate.articleId,
    id: index + 1,
    label: detectLabel(candidate),
    subtitle: `${candidate.source} · ${hostnameOf(candidate.url)}`,
    value: truncate(candidate.title, 44),
    metricLabel: metricLabelFor(icon),
    icon,
    ...(variant ? { variant } : {}),
    url: candidate.url,
    publishedAt: candidate.publishedAt,
  };
}

export function buildApacSupplyChainPayloadFromArticles(input: {
  articles: ApacSourceArticle[];
  generatedAt: string;
  sourceCount: number;
}): ApacSupplyPayload {
  const candidates = input.articles
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
    });

  const selected = candidates.slice(0, MAX_ITEMS).map(toSupplyItem);
  const fallbackTail = FALLBACK_ITEMS.slice(selected.length, MAX_ITEMS);
  const items = [...selected, ...fallbackTail].map((item, index) => ({
    ...item,
    id: index + 1,
  }));

  return {
    generatedAt: input.generatedAt,
    sourceCount: input.sourceCount,
    candidatesCount: candidates.length,
    items,
  };
}

export async function buildApacSupplyChainPayload(): Promise<ApacSupplyPayload> {
  const feedResults = await fetchIntelligenceRssSources({
    sources: APAC_SOURCES,
    timeoutMs: FETCH_TIMEOUT_MS,
    userAgent: "Mozilla/5.0 (compatible; KnowledgeGalaxySupplyChainCrawler/1.0)",
    logWarning: (message, error) => console.warn(message, error),
  });
  return buildApacSupplyChainPayloadFromArticles({
    generatedAt: new Date().toISOString(),
    sourceCount: APAC_SOURCES.length,
    articles: feedResults.flatMap((result) => result.articles),
  });
}
