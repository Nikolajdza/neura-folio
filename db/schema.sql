-- NeuraFolio: vector + hybrid search store for RAG documents
-- Run this in the Neon SQL Editor (project → SQL Editor).

create extension if not exists vector;

create table if not exists documents (
  id bigserial primary key,
  content text not null,
  metadata jsonb,
  embedding vector(384) -- Dimension for BAAI/bge-small-en-v1.5 / Xenova equivalent
);

-- Full-text column for hybrid (vector + keyword) retrieval
alter table documents
  add column if not exists content_tsv tsvector
  generated always as (to_tsvector('english', coalesce(content, ''))) stored;

create index if not exists documents_content_tsv_idx
  on documents using gin (content_tsv);

-- Vector-only similarity search
create or replace function match_documents (
  query_embedding vector(384),
  match_threshold float,
  match_count int
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
$$;

-- Hybrid: blend vector similarity with Postgres full-text rank
create or replace function hybrid_match_documents (
  query_embedding vector(384),
  query_text text,
  match_count int,
  vector_weight float default 0.7,
  text_weight float default 0.3
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  with vector_hits as (
    select
      d.id,
      d.content,
      d.metadata,
      1 - (d.embedding <=> query_embedding) as vector_score
    from documents d
    order by d.embedding <=> query_embedding
    limit greatest(match_count * 4, 20)
  ),
  text_hits as (
    select
      d.id,
      ts_rank_cd(d.content_tsv, websearch_to_tsquery('english', query_text)) as text_score
    from documents d
    where query_text is not null
      and length(trim(query_text)) > 0
      and d.content_tsv @@ websearch_to_tsquery('english', query_text)
  )
  select
    v.id,
    v.content,
    v.metadata,
    (vector_weight * v.vector_score)
      + (text_weight * coalesce(t.text_score, 0)) as similarity
  from vector_hits v
  left join text_hits t on t.id = v.id
  order by similarity desc
  limit match_count;
$$;
