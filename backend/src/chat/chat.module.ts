import { Module } from '@nestjs/common';
import { SessionController } from '../session/session.controller.js';
import { SessionCvService } from '../session/session-cv.service.js';
import { AiProviderService } from './ai-provider.service.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { EmbeddingsService } from './embeddings.service.js';
import { RagService } from './rag.service.js';

@Module({
  controllers: [ChatController, SessionController],
  providers: [
    EmbeddingsService,
    SessionCvService,
    RagService,
    AiProviderService,
    ChatService,
  ],
  exports: [
    EmbeddingsService,
    SessionCvService,
    RagService,
    AiProviderService,
    ChatService,
  ],
})
export class ChatModule {}
