-- NeuraFolio: vector store for RAG documents
-- Enable the vector extension in the Supabase dashboard (Database → Extensions),
-- then run this SQL in the SQL Editor.

create extension if not exists vector;

create table if not exists documents (
  id bigserial primary key,
  content text not null,
  metadata jsonb,
  embedding vector(384) -- Dimension for BAAI/bge-small-en-v1.5
);

-- Similarity search used by the NestJS RAG service
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
