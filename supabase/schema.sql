create extension if not exists "uuid-ossp";

create table documents (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  content_markdown text not null,
  source_module text not null check (source_module in ('archive', 'analytical-pipeline', 'knowledge-graph')),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table analytical_sessions (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid references documents(id) on delete cascade not null,
  source_issue text not null,
  phases jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now() not null
);

create index idx_documents_source_module on documents(source_module);
create index idx_documents_created_at on documents(created_at desc);
create index idx_analytical_sessions_document_id on analytical_sessions(document_id);

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_documents_updated_at
  before update on documents
  for each row
  execute function update_updated_at_column();
