import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Logger,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  createUIMessageStream,
  generateId,
  pipeUIMessageStreamToResponse,
  type UIMessage,
} from 'ai';
import { extractChatQuestion, type ChatRequestDto } from './chat.dto.js';
import { ChatService, type ChatSource } from './chat.service.js';

type NeuraUIMessage = UIMessage<
  never,
  {
    sources: ChatSource[];
    provider: string;
    status: string;
    followUps: string[];
  }
>;

@Controller('api')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    @Inject(ChatService) private readonly chatService: ChatService,
  ) {}

  @Post('chat')
  async handleChat(@Body() body: ChatRequestDto, @Res() res: Response) {
    let message: string;
    let history: ReturnType<typeof extractChatQuestion>['history'];
    let sourceFilter: ReturnType<typeof extractChatQuestion>['sourceFilter'];
    let sessionId: ReturnType<typeof extractChatQuestion>['sessionId'];

    try {
      ({ message, history, sourceFilter, sessionId } = extractChatQuestion(
        body ?? {},
      ));
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid chat payload',
      );
    }

    try {
      const stream = createUIMessageStream<NeuraUIMessage>({
        execute: async ({ writer }) => {
          writer.write({ type: 'start' });
          writer.write({
            type: 'data-status',
            data: 'searching',
            transient: true,
          });

          const { provider, textStream, sources } =
            await this.chatService.prepareReply({
              message,
              history,
              sourceFilter,
              sessionId,
            });

          writer.write({
            type: 'data-provider',
            data: provider,
            transient: true,
          });
          writer.write({
            type: 'data-sources',
            data: sources,
          });
          writer.write({
            type: 'data-status',
            data: 'generating',
            transient: true,
          });

          const textId = generateId();
          writer.write({ type: 'text-start', id: textId });
          for await (const delta of textStream) {
            writer.write({ type: 'text-delta', id: textId, delta });
          }
          writer.write({ type: 'text-end', id: textId });

          writer.write({
            type: 'data-followUps',
            data: this.buildFollowUps(sources),
          });
          writer.write({
            type: 'data-status',
            data: 'done',
            transient: true,
          });
          writer.write({ type: 'finish' });
        },
        onError: (error) => {
          this.logger.error(
            `Chat stream error: ${error instanceof Error ? error.message : String(error)}`,
          );
          return error instanceof Error ? error.message : 'Chat stream failed';
        },
      });

      await pipeUIMessageStreamToResponse({
        response: res,
        stream,
      });
    } catch (error) {
      this.logger.error(
        `Chat failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (!res.headersSent) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Chat failed',
        });
        return;
      }
      res.end();
    }
  }

  private buildFollowUps(sources: ChatSource[]): string[] {
    const labels = sources.map((s) => s.label);
    const followUps: string[] = [];

    if (labels.some((l) => l.startsWith('github:'))) {
      const repo = labels.find((l) => l.startsWith('github:'))?.replace(
        'github:',
        '',
      );
      if (repo) {
        followUps.push(`Tell me more about the ${repo} project`);
      }
    }
    if (labels.some((l) => l === 'CV.pdf')) {
      followUps.push('What is Nikola’s strongest technical background?');
    }
    followUps.push('Which technologies appear most across his work?');

    return followUps.slice(0, 3);
  }
}
