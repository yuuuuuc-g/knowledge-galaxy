import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApacSupplyItem } from "@/src/lib/apac-supply-chain";
import type { IntelligenceSource } from "@/src/modules/intelligence/source-registry";
import type {
  MacroIntelItem,
  MacroSourceArticle,
  RawMacroArticle,
} from "@/src/modules/intelligence/macro-intel";

export interface SourceArticleInput {
  sourceId: string;
  sourceName: string;
  title: string;
  url: string;
  snippet: string;
  publishedAt: string | null;
  rawPayload?: Record<string, unknown>;
}

export interface PersistedSourceArticle extends MacroSourceArticle {
  articleId: string;
  sourceId: string | null;
  fetchedAt: string;
}

export interface IntelligenceJobSummary {
  id: string;
  status: "running" | "completed" | "failed";
}

interface QueryError {
  message?: string;
}

interface SourceArticleRow {
  id?: unknown;
  source_id?: unknown;
  source_name?: unknown;
  title?: unknown;
  url?: unknown;
  snippet?: unknown;
  published_at?: unknown;
  fetched_at?: unknown;
}

interface MacroIntelRow {
  id?: unknown;
  article_id?: unknown;
  title?: unknown;
  source?: unknown;
  url?: unknown;
  event_type?: unknown;
  core_logic?: unknown;
  policy_intent?: unknown;
  capital_impact?: unknown;
  affected_regions?: unknown;
  affected_sectors?: unknown;
  time_horizon?: unknown;
  confidence?: unknown;
  impact_score?: unknown;
  evidence?: unknown;
  published_at?: unknown;
  generated_at?: unknown;
}

interface ApacSignalRow {
  id?: unknown;
  article_id?: unknown;
  label?: unknown;
  subtitle?: unknown;
  value?: unknown;
  metric_label?: unknown;
  icon?: unknown;
  variant?: unknown;
  url?: unknown;
  published_at?: unknown;
  generated_at?: unknown;
}

export class IntelligenceRepositoryError extends Error {
  constructor(message: string, readonly publicMessage = "Intelligence repository failed.") {
    super(message);
    this.name = "IntelligenceRepositoryError";
  }
}

function fail(error: QueryError | null | undefined, publicMessage?: string): never {
  throw new IntelligenceRepositoryError(error?.message ?? "Unknown Supabase error", publicMessage);
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

function toSourceArticle(row: SourceArticleRow): PersistedSourceArticle | null {
  const articleId = stringOrNull(row.id);
  const source = stringOrNull(row.source_name);
  const title = stringOrNull(row.title);
  const url = stringOrNull(row.url);

  if (!articleId || !source || !title || !url) {
    return null;
  }

  return {
    articleId,
    sourceId: stringOrNull(row.source_id),
    source,
    title,
    url,
    snippet: stringOrNull(row.snippet) ?? "",
    publishedAt: stringOrNull(row.published_at),
    fetchedAt: stringOrNull(row.fetched_at) ?? new Date().toISOString(),
  };
}

function toMacroIntelItem(row: MacroIntelRow, index: number): MacroIntelItem | null {
  const title = stringOrNull(row.title);
  const source = stringOrNull(row.source);
  const url = stringOrNull(row.url);
  const eventType = stringOrNull(row.event_type);
  const coreLogic = stringOrNull(row.core_logic);
  const policyIntent = stringOrNull(row.policy_intent);
  const capitalImpact = stringOrNull(row.capital_impact);
  const timeHorizon = stringOrNull(row.time_horizon);

  if (
    !title ||
    !source ||
    !url ||
    !eventType ||
    !coreLogic ||
    !policyIntent ||
    !capitalImpact ||
    !timeHorizon
  ) {
    return null;
  }

  if (
    eventType !== "policy" &&
    eventType !== "macro_data" &&
    eventType !== "trade" &&
    eventType !== "fiscal" &&
    eventType !== "capital_market" &&
    eventType !== "geopolitics"
  ) {
    return null;
  }

  if (timeHorizon !== "short" && timeHorizon !== "medium" && timeHorizon !== "long") {
    return null;
  }

  return {
    articleId: stringOrNull(row.article_id) ?? undefined,
    id: index + 1,
    title,
    source,
    url,
    eventType,
    coreLogic,
    policyIntent,
    capitalImpact,
    affectedRegions: stringArray(row.affected_regions),
    affectedSectors: stringArray(row.affected_sectors),
    timeHorizon,
    confidence: numberOrZero(row.confidence),
    impactScore: Math.round(numberOrZero(row.impact_score)),
    evidence: stringArray(row.evidence),
    publishedAt: stringOrNull(row.published_at),
  };
}

function toApacSupplyItem(row: ApacSignalRow, index: number): ApacSupplyItem | null {
  const label = stringOrNull(row.label);
  const subtitle = stringOrNull(row.subtitle);
  const value = stringOrNull(row.value);
  const metricLabel = stringOrNull(row.metric_label);
  const icon = stringOrNull(row.icon);
  const url = stringOrNull(row.url);

  if (!label || !subtitle || !value || !metricLabel || !icon || !url) {
    return null;
  }

  if (
    icon !== "port" &&
    icon !== "factory" &&
    icon !== "zone" &&
    icon !== "chain" &&
    icon !== "market" &&
    icon !== "trade"
  ) {
    return null;
  }

  const variant = stringOrNull(row.variant);

  return {
    articleId: stringOrNull(row.article_id) ?? undefined,
    id: index + 1,
    label,
    subtitle,
    value,
    metricLabel,
    icon,
    ...(variant === "default" || variant === "positive" || variant === "warning" || variant === "alert"
      ? { variant }
      : {}),
    url,
    publishedAt: stringOrNull(row.published_at),
  };
}

export class IntelligenceRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async upsertSources(sources: IntelligenceSource[]): Promise<void> {
    const { error } = await this.supabase.from("intelligence_sources").upsert(
      sources.map((source) => ({
        id: source.id,
        name: source.name,
        url: source.url,
        modules: source.modules,
        regions: source.regions,
        topics: source.topics,
        enabled: true,
      })),
      { onConflict: "id" }
    );

    if (error) fail(error, "Unable to persist intelligence sources.");
  }

  async startJob(jobType: string): Promise<IntelligenceJobSummary> {
    const { data, error } = await this.supabase
      .from("ingestion_jobs")
      .insert({ job_type: jobType, status: "running" })
      .select("id, status")
      .single();

    if (error) fail(error, "Unable to start intelligence job.");

    return {
      id: String(data.id),
      status: data.status === "failed" || data.status === "completed" ? data.status : "running",
    };
  }

  async finishJob(input: {
    id: string;
    status: "completed" | "failed";
    sourceCount: number;
    fetchedCount: number;
    insertedCount: number;
    error?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase
      .from("ingestion_jobs")
      .update({
        status: input.status,
        finished_at: new Date().toISOString(),
        source_count: input.sourceCount,
        fetched_count: input.fetchedCount,
        inserted_count: input.insertedCount,
        error: input.error,
        metadata: input.metadata ?? {},
      })
      .eq("id", input.id);

    if (error) fail(error, "Unable to finish intelligence job.");
  }

  async upsertSourceArticles(articles: SourceArticleInput[]): Promise<PersistedSourceArticle[]> {
    if (articles.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("source_articles")
      .upsert(
        articles.map((article) => ({
          source_id: article.sourceId,
          source_name: article.sourceName,
          title: article.title,
          url: article.url,
          snippet: article.snippet,
          published_at: article.publishedAt,
          raw_payload: article.rawPayload ?? {},
        })),
        { onConflict: "url" }
      )
      .select("id, source_id, source_name, title, url, snippet, published_at, fetched_at");

    if (error) fail(error, "Unable to persist source articles.");

    return (data ?? []).map(toSourceArticle).filter((item): item is PersistedSourceArticle => item !== null);
  }

  async listRecentSourceArticles(limit = 80): Promise<PersistedSourceArticle[]> {
    const { data, error } = await this.supabase
      .from("source_articles")
      .select("id, source_id, source_name, title, url, snippet, published_at, fetched_at")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("fetched_at", { ascending: false })
      .limit(limit);

    if (error) fail(error, "Unable to load source articles.");

    return (data ?? []).map(toSourceArticle).filter((item): item is PersistedSourceArticle => item !== null);
  }

  async upsertMacroIntelItems(items: MacroIntelItem[]): Promise<void> {
    if (items.length === 0) return;

    const { error } = await this.supabase.from("macro_intel_items").upsert(
      items.map((item) => ({
        article_id: item.articleId,
        title: item.title,
        source: item.source,
        url: item.url,
        event_type: item.eventType,
        core_logic: item.coreLogic,
        policy_intent: item.policyIntent,
        capital_impact: item.capitalImpact,
        affected_regions: item.affectedRegions,
        affected_sectors: item.affectedSectors,
        time_horizon: item.timeHorizon,
        confidence: item.confidence,
        impact_score: item.impactScore,
        evidence: item.evidence,
        published_at: item.publishedAt,
        generated_at: new Date().toISOString(),
      })),
      { onConflict: "url" }
    );

    if (error) fail(error, "Unable to persist macro intelligence items.");
  }

  async listMacroIntelItems(limit = 20): Promise<MacroIntelItem[]> {
    const { data, error } = await this.supabase
      .from("macro_intel_items")
      .select(
        "id, article_id, title, source, url, event_type, core_logic, policy_intent, capital_impact, affected_regions, affected_sectors, time_horizon, confidence, impact_score, evidence, published_at, generated_at"
      )
      .order("generated_at", { ascending: false })
      .limit(limit);

    if (error) fail(error, "Unable to load macro intelligence items.");

    return (data ?? []).map(toMacroIntelItem).filter((item): item is MacroIntelItem => item !== null);
  }

  async upsertApacSupplyChainSignals(items: ApacSupplyItem[]): Promise<void> {
    const persistedItems = items.filter((item) => item.url);
    if (persistedItems.length === 0) return;

    const { error } = await this.supabase.from("apac_supply_chain_signals").upsert(
      persistedItems.map((item) => ({
        article_id: item.articleId,
        label: item.label,
        subtitle: item.subtitle,
        value: item.value,
        metric_label: item.metricLabel,
        icon: item.icon,
        variant: item.variant,
        url: item.url,
        published_at: item.publishedAt,
        generated_at: new Date().toISOString(),
      })),
      { onConflict: "url" }
    );

    if (error) fail(error, "Unable to persist APAC supply-chain signals.");
  }

  async listApacSupplyChainSignals(limit = 20): Promise<ApacSupplyItem[]> {
    const { data, error } = await this.supabase
      .from("apac_supply_chain_signals")
      .select("id, article_id, label, subtitle, value, metric_label, icon, variant, url, published_at, generated_at")
      .order("generated_at", { ascending: false })
      .limit(limit);

    if (error) fail(error, "Unable to load APAC supply-chain signals.");

    return (data ?? []).map(toApacSupplyItem).filter((item): item is ApacSupplyItem => item !== null);
  }

  async upsertDailyBriefings(
    rows: { date: string; source: string; title: string; url: string; ai_summary: string }[]
  ): Promise<void> {
    if (rows.length === 0) return;

    const { error } = await this.supabase
      .from("daily_briefings")
      .upsert(rows, { onConflict: "date,url", ignoreDuplicates: false });

    if (error) fail(error, "Unable to persist daily briefings.");
  }

  async updateModuleScanState(
    moduleId: string,
    metadata: Record<string, unknown>,
    lastScannedArticleAt?: string | null
  ): Promise<void> {
    const { error } = await this.supabase.from("module_scan_state").upsert(
      {
        module_id: moduleId,
        last_scanned_article_at: lastScannedArticleAt,
        last_success_at: new Date().toISOString(),
        metadata,
      },
      { onConflict: "module_id" }
    );

    if (error) fail(error, "Unable to persist module scan state.");
  }

  toMacroSourceArticles(articles: PersistedSourceArticle[]): MacroSourceArticle[] {
    return articles.map((article) => ({
      articleId: article.articleId,
      source: article.source,
      title: article.title,
      url: article.url,
      snippet: article.snippet,
      publishedAt: article.publishedAt,
    }));
  }

  toRawMacroArticles(articles: PersistedSourceArticle[]): RawMacroArticle[] {
    return this.toMacroSourceArticles(articles).map((article, index) => ({
      ...article,
      id: index + 1,
      score: 0,
    }));
  }
}

export function createIntelligenceRepository(supabase: SupabaseClient): IntelligenceRepository {
  return new IntelligenceRepository(supabase);
}
