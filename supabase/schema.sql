create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists vector;

-- Knowledge Galaxy production schema snapshot.
-- Canonical change history lives in supabase/migrations/.
-- Security posture:
-- - Browser anon clients should not get direct write policies.
-- - User/content tables require Supabase authenticated users or server-side service-role access.
-- - Public dashboard snapshots remain readable where intentionally public.

create table if not exists topics (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists documents (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  content_markdown text not null,
  source_module text not null check (source_module in ('archive', 'analytical-pipeline', 'knowledge-graph')),
  topic_id uuid references topics(id) on delete set null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

alter table documents
  add column if not exists topic_id uuid references topics(id) on delete set null;

create table if not exists analytical_sessions (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid references documents(id) on delete cascade not null,
  source_issue text not null,
  phases jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now() not null
);

create table if not exists daily_briefings (
  id uuid primary key default uuid_generate_v4(),
  date date not null default current_date,
  source text not null,
  title text not null,
  url text not null,
  ai_summary text not null,
  created_at timestamp with time zone default now() not null
);

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
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
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

create table if not exists rag_books (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  author text not null,
  total_chunks integer not null default 0 check (total_chunks >= 0),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists rag_chunks (
  id uuid primary key default uuid_generate_v4(),
  book_id uuid references rag_books(id) on delete cascade not null,
  part_title text,
  chapter_index integer not null,
  chapter_title text not null,
  chunk_index integer not null,
  content text not null,
  chapter_summary text not null,
  word_count integer not null check (word_count >= 0),
  embedding vector(1024) not null,
  created_at timestamp with time zone default now() not null,
  unique (book_id, chapter_index, chunk_index)
);

create index if not exists idx_topics_created_at on topics(created_at desc);
create index if not exists idx_topics_updated_at on topics(updated_at desc);
create index if not exists idx_documents_topic_id on documents(topic_id);
create index if not exists idx_documents_source_module on documents(source_module);
create index if not exists idx_documents_created_at on documents(created_at desc);
create index if not exists idx_documents_updated_at on documents(updated_at desc);
create index if not exists idx_analytical_sessions_document_id on analytical_sessions(document_id);
create unique index if not exists uniq_daily_briefings_date_url on daily_briefings(date, url);
create index if not exists idx_daily_briefings_date on daily_briefings(date desc);
create index if not exists idx_daily_briefings_created_at on daily_briefings(created_at desc);
create index if not exists idx_intelligence_sources_modules on intelligence_sources using gin (modules);
create index if not exists idx_source_articles_source_id on source_articles(source_id);
create index if not exists idx_source_articles_published_at on source_articles(published_at desc nulls last);
create index if not exists idx_source_articles_fetched_at on source_articles(fetched_at desc);
create index if not exists idx_ingestion_jobs_started_at on ingestion_jobs(started_at desc);
create index if not exists idx_macro_intel_items_generated_at on macro_intel_items(generated_at desc);
create index if not exists idx_macro_intel_items_published_at on macro_intel_items(published_at desc nulls last);
create index if not exists idx_apac_supply_chain_signals_generated_at on apac_supply_chain_signals(generated_at desc);
create index if not exists idx_apac_supply_chain_signals_published_at on apac_supply_chain_signals(published_at desc nulls last);
create index if not exists idx_rag_books_created_at on rag_books(created_at desc);
create index if not exists idx_rag_books_title_author on rag_books(title, author);
create index if not exists idx_rag_chunks_book_id on rag_chunks(book_id);
create index if not exists idx_rag_chunks_chapter on rag_chunks(book_id, chapter_index, chunk_index);
create index if not exists idx_rag_chunks_embedding_hnsw
  on rag_chunks using hnsw (embedding vector_cosine_ops);

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_topics_updated_at on topics;
create trigger update_topics_updated_at
  before update on topics
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_documents_updated_at on documents;
create trigger update_documents_updated_at
  before update on documents
  for each row
  execute function update_updated_at_column();

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

drop trigger if exists update_rag_books_updated_at on rag_books;
create trigger update_rag_books_updated_at
  before update on rag_books
  for each row
  execute function update_updated_at_column();

create or replace function hybrid_search(
  query_text text,
  query_embedding vector(1024),
  match_count integer default 3,
  book_uuid_param uuid default null
)
returns table (
  id uuid,
  content text,
  chapter_title text,
  similarity double precision,
  chapter_index integer,
  chunk_index integer
)
language sql
stable
as $$
  select
    rag_chunks.id,
    rag_chunks.content,
    rag_chunks.chapter_title,
    1 - (rag_chunks.embedding <=> query_embedding) as similarity,
    rag_chunks.chapter_index,
    rag_chunks.chunk_index
  from rag_chunks
  where
    (book_uuid_param is null or rag_chunks.book_id = book_uuid_param)
    and length(trim(query_text)) > 0
  order by rag_chunks.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

alter table topics enable row level security;
alter table documents enable row level security;
alter table analytical_sessions enable row level security;
alter table daily_briefings enable row level security;
alter table intelligence_sources enable row level security;
alter table source_articles enable row level security;
alter table ingestion_jobs enable row level security;
alter table module_scan_state enable row level security;
alter table macro_intel_items enable row level security;
alter table apac_supply_chain_signals enable row level security;
alter table rag_books enable row level security;
alter table rag_chunks enable row level security;

drop policy if exists "topics_select_authenticated" on topics;
create policy "topics_select_authenticated" on topics
  for select
  to authenticated
  using (true);

drop policy if exists "topics_insert_authenticated" on topics;
create policy "topics_insert_authenticated" on topics
  for insert
  to authenticated
  with check (true);

drop policy if exists "topics_update_authenticated" on topics;
create policy "topics_update_authenticated" on topics
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "topics_delete_authenticated" on topics;
create policy "topics_delete_authenticated" on topics
  for delete
  to authenticated
  using (true);

drop policy if exists "documents_select_authenticated" on documents;
create policy "documents_select_authenticated" on documents
  for select
  to authenticated
  using (true);

drop policy if exists "documents_insert_authenticated" on documents;
create policy "documents_insert_authenticated" on documents
  for insert
  to authenticated
  with check (true);

drop policy if exists "documents_update_authenticated" on documents;
create policy "documents_update_authenticated" on documents
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "documents_delete_authenticated" on documents;
create policy "documents_delete_authenticated" on documents
  for delete
  to authenticated
  using (true);

drop policy if exists "analytical_sessions_select_authenticated" on analytical_sessions;
create policy "analytical_sessions_select_authenticated" on analytical_sessions
  for select
  to authenticated
  using (true);

drop policy if exists "analytical_sessions_insert_authenticated" on analytical_sessions;
create policy "analytical_sessions_insert_authenticated" on analytical_sessions
  for insert
  to authenticated
  with check (true);

drop policy if exists "analytical_sessions_delete_authenticated" on analytical_sessions;
create policy "analytical_sessions_delete_authenticated" on analytical_sessions
  for delete
  to authenticated
  using (true);

drop policy if exists "daily_briefings_read_all" on daily_briefings;
create policy "daily_briefings_read_all" on daily_briefings
  for select
  using (true);

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

drop policy if exists "rag_books_select_authenticated" on rag_books;
create policy "rag_books_select_authenticated" on rag_books
  for select
  to authenticated
  using (true);

drop policy if exists "rag_chunks_select_authenticated" on rag_chunks;
create policy "rag_chunks_select_authenticated" on rag_chunks
  for select
  to authenticated
  using (true);
