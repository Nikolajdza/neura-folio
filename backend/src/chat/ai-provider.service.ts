import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import {
  stepCountIs,
  streamText,
  tool,
  type LanguageModel,
} from 'ai';
import { z } from 'zod';
import type { SourceFilter } from './chat.dto.js';
import { RagService, type RetrievedSource } from './rag.service.js';

export type ChatHistoryMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type ProviderAttempt = {
  name: string;
  model: LanguageModel;
};

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(RagService) private readonly rag: RagService,
  ) {}

  async streamResponse(params: {
    message: string;
    context: string;
    history?: ChatHistoryMessage[];
    agent?: boolean;
    sourceFilter?: SourceFilter;
    sessionId?: string;
  }): Promise<{
    provider: string;
    textStream: AsyncIterable<string>;
    sources: RetrievedSource[];
  }> {
    const providers = this.buildProviders();
    if (providers.length === 0) {
      throw new Error(
        'No AI providers configured. Set GROQ_API_KEY, GEMINI_API_KEY, and/or CEREBRAS_API_KEY.',
      );
    }

    const useAgent =
      params.agent ??
      (this.config.get<string>('AGENT_MODE') ?? 'true').toLowerCase() !==
        'false';

    let lastError: unknown;

    for (const provider of providers) {
      try {
        this.logger.log(
          `Trying AI provider: ${provider.name} (agent=${useAgent})`,
        );
        if (useAgent) {
          try {
            return await this.streamWithAgent(provider, params);
          } catch (agentError) {
            this.logger.warn(
              `Agent mode failed on ${provider.name}, falling back to context-only: ${this.errorMessage(agentError)}`,
            );
            return await this.streamWithContext(provider, params);
          }
        }
        return await this.streamWithContext(provider, params);
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Provider ${provider.name} failed: ${this.errorMessage(error)}`,
        );
      }
    }

    throw new Error(
      `All AI providers failed. Last error: ${this.errorMessage(lastError)}`,
    );
  }

  private async streamWithContext(
    provider: ProviderAttempt,
    params: {
      message: string;
      context: string;
      history?: ChatHistoryMessage[];
    },
  ) {
    const system = this.buildSystemPrompt(params.context, false);
    const messages = [
      ...(params.history ?? []).filter((m) => m.role !== 'system'),
      { role: 'user' as const, content: params.message },
    ];

    const result = streamText({
      model: provider.model,
      system,
      messages,
    });

    return {
      provider: provider.name,
      textStream: await this.peekTextStream(result.textStream, provider.name),
      sources: [],
    };
  }

  private async streamWithAgent(
    provider: ProviderAttempt,
    params: {
      message: string;
      context: string;
      history?: ChatHistoryMessage[];
      sourceFilter?: SourceFilter;
      sessionId?: string;
    },
  ) {
    const collected: RetrievedSource[] = [];
    const sourceFilter = params.sourceFilter ?? 'all';
    const sessionId = params.sessionId;
    const system = this.buildSystemPrompt(params.context, true);
    const messages = [
      ...(params.history ?? []).filter((m) => m.role !== 'system'),
      { role: 'user' as const, content: params.message },
    ];

    const result = streamText({
      model: provider.model,
      system,
      messages,
      stopWhen: stepCountIs(3),
      tools: {
        searchKnowledge: tool({
          description:
            'Search Nikola\'s CV and GitHub portfolio knowledge base for relevant facts. Use when you need more detail than the provided context.',
          inputSchema: z.object({
            query: z
              .string()
              .describe('Focused search query, e.g. project name or skill'),
          }),
          execute: async ({ query }) => {
            const { context, sources } = await this.rag.getContext(
              query,
              sourceFilter,
              sessionId,
            );
            collected.push(...sources);
            return {
              query,
              context,
              sources: sources.map((source) => ({
                id: source.id,
                label:
                  (source.metadata?.source as string | undefined) ??
                  `document-${source.id}`,
                similarity: source.similarity,
              })),
            };
          },
        }),
      },
    });

    return {
      provider: provider.name,
      textStream: await this.peekTextStream(result.textStream, provider.name),
      sources: collected,
    };
  }

  private async peekTextStream(
    stream: AsyncIterable<string>,
    providerName: string,
  ): Promise<AsyncIterable<string>> {
    const iterator = stream[Symbol.asyncIterator]();
    const first = await iterator.next();

    if (first.done && !first.value) {
      throw new Error(`Provider ${providerName} returned an empty stream`);
    }

    async function* textStream(): AsyncGenerator<string> {
      if (!first.done && first.value) {
        yield first.value;
      }
      while (true) {
        const next = await iterator.next();
        if (next.done) {
          break;
        }
        if (next.value) {
          yield next.value;
        }
      }
    }

    return textStream();
  }

  private buildSystemPrompt(context: string, agent: boolean): string {
    const lines = [
      'You are NeuraFolio, a personal AI portfolio assistant for Nikola Buljcik.',
      'Answer using the provided context about the portfolio owner.',
      'If the context is insufficient, say what you know and what is missing.',
      'Be concise, professional, and specific.',
      'Format answers in clean Markdown: short paragraphs, blank lines between sections, bullet lists for skills/projects, and headings sparingly.',
      'Avoid dense walls of text or oversized tables unless necessary.',
      'At the end, if useful, suggest 1-2 short follow-up questions the user could ask.',
    ];

    if (agent) {
      lines.push(
        'You may call searchKnowledge for extra facts (projects, skills, experience). Prefer the given context first.',
      );
    }

    lines.push('', 'Context:', context || '(no matching documents found)');
    return lines.join('\n');
  }

  private buildProviders(): ProviderAttempt[] {
    const providers: ProviderAttempt[] = [];

    const groqKey = this.config.get<string>('GROQ_API_KEY');
    if (groqKey) {
      const groq = createOpenAI({
        apiKey: groqKey,
        baseURL: 'https://api.groq.com/openai/v1',
      });
      providers.push({
        name: 'groq',
        model: groq.chat(
          this.config.get<string>('GROQ_MODEL') ?? 'openai/gpt-oss-20b',
        ),
      });
    }

    const geminiKey = this.config.get<string>('GEMINI_API_KEY');
    if (geminiKey) {
      const google = createGoogleGenerativeAI({ apiKey: geminiKey });
      providers.push({
        name: 'gemini',
        model: google(
          this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash',
        ),
      });
    }

    const cerebrasKey = this.config.get<string>('CEREBRAS_API_KEY');
    if (cerebrasKey) {
      const cerebras = createOpenAI({
        apiKey: cerebrasKey,
        baseURL: 'https://api.cerebras.ai/v1',
      });
      providers.push({
        name: 'cerebras',
        model: cerebras.chat(
          this.config.get<string>('CEREBRAS_MODEL') ?? 'llama3.1-8b',
        ),
      });
    }

    return providers;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
