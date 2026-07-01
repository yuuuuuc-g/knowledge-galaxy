import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/lib/database.types";
import type {
  SignalBoardSummary,
  SocialSignalActorType,
  SocialSignalCaptureMethod,
  SocialSignalConfidence,
  SocialSignalDomain,
  SocialSignalItem,
  SocialSignalProcessingState,
  SocialSignalRegionScope,
  SocialSignalSourceType,
  SocialSignalStance,
  SocialSignalTimeHorizon,
  SocialSignalType,
  SocialSignalUrgency,
  XWatchRule,
} from "@/src/modules/social-signals/x-signals";
import { summarizeSignalBoards } from "@/src/modules/social-signals/x-signals";

interface QueryError {
  message?: string;
}

interface XSignalItemRow {
  actor_type?: unknown;
  author_display_name?: unknown;
  author_id?: unknown;
  author_username?: unknown;
  body?: unknown;
  capture_method?: unknown;
  captured_at?: unknown;
  confidence?: unknown;
  domains?: unknown;
  engagement_score?: unknown;
  external_id?: unknown;
  language?: unknown;
  media_urls?: unknown;
  processing_state?: unknown;
  published_at?: unknown;
  raw_payload?: unknown;
  region_scope?: unknown;
  signal_type?: unknown;
  source_type?: unknown;
  stance?: unknown;
  time_horizon?: unknown;
  title?: unknown;
  topic_tags?: unknown;
  urgency?: unknown;
  url?: unknown;
  watch_rule_id?: unknown;
}

export interface SocialSignalListFilters {
  domain?: SocialSignalDomain;
  urgency?: SocialSignalUrgency;
  regionScope?: SocialSignalRegionScope;
  sourceType?: SocialSignalSourceType;
  limit?: number;
}

export interface SocialSignalDashboardPayload {
  generatedAt: string;
  items: SocialSignalItem[];
  boards: SignalBoardSummary[];
}

export interface SocialSignalRepositoryLike {
  listSignalItems(filters?: SocialSignalListFilters): Promise<SocialSignalItem[]>;
  upsertSignalItems(items: SocialSignalItem[]): Promise<SocialSignalItem[]>;
  upsertWatchRules(rules: XWatchRule[]): Promise<void>;
}

export class SocialSignalRepositoryError extends Error {
  constructor(message: string, readonly publicMessage = "Social signal repository failed.") {
    super(message);
    this.name = "SocialSignalRepositoryError";
  }
}

function fail(error: QueryError | null | undefined, publicMessage?: string): never {
  throw new SocialSignalRepositoryError(error?.message ?? "Unknown Supabase error", publicMessage);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function uniqueSignalItemsByExternalId(items: SocialSignalItem[]): SocialSignalItem[] {
  const byExternalId = new Map<string, SocialSignalItem>();

  for (const item of items) {
    const existing = byExternalId.get(item.externalId);
    if (!existing || item.engagementScore >= existing.engagementScore) {
      byExternalId.set(item.externalId, item);
    }
  }

  return Array.from(byExternalId.values());
}

function isJson(value: unknown): value is Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJson);
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).every((child) => typeof child !== "undefined" && isJson(child));
  }
  return false;
}

function isSourceType(value: unknown): value is SocialSignalSourceType {
  return (
    value === "post" ||
    value === "thread" ||
    value === "user" ||
    value === "trend" ||
    value === "news_story" ||
    value === "media" ||
    value === "space"
  );
}

function isActorType(value: unknown): value is SocialSignalActorType {
  return (
    value === "official" ||
    value === "media" ||
    value === "analyst" ||
    value === "trader" ||
    value === "academic" ||
    value === "think_tank" ||
    value === "citizen" ||
    value === "anonymous" ||
    value === "verified_account" ||
    value === "unknown"
  );
}

function isRegionScope(value: unknown): value is SocialSignalRegionScope {
  return value === "china" || value === "us_china" || value === "eu_china" || value === "apac" || value === "global";
}

function isSignalType(value: unknown): value is SocialSignalType {
  return (
    value === "breaking" ||
    value === "policy_hint" ||
    value === "market_reaction" ||
    value === "rumor" ||
    value === "sentiment" ||
    value === "data_release" ||
    value === "narrative_shift"
  );
}

function isStance(value: unknown): value is SocialSignalStance {
  return value === "positive" || value === "negative" || value === "neutral" || value === "mixed" || value === "unclear";
}

function isConfidence(value: unknown): value is SocialSignalConfidence {
  return value === "low" || value === "medium" || value === "high";
}

function isUrgency(value: unknown): value is SocialSignalUrgency {
  return value === "low" || value === "medium" || value === "high";
}

function isTimeHorizon(value: unknown): value is SocialSignalTimeHorizon {
  return value === "intraday" || value === "weekly" || value === "monthly" || value === "structural";
}

function isCaptureMethod(value: unknown): value is SocialSignalCaptureMethod {
  return (
    value === "recent_search" ||
    value === "filtered_stream" ||
    value === "full_archive" ||
    value === "trends" ||
    value === "news" ||
    value === "spaces" ||
    value === "xai_x_search"
  );
}

function isProcessingState(value: unknown): value is SocialSignalProcessingState {
  return value === "raw" || value === "enriched" || value === "summarized" || value === "archived" || value === "ignored";
}

function domainArray(value: unknown): SocialSignalDomain[] {
  return stringArray(value).filter((item): item is SocialSignalDomain =>
    item === "macro" ||
    item === "politics" ||
    item === "society" ||
    item === "history" ||
    item === "trade" ||
    item === "finance" ||
    item === "investment" ||
    item === "geopolitics"
  );
}

function toSocialSignalItem(row: XSignalItemRow): SocialSignalItem | null {
  const externalId = stringOrNull(row.external_id);
  const title = stringOrNull(row.title);
  const body = stringOrNull(row.body);
  const url = stringOrNull(row.url);
  const capturedAt = stringOrNull(row.captured_at);

  if (!externalId || !title || body === null || !url || !capturedAt) {
    return null;
  }
  if (
    !isSourceType(row.source_type) ||
    !isActorType(row.actor_type) ||
    !isRegionScope(row.region_scope) ||
    !isSignalType(row.signal_type) ||
    !isStance(row.stance) ||
    !isConfidence(row.confidence) ||
    !isUrgency(row.urgency) ||
    !isTimeHorizon(row.time_horizon) ||
    !isCaptureMethod(row.capture_method) ||
    !isProcessingState(row.processing_state)
  ) {
    return null;
  }

  return {
    externalId,
    sourceType: row.source_type,
    title,
    body,
    url,
    authorId: stringOrNull(row.author_id),
    authorUsername: stringOrNull(row.author_username),
    authorDisplayName: stringOrNull(row.author_display_name),
    actorType: row.actor_type,
    publishedAt: stringOrNull(row.published_at),
    capturedAt,
    domains: domainArray(row.domains),
    topicTags: stringArray(row.topic_tags),
    regionScope: row.region_scope,
    signalType: row.signal_type,
    stance: row.stance,
    confidence: row.confidence,
    urgency: row.urgency,
    timeHorizon: row.time_horizon,
    language: stringOrNull(row.language),
    captureMethod: row.capture_method,
    processingState: row.processing_state,
    engagementScore: numberOrZero(row.engagement_score),
    mediaUrls: stringArray(row.media_urls),
    rawPayload: isJson(row.raw_payload) ? row.raw_payload : {},
    watchRuleId: stringOrNull(row.watch_rule_id),
  };
}

export class SocialSignalRepository implements SocialSignalRepositoryLike {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async upsertWatchRules(rules: XWatchRule[]): Promise<void> {
    if (rules.length === 0) return;

    const { error } = await this.supabase.from("x_watch_rules").upsert(
      rules.map((rule) => ({
        id: rule.id,
        label: rule.label,
        query: rule.query,
        domains: rule.domains,
        enabled: true,
      })),
      { onConflict: "id" }
    );

    if (error) fail(error, "Unable to persist X watch rules.");
  }

  async upsertSignalItems(items: SocialSignalItem[]): Promise<SocialSignalItem[]> {
    const uniqueItems = uniqueSignalItemsByExternalId(items);
    if (uniqueItems.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("x_signal_items")
      .upsert(
        uniqueItems.map((item) => ({
          external_id: item.externalId,
          source_type: item.sourceType,
          title: item.title,
          body: item.body,
          url: item.url,
          author_id: item.authorId,
          author_username: item.authorUsername,
          author_display_name: item.authorDisplayName,
          actor_type: item.actorType,
          published_at: item.publishedAt,
          captured_at: item.capturedAt,
          domains: item.domains,
          topic_tags: item.topicTags,
          region_scope: item.regionScope,
          signal_type: item.signalType,
          stance: item.stance,
          confidence: item.confidence,
          urgency: item.urgency,
          time_horizon: item.timeHorizon,
          language: item.language,
          capture_method: item.captureMethod,
          processing_state: item.processingState,
          engagement_score: item.engagementScore,
          media_urls: item.mediaUrls,
          raw_payload: item.rawPayload,
          watch_rule_id: item.watchRuleId,
        })),
        { onConflict: "external_id" }
      )
      .select(
        "external_id, source_type, title, body, url, author_id, author_username, author_display_name, actor_type, published_at, captured_at, domains, topic_tags, region_scope, signal_type, stance, confidence, urgency, time_horizon, language, capture_method, processing_state, engagement_score, media_urls, raw_payload, watch_rule_id"
      );

    if (error) fail(error, "Unable to persist X signal items.");

    return (data ?? []).map(toSocialSignalItem).filter((item): item is SocialSignalItem => item !== null);
  }

  async listSignalItems(filters: SocialSignalListFilters = {}): Promise<SocialSignalItem[]> {
    const limit = Math.min(Math.max(filters.limit ?? 80, 1), 200);
    let query = this.supabase
      .from("x_signal_items")
      .select(
        "external_id, source_type, title, body, url, author_id, author_username, author_display_name, actor_type, published_at, captured_at, domains, topic_tags, region_scope, signal_type, stance, confidence, urgency, time_horizon, language, capture_method, processing_state, engagement_score, media_urls, raw_payload, watch_rule_id"
      )
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("captured_at", { ascending: false })
      .limit(limit);

    if (filters.domain) {
      query = query.contains("domains", [filters.domain]);
    }
    if (filters.urgency) {
      query = query.eq("urgency", filters.urgency);
    }
    if (filters.regionScope) {
      query = query.eq("region_scope", filters.regionScope);
    }
    if (filters.sourceType) {
      query = query.eq("source_type", filters.sourceType);
    }

    const { data, error } = await query;

    if (error) fail(error, "Unable to load X signal items.");

    return (data ?? []).map(toSocialSignalItem).filter((item): item is SocialSignalItem => item !== null);
  }
}

export async function buildSocialSignalDashboard(
  repository: Pick<SocialSignalRepositoryLike, "listSignalItems">,
  filters: SocialSignalListFilters = {}
): Promise<SocialSignalDashboardPayload> {
  const items = await repository.listSignalItems(filters);

  return {
    generatedAt: new Date().toISOString(),
    items,
    boards: summarizeSignalBoards(items),
  };
}

export function createSocialSignalRepository(supabase: SupabaseClient<Database>) {
  return new SocialSignalRepository(supabase);
}
