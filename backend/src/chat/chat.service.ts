import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AiProviderService,
  type ChatHistoryMessage,
} from './ai-provider.service.js';
import type { SourceFilter } from './chat.dto.js';
import { RagService, type RetrievedSource } from './rag.service.js';

export type ChatSource = {
  id: number;
  label: string;
  url?: string;
  similarity: number;
  excerpt: string;
};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(RagService) private readonly rag: RagService,
    @Inject(AiProviderService) private readonly ai: AiProviderService,
  ) {}

  async prepareReply(params: {
    message: string;
    history?: ChatHistoryMessage[];
    sourceFilter?: SourceFilter;
    sessionId?: string;
  }): Promise<{
    provider: string;
    textStream: AsyncIterable<string>;
    sources: ChatSource[];
  }> {
    const sourceFilter = params.sourceFilter ?? 'all';
    const { context, sources: ragSources } = await this.rag.getContext(
      params.message,
      sourceFilter,
      params.sessionId,
    );
    this.logger.log(
      `RAG sources: ${ragSources.length} (filter=${sourceFilter}, session=${Boolean(params.sessionId)})`,
    );

    const { provider, textStream, sources: agentSources } =
      await this.ai.streamResponse({
        message: params.message,
        context,
        history: params.history,
        sourceFilter,
        sessionId: params.sessionId,
      });

    const merged = this.mergeSources([...ragSources, ...agentSources]);

    return {
      provider,
      textStream,
      sources: merged,
    };
  }

  private mergeSources(sources: RetrievedSource[]): ChatSource[] {
    const byId = new Map<number, ChatSource>();
    for (const source of sources) {
      const mapped = this.toChatSource(source);
      const existing = byId.get(mapped.id);
      if (!existing || mapped.similarity > existing.similarity) {
        byId.set(mapped.id, mapped);
      }
    }
    return Array.from(byId.values()).sort(
      (a, b) => b.similarity - a.similarity,
    );
  }

  private toChatSource(source: RetrievedSource): ChatSource {
    const label =
      (source.metadata?.source as string | undefined) ??
      `document-${source.id}`;
    const url = source.metadata?.url as string | undefined;
    const excerpt =
      source.content.length > 420
        ? `${source.content.slice(0, 420).trim()}…`
        : source.content;

    return {
      id: source.id,
      label,
      url,
      similarity: Number(source.similarity.toFixed(4)),
      excerpt,
    };
  }
}
