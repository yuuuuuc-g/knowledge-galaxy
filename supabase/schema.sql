create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- Knowledge Galaxy production baseline.
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
