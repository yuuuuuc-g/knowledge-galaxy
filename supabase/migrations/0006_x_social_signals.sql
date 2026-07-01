-- X social signals: real-time public-discussion artifacts for signal boards.

create extension if not exists pgcrypto;

create table if not exists x_watch_rules (
  id text primary key,
  label text not null,
  query text not null,
  domains text[] not null default '{}'::text[],
  enabled boolean not null default true,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists x_signal_items (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  source_type text not null check (source_type in ('post', 'thread', 'user', 'trend', 'news_story', 'media', 'space')),
  title text not null,
  body text not null default '',
  url text not null,
  author_id text,
  author_username text,
  author_display_name text,
  actor_type text not null check (actor_type in ('official', 'media', 'analyst', 'trader', 'academic', 'think_tank', 'citizen', 'anonymous', 'verified_account', 'unknown')),
  published_at timestamp with time zone,
  captured_at timestamp with time zone default now() not null,
  domains text[] not null default '{}'::text[],
  topic_tags text[] not null default '{}'::text[],
  region_scope text not null check (region_scope in ('china', 'us_china', 'eu_china', 'apac', 'global')),
  signal_type text not null check (signal_type in ('breaking', 'policy_hint', 'market_reaction', 'rumor', 'sentiment', 'data_release', 'narrative_shift')),
  stance text not null check (stance in ('positive', 'negative', 'neutral', 'mixed', 'unclear')),
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  urgency text not null check (urgency in ('low', 'medium', 'high')),
  time_horizon text not null check (time_horizon in ('intraday', 'weekly', 'monthly', 'structural')),
  language text,
  capture_method text not null check (capture_method in ('recent_search', 'filtered_stream', 'full_archive', 'trends', 'news', 'spaces', 'xai_x_search')),
  processing_state text not null check (processing_state in ('raw', 'enriched', 'summarized', 'archived', 'ignored')),
  engagement_score integer not null default 0 check (engagement_score >= 0),
  media_urls text[] not null default '{}'::text[],
  raw_payload jsonb not null default '{}'::jsonb,
  watch_rule_id text references x_watch_rules(id) on delete set null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create index if not exists idx_x_signal_items_captured_at on x_signal_items(captured_at desc);
create index if not exists idx_x_signal_items_published_at on x_signal_items(published_at desc nulls last);
create index if not exists idx_x_signal_items_domains on x_signal_items using gin (domains);
create index if not exists idx_x_signal_items_topic_tags on x_signal_items using gin (topic_tags);
create index if not exists idx_x_signal_items_watch_rule_id on x_signal_items(watch_rule_id);
create index if not exists idx_x_signal_items_urgency on x_signal_items(urgency);
create index if not exists idx_x_signal_items_region_scope on x_signal_items(region_scope);

drop trigger if exists update_x_watch_rules_updated_at on x_watch_rules;
create trigger update_x_watch_rules_updated_at
  before update on x_watch_rules
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_x_signal_items_updated_at on x_signal_items;
create trigger update_x_signal_items_updated_at
  before update on x_signal_items
  for each row
  execute function update_updated_at_column();

alter table x_watch_rules enable row level security;
alter table x_signal_items enable row level security;

drop policy if exists "x_watch_rules_read_all" on x_watch_rules;
create policy "x_watch_rules_read_all" on x_watch_rules
  for select
  using (true);

drop policy if exists "x_signal_items_read_all" on x_signal_items;
create policy "x_signal_items_read_all" on x_signal_items
  for select
  using (true);
