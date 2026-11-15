import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PDFParse } from 'pdf-parse';
import { EmbeddingsService } from '../chat/embeddings.service.js';
import type { RetrievedSource } from '../chat/rag.service.js';
import { chunkText } from '../ingest/text-chunker.js';

type SessionChunk = {
  id: number;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
};

type SessionRecord = {
  chunks: SessionChunk[];
  updatedAt: number;
};

@Injectable()
export class SessionCvService {
  private readonly logger = new Logger(SessionCvService.name);
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly ttlMs = 1000 * 60 * 60 * 2; // 2h safety cleanup
  private nextId = 1_000_000;

  constructor(
    @Inject(EmbeddingsService) private readonly embeddings: EmbeddingsService,
  ) {
    setInterval(() => this.cleanup(), 1000 * 60 * 15).unref?.();
  }

  hasSession(sessionId?: string | null): boolean {
    if (!sessionId) {
      return false;
    }
    this.cleanup();
    return this.sessions.has(sessionId);
  }

  async ingestPdf(
    buffer: Buffer,
    sessionId?: string,
  ): Promise<{ sessionId: string; inserted: number }> {
    const id = sessionId?.trim() || randomUUID();
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();

    const textChunks = chunkText(parsed.text);
    if (textChunks.length === 0) {
      throw new Error('No text found in PDF');
    }

    const chunks: SessionChunk[] = [];
    for (const [index, content] of textChunks.entries()) {
      const embedding = await this.embeddings.embed(content);
      chunks.push({
        id: this.nextId++,
        content,
        embedding,
        metadata: {
          source: 'session-cv.pdf',
          type: 'cv',
          session: true,
          chunk: index,
        },
      });
    }

    this.sessions.set(id, { chunks, updatedAt: Date.now() });
    this.logger.log(
      `Session CV stored (${chunks.length} chunks) for ${id.slice(0, 8)}…`,
    );

    return { sessionId: id, inserted: chunks.length };
  }

  search(
    sessionId: string | undefined,
    queryEmbedding: number[],
    limit: number,
  ): RetrievedSource[] {
    if (!sessionId) {
      return [];
    }
    const record = this.sessions.get(sessionId);
    if (!record) {
      return [];
    }

    record.updatedAt = Date.now();

    return record.chunks
      .map((chunk) => ({
        id: chunk.id,
        content: chunk.content,
        metadata: chunk.metadata,
        similarity: this.cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) {
      return 0;
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private cleanup() {
    const now = Date.now();
    for (const [id, record] of this.sessions.entries()) {
      if (now - record.updatedAt > this.ttlMs) {
        this.sessions.delete(id);
      }
    }
  }
}
