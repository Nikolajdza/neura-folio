import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service.js';
import { SessionCvService } from '../session/session-cv.service.js';
import type { SourceFilter } from './chat.dto.js';
import { EmbeddingsService } from './embeddings.service.js';

export type RetrievedSource = {
  id: number;
  content: string;
  metadata: Record<string, unknown> | null;
  similarity: number;
};

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly matchThreshold: number;
  private readonly matchCount: number;
  private readonly useHybrid: boolean;

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(EmbeddingsService) private readonly embeddings: EmbeddingsService,
    @Inject(SessionCvService) private readonly sessionCv: SessionCvService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {
    this.matchThreshold = Number(
      this.config.get<string>('RAG_MATCH_THRESHOLD') ?? '0.35',
    );
    this.matchCount = Number(this.config.get<string>('RAG_MATCH_COUNT') ?? '5');
    this.useHybrid =
      (this.config.get<string>('RAG_HYBRID') ?? 'true').toLowerCase() !==
      'false';
  }

  async getContext(
    question: string,
    sourceFilter: SourceFilter = 'all',
    sessionId?: string,
  ): Promise<{
    context: string;
    sources: RetrievedSource[];
  }> {
    const embedding = await this.embeddings.embed(question);
    const vector = this.embeddings.toPgVector(embedding);
    const fetchCount =
      sourceFilter === 'all' ? this.matchCount : this.matchCount * 4;

    const neonRaw = this.useHybrid
      ? await this.hybridSearch(vector, question, fetchCount)
      : await this.vectorSearch(vector, fetchCount);

    const hasSessionCv = this.sessionCv.hasSession(sessionId);
    const sessionHits = hasSessionCv
      ? this.sessionCv.search(sessionId, embedding, this.matchCount)
      : [];

    let combined = neonRaw;

    if (hasSessionCv) {
      // Session CV replaces creator CV for this browser visit.
      const withoutCreatorCv = neonRaw.filter((source) => !this.isCvSource(source));
      if (sourceFilter === 'cv') {
        combined = sessionHits;
      } else if (sourceFilter === 'github') {
        combined = withoutCreatorCv.filter((source) => this.isGithubSource(source));
      } else {
        combined = [...sessionHits, ...withoutCreatorCv];
      }
    } else {
      combined = this.applySourceFilter(neonRaw, sourceFilter);
    }

    const sources = combined
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, this.matchCount);

    this.logger.debug(
      `RAG matched ${sources.length} chunks (filter=${sourceFilter}, session=${hasSessionCv})`,
    );

    const context = sources
      .map((source, index) => {
        const label =
          (source.metadata?.source as string | undefined) ??
          `source-${source.id}`;
        return `[${index + 1}] (${label})\n${source.content}`;
      })
      .join('\n\n');

    return { context, sources };
  }

  private isCvSource(source: RetrievedSource): boolean {
    return (
      source.metadata?.type === 'cv' || source.metadata?.source === 'CV.pdf'
    );
  }

  private isGithubSource(source: RetrievedSource): boolean {
    return (
      source.metadata?.type === 'github' ||
      String(source.metadata?.source ?? '').startsWith('github:')
    );
  }

  private applySourceFilter(
    sources: RetrievedSource[],
    sourceFilter: SourceFilter,
  ): RetrievedSource[] {
    if (sourceFilter === 'all') {
      return sources;
    }
    return sources.filter((source) =>
      sourceFilter === 'cv'
        ? this.isCvSource(source)
        : this.isGithubSource(source),
    );
  }

  private async vectorSearch(
    vector: string,
    matchCount = this.matchCount,
  ): Promise<RetrievedSource[]> {
    const result = await this.database.query<{
      id: string;
      content: string;
      metadata: Record<string, unknown> | null;
      similarity: number;
    }>(
      `select id, content, metadata, similarity
       from match_documents($1::vector, $2, $3)`,
      [vector, this.matchThreshold, matchCount],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  private async hybridSearch(
    vector: string,
    question: string,
    matchCount = this.matchCount,
  ): Promise<RetrievedSource[]> {
    try {
      const result = await this.database.query<{
        id: string;
        content: string;
        metadata: Record<string, unknown> | null;
        similarity: number;
      }>(
        `select id, content, metadata, similarity
         from hybrid_match_documents($1::vector, $2, $3)`,
        [vector, question, matchCount],
      );
      return result.rows.map((row) => this.mapRow(row));
    } catch (error) {
      this.logger.warn(
        `Hybrid search failed, falling back to vector-only: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return this.vectorSearch(vector, matchCount);
    }
  }

  private mapRow(row: {
    id: string;
    content: string;
    metadata: Record<string, unknown> | null;
    similarity: number;
  }): RetrievedSource {
    return {
      id: Number(row.id),
      content: row.content,
      metadata: row.metadata,
      similarity: row.similarity,
    };
  }
}
