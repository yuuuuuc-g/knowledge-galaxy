-- Intelligence pipeline: shared source ingestion plus module-specific derived outputs.

create table if not exists intelligence_sources (
  id text primary key,
  name text not null,
  url text not null unique,
  modules text[] not null default '{}'::text[],
  regions text[] not null default '{}'::text[],
  topics text[] not null default '{}'::text[],
  enabled boolean not null default true,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists source_articles (
  id uuid primary key default uuid_generate_v4(),
  source_id text references intelligence_sources(id) on delete set null,
  source_name text not null,
  title text not null,
  url text not null unique,
  snippet text not null default '',
  published_at timestamp with time zone,
  fetched_at timestamp with time zone default now() not null,
  content_hash text,
  raw_payload jsonb not null default '{}'::jsonb
);

create table if not exists ingestion_jobs (
  id uuid primary key default uuid_generate_v4(),
  job_type text not null,
  status text not null check (status in ('running', 'completed', 'failed')),
  started_at timestamp with time zone default now() not null,
  finished_at timestamp with time zone,
  source_count integer not null default 0 check (source_count >= 0),
  fetched_count integer not null default 0 check (fetched_count >= 0),
  inserted_count integer not null default 0 check (inserted_count >= 0),
  error text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists module_scan_state (
  module_id text primary key,
  last_scanned_article_at timestamp with time zone,
  last_success_at timestamp with time zone,
  updated_at timestamp with time zone default now() not null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists macro_intel_items (
  id uuid primary key default uuid_generate_v4(),
  article_id uuid references source_articles(id) on delete cascade,
  title text not null,
  source text not null,
  url text not null unique,
  event_type text not null check (event_type in ('policy', 'macro_data', 'trade', 'fiscal', 'capital_market', 'geopolitics')),
  core_logic text not null,
  policy_intent text not null,
  capital_impact text not null,
  affected_regions text[] not null default '{}'::text[],
  affected_sectors text[] not null default '{}'::text[],
  time_horizon text not null check (time_horizon in ('short', 'medium', 'long')),
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  impact_score integer not null check (impact_score >= 0 and impact_score <= 100),
  evidence text[] not null default '{}'::text[],
  published_at timestamp with time zone,
  generated_at timestamp with time zone default now() not null
);

create table if not exists apac_supply_chain_signals (
  id uuid primary key default uuid_generate_v4(),
  article_id uuid references source_articles(id) on delete cascade,
  label text not null,
  subtitle text not null,
  value text not null,
  metric_label text not null,
  icon text not null check (icon in ('port', 'factory', 'zone', 'chain', 'market', 'trade')),
  variant text check (variant in ('default', 'positive', 'warning', 'alert')),
  url text not null unique,
  published_at timestamp with time zone,
  generated_at timestamp with time zone default now() not null
);

create index if not exists idx_intelligence_sources_modules on intelligence_sources using gin (modules);
create index if not exists idx_source_articles_source_id on source_articles(source_id);
create index if not exists idx_source_articles_published_at on source_articles(published_at desc nulls last);
create index if not exists idx_source_articles_fetched_at on source_articles(fetched_at desc);
create index if not exists idx_ingestion_jobs_started_at on ingestion_jobs(started_at desc);
create index if not exists idx_macro_intel_items_generated_at on macro_intel_items(generated_at desc);
create index if not exists idx_macro_intel_items_published_at on macro_intel_items(published_at desc nulls last);
create index if not exists idx_apac_supply_chain_signals_generated_at on apac_supply_chain_signals(generated_at desc);
create index if not exists idx_apac_supply_chain_signals_published_at on apac_supply_chain_signals(published_at desc nulls last);

drop trigger if exists update_intelligence_sources_updated_at on intelligence_sources;
create trigger update_intelligence_sources_updated_at
  before update on intelligence_sources
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_module_scan_state_updated_at on module_scan_state;
create trigger update_module_scan_state_updated_at
  before update on module_scan_state
  for each row
  execute function update_updated_at_column();

alter table intelligence_sources enable row level security;
alter table source_articles enable row level security;
alter table ingestion_jobs enable row level security;
alter table module_scan_state enable row level security;
alter table macro_intel_items enable row level security;
alter table apac_supply_chain_signals enable row level security;

drop policy if exists "intelligence_sources_read_all" on intelligence_sources;
create policy "intelligence_sources_read_all" on intelligence_sources
  for select
  using (true);

drop policy if exists "source_articles_read_all" on source_articles;
create policy "source_articles_read_all" on source_articles
  for select
  using (true);

drop policy if exists "ingestion_jobs_read_authenticated" on ingestion_jobs;
create policy "ingestion_jobs_read_authenticated" on ingestion_jobs
  for select
  to authenticated
  using (true);

drop policy if exists "module_scan_state_read_authenticated" on module_scan_state;
create policy "module_scan_state_read_authenticated" on module_scan_state
  for select
  to authenticated
  using (true);

drop policy if exists "macro_intel_items_read_all" on macro_intel_items;
create policy "macro_intel_items_read_all" on macro_intel_items
  for select
  using (true);

drop policy if exists "apac_supply_chain_signals_read_all" on apac_supply_chain_signals;
create policy "apac_supply_chain_signals_read_all" on apac_supply_chain_signals
  for select
  using (true);
