export type SocialSignalSourceType =
  | "post"
  | "thread"
  | "user"
  | "trend"
  | "news_story"
  | "media"
  | "space";

export type SocialSignalDomain =
  | "macro"
  | "politics"
  | "society"
  | "history"
  | "trade"
  | "finance"
  | "investment"
  | "geopolitics";

export type SocialSignalActorType =
  | "official"
  | "media"
  | "analyst"
  | "trader"
  | "academic"
  | "think_tank"
  | "citizen"
  | "anonymous"
  | "verified_account"
  | "unknown";

export type SocialSignalType =
  | "breaking"
  | "policy_hint"
  | "market_reaction"
  | "rumor"
  | "sentiment"
  | "data_release"
  | "narrative_shift";

export type SocialSignalStance = "positive" | "negative" | "neutral" | "mixed" | "unclear";
export type SocialSignalConfidence = "low" | "medium" | "high";
export type SocialSignalUrgency = "low" | "medium" | "high";
export type SocialSignalTimeHorizon = "intraday" | "weekly" | "monthly" | "structural";
export type SocialSignalRegionScope = "china" | "us_china" | "eu_china" | "apac" | "global";
export type SocialSignalProcessingState = "raw" | "enriched" | "summarized" | "archived" | "ignored";
export type SocialSignalCaptureMethod =
  | "recent_search"
  | "filtered_stream"
  | "full_archive"
  | "trends"
  | "news"
  | "spaces"
  | "xai_x_search";

export interface SocialSignalItem {
  externalId: string;
  sourceType: SocialSignalSourceType;
  title: string;
  body: string;
  url: string;
  authorId: string | null;
  authorUsername: string | null;
  authorDisplayName: string | null;
  actorType: SocialSignalActorType;
  publishedAt: string | null;
  capturedAt: string;
  domains: SocialSignalDomain[];
  topicTags: string[];
  regionScope: SocialSignalRegionScope;
  signalType: SocialSignalType;
  stance: SocialSignalStance;
  confidence: SocialSignalConfidence;
  urgency: SocialSignalUrgency;
  timeHorizon: SocialSignalTimeHorizon;
  language: string | null;
  captureMethod: SocialSignalCaptureMethod;
  processingState: SocialSignalProcessingState;
  engagementScore: number;
  mediaUrls: string[];
  rawPayload: Json;
  watchRuleId: string | null;
}

export interface XWatchRule {
  id: string;
  label: string;
  query: string;
  domains: SocialSignalDomain[];
}

export interface SignalBoardSummary {
  id: SocialSignalDomain;
  label: string;
  description: string;
  itemCount: number;
  highUrgencyCount: number;
}

interface NormalizeOptions {
  capturedAt: string;
  watchRuleId?: string;
}

interface XPostRecord {
  id: string;
  text: string;
  authorId: string | null;
  createdAt: string | null;
  lang: string | null;
  metrics: {
    retweets: number;
    replies: number;
    likes: number;
    quotes: number;
  };
  mediaKeys: string[];
  raw: Record<string, unknown>;
}

interface XUserRecord {
  id: string;
  name: string | null;
  username: string | null;
  verified: boolean;
}

interface XMediaRecord {
  mediaKey: string;
  url: string | null;
}

const SOCIAL_SIGNAL_BOARDS: Record<
  SocialSignalDomain,
  { label: string; description: string }
> = {
  macro: {
    label: "Macro Pulse",
    description: "Growth, inflation, property, fiscal, monetary, and data-release signals.",
  },
  politics: {
    label: "Policy Radar",
    description: "Central, local, regulatory, and official-message shifts.",
  },
  society: {
    label: "Social Temperature",
    description: "Employment, housing, education, healthcare, consumption, and public mood.",
  },
  history: {
    label: "Historical Narrative",
    description: "Historical analogy, anniversaries, memory politics, and long-cycle framing.",
  },
  trade: {
    label: "Trade & Supply Chains",
    description: "Tariffs, exports, imports, sanctions, shipping, and manufacturing flow.",
  },
  finance: {
    label: "Finance & Markets",
    description: "Currency, equity, credit, bonds, banking, and capital-market reaction.",
  },
  investment: {
    label: "Investment Flows",
    description: "Foreign capital, allocation narratives, risk repricing, and deal sentiment.",
  },
  geopolitics: {
    label: "Geopolitical Sensorium",
    description: "US-China, EU-China, Taiwan, South China Sea, diplomacy, and tech restrictions.",
  },
};

const TOPIC_KEYWORDS = [
  ["property", ["property", "real estate", "房地产", "楼市"]],
  ["yuan", ["yuan", "renminbi", "rmb", "人民币", "汇率"]],
  ["policy", ["policy", "stimulus", "regulation", "政策", "监管", "刺激"]],
  ["pmi", ["pmi", "采购经理"]],
  ["cpi", ["cpi", "inflation", "通胀", "cpi"]],
  ["tariff", ["tariff", "export control", "sanction", "关税", "制裁", "出口管制"]],
  ["trade", ["trade", "export", "import", "贸易", "出口", "进口"]],
  ["employment", ["employment", "jobless", "unemployment", "就业", "失业"]],
  ["consumption", ["consumption", "retail", "消费", "零售"]],
  ["investment", ["investment", "fdi", "portfolio", "投资", "外资"]],
] as const;

const DOMAIN_KEYWORDS: Record<SocialSignalDomain, readonly string[]> = {
  macro: ["gdp", "pmi", "cpi", "inflation", "deflation", "property", "房地产", "宏观", "经济"],
  politics: ["policy", "regulation", "beijing", "政策", "监管", "中央", "国务院"],
  society: ["employment", "education", "housing", "healthcare", "消费", "就业", "教育", "医疗"],
  history: ["history", "anniversary", "memory", "历史", "周年", "叙事"],
  trade: ["trade", "tariff", "export", "import", "supply chain", "贸易", "关税", "出口"],
  finance: ["yuan", "renminbi", "stock", "bond", "credit", "bank", "人民币", "股市", "债券"],
  investment: ["investment", "fdi", "capital flow", "portfolio", "外资", "投资", "资本流动"],
  geopolitics: ["us-china", "taiwan", "south china sea", "sanction", "中美", "台海", "南海"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function textIncludes(text: string, values: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return values.some((value) => lower.includes(value.toLowerCase()));
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3).trim()}...`;
}

function toJson(value: unknown): Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(toJson);
  }

  if (isRecord(value)) {
    const output: { [key: string]: Json } = {};
    for (const [key, child] of Object.entries(value)) {
      if (typeof child !== "undefined") {
        output[key] = toJson(child);
      }
    }
    return output;
  }

  return null;
}

function extractPost(record: Record<string, unknown>): XPostRecord | null {
  const id = stringOrNull(record.id);
  const text = stringOrNull(record.text);
  if (!id || !text) {
    return null;
  }

  const publicMetrics = isRecord(record.public_metrics) ? record.public_metrics : {};
  const attachments = isRecord(record.attachments) ? record.attachments : {};
  const mediaKeys = Array.isArray(attachments.media_keys)
    ? attachments.media_keys.filter((item): item is string => typeof item === "string")
    : [];

  return {
    id,
    text,
    authorId: stringOrNull(record.author_id),
    createdAt: stringOrNull(record.created_at),
    lang: stringOrNull(record.lang),
    metrics: {
      retweets: numberOrZero(publicMetrics.retweet_count),
      replies: numberOrZero(publicMetrics.reply_count),
      likes: numberOrZero(publicMetrics.like_count),
      quotes: numberOrZero(publicMetrics.quote_count),
    },
    mediaKeys,
    raw: record,
  };
}

function extractUsers(payload: unknown): Map<string, XUserRecord> {
  if (!isRecord(payload) || !isRecord(payload.includes)) {
    return new Map();
  }

  const users = new Map<string, XUserRecord>();
  for (const user of recordArray(payload.includes.users)) {
    const id = stringOrNull(user.id);
    if (!id) {
      continue;
    }
    users.set(id, {
      id,
      name: stringOrNull(user.name),
      username: stringOrNull(user.username),
      verified: user.verified === true,
    });
  }

  return users;
}

function extractMedia(payload: unknown): Map<string, XMediaRecord> {
  if (!isRecord(payload) || !isRecord(payload.includes)) {
    return new Map();
  }

  const media = new Map<string, XMediaRecord>();
  for (const item of recordArray(payload.includes.media)) {
    const mediaKey = stringOrNull(item.media_key);
    if (!mediaKey) {
      continue;
    }
    media.set(mediaKey, {
      mediaKey,
      url: stringOrNull(item.url) ?? stringOrNull(item.preview_image_url),
    });
  }

  return media;
}

function detectDomains(text: string): SocialSignalDomain[] {
  const domains = (Object.keys(DOMAIN_KEYWORDS) as SocialSignalDomain[]).filter((domain) =>
    textIncludes(text, DOMAIN_KEYWORDS[domain])
  );

  return domains.length > 0 ? domains : ["macro"];
}

function detectTopicTags(text: string): string[] {
  return TOPIC_KEYWORDS.filter(([, keywords]) => textIncludes(text, keywords)).map(([tag]) => tag);
}

function detectRegionScope(text: string): SocialSignalRegionScope {
  if (textIncludes(text, ["us-china", "u.s.-china", "america", "美国", "中美"])) {
    return "us_china";
  }
  if (textIncludes(text, ["eu-china", "europe", "brussels", "欧盟", "欧洲"])) {
    return "eu_china";
  }
  if (textIncludes(text, ["apac", "asia", "japan", "korea", "东盟", "亚洲"])) {
    return "apac";
  }
  if (textIncludes(text, ["global", "world", "全球"])) {
    return "global";
  }
  return "china";
}

function detectSignalType(text: string): SocialSignalType {
  if (textIncludes(text, ["breaking", "突发", "快讯"])) {
    return "breaking";
  }
  if (textIncludes(text, ["rumor", "unconfirmed", "传闻", "网传"])) {
    return "rumor";
  }
  if (textIncludes(text, ["policy", "regulation", "stimulus", "政策", "监管"])) {
    return "policy_hint";
  }
  if (textIncludes(text, ["market", "stocks", "bond", "yuan", "repricing", "市场", "人民币"])) {
    return "market_reaction";
  }
  if (textIncludes(text, ["narrative", "history", "叙事", "历史"])) {
    return "narrative_shift";
  }
  if (textIncludes(text, ["data", "gdp", "pmi", "cpi", "数据"])) {
    return "data_release";
  }
  return "sentiment";
}

function detectActorType(user: XUserRecord | undefined): SocialSignalActorType {
  if (!user) {
    return "unknown";
  }
  const text = `${user.name ?? ""} ${user.username ?? ""}`;
  if (textIncludes(text, ["gov", "ministry", "official", "state", "政府", "官方"])) {
    return "official";
  }
  if (textIncludes(text, ["news", "media", "daily", "times", "新闻", "财经"])) {
    return "media";
  }
  if (textIncludes(text, ["macro", "analyst", "research", "经济学", "研究"])) {
    return "analyst";
  }
  if (textIncludes(text, ["trader", "fund", "capital", "交易", "基金"])) {
    return "trader";
  }
  return user.verified ? "verified_account" : "unknown";
}

function engagementScore(post: XPostRecord): number {
  return post.metrics.likes + post.metrics.retweets * 2 + post.metrics.quotes * 2 + post.metrics.replies;
}

function detectUrgency(signalType: SocialSignalType, score: number): SocialSignalUrgency {
  if (signalType === "breaking" || signalType === "rumor" || score >= 250) {
    return "high";
  }
  if (signalType === "market_reaction" || signalType === "policy_hint" || score >= 50) {
    return "medium";
  }
  return "low";
}

function postUrl(post: XPostRecord, user: XUserRecord | undefined): string {
  const username = user?.username ?? "i";
  return username === "i"
    ? `https://x.com/i/web/status/${post.id}`
    : `https://x.com/${username}/status/${post.id}`;
}

export function normalizeXRecentSearchResponse(
  payload: unknown,
  options: NormalizeOptions
): SocialSignalItem[] {
  if (!isRecord(payload)) {
    return [];
  }

  const users = extractUsers(payload);
  const media = extractMedia(payload);
  const posts = recordArray(payload.data).map(extractPost).filter((post): post is XPostRecord => post !== null);

  return posts.map((post) => {
    const user = post.authorId ? users.get(post.authorId) : undefined;
    const score = engagementScore(post);
    const signalType = detectSignalType(post.text);

    return {
      externalId: `x-post-${post.id}`,
      sourceType: "post",
      title: truncate(post.text.replace(/\s+/g, " "), 120),
      body: post.text,
      url: postUrl(post, user),
      authorId: post.authorId,
      authorUsername: user?.username ?? null,
      authorDisplayName: user?.name ?? null,
      actorType: detectActorType(user),
      publishedAt: post.createdAt,
      capturedAt: options.capturedAt,
      domains: detectDomains(post.text),
      topicTags: detectTopicTags(post.text),
      regionScope: detectRegionScope(post.text),
      signalType,
      stance: "neutral",
      confidence: user?.verified ? "medium" : "low",
      urgency: detectUrgency(signalType, score),
      timeHorizon: signalType === "market_reaction" ? "intraday" : "weekly",
      language: post.lang,
      captureMethod: "recent_search",
      processingState: "raw",
      engagementScore: score,
      mediaUrls: post.mediaKeys
        .map((key) => media.get(key)?.url)
        .filter((url): url is string => typeof url === "string"),
      rawPayload: toJson(post.raw),
      watchRuleId: options.watchRuleId ?? null,
    };
  });
}

export function buildDefaultXWatchRules(): XWatchRule[] {
  return [
    {
      id: "china-macro",
      label: "China Macro Pulse",
      query: "(China OR 中国) (economy OR macro OR GDP OR PMI OR CPI OR property OR 房地产 OR 宏观 OR 经济) -is:retweet",
      domains: ["macro", "finance"],
    },
    {
      id: "china-policy",
      label: "China Policy Radar",
      query: "(China OR 中国) (policy OR regulation OR stimulus OR 北京 OR 政策 OR 监管 OR 国务院) -is:retweet",
      domains: ["politics", "macro"],
    },
    {
      id: "china-society",
      label: "China Social Temperature",
      query: "(China OR 中国) (employment OR housing OR education OR healthcare OR consumption OR 就业 OR 住房 OR 教育 OR 医疗 OR 消费) -is:retweet",
      domains: ["society", "macro"],
    },
    {
      id: "china-trade",
      label: "China Trade & Supply Chains",
      query: "(China OR 中国) (trade OR tariff OR export OR import OR supply chain OR sanction OR 贸易 OR 关税 OR 出口 OR 供应链) -is:retweet",
      domains: ["trade", "geopolitics"],
    },
    {
      id: "china-finance-investment",
      label: "China Finance & Investment",
      query: "(China OR 中国) (yuan OR renminbi OR stocks OR bonds OR investment OR capital flows OR 人民币 OR 股市 OR 债券 OR 投资 OR 外资) -is:retweet",
      domains: ["finance", "investment"],
    },
    {
      id: "china-geopolitics-history",
      label: "China Geopolitics & History",
      query: "(China OR 中国) (US-China OR Taiwan OR South China Sea OR history OR anniversary OR 中美 OR 台海 OR 南海 OR 历史 OR 周年) -is:retweet",
      domains: ["geopolitics", "history"],
    },
  ];
}

export function summarizeSignalBoards(items: SocialSignalItem[]): SignalBoardSummary[] {
  return (Object.keys(SOCIAL_SIGNAL_BOARDS) as SocialSignalDomain[])
    .map((domain) => {
      const boardItems = items.filter((item) => item.domains.includes(domain));
      return {
        id: domain,
        label: SOCIAL_SIGNAL_BOARDS[domain].label,
        description: SOCIAL_SIGNAL_BOARDS[domain].description,
        itemCount: boardItems.length,
        highUrgencyCount: boardItems.filter((item) => item.urgency === "high").length,
      };
    })
    .filter((board) => board.itemCount > 0);
}
import type { Json } from "@/src/lib/database.types";
