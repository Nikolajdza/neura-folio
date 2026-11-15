import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module.js';
import { IngestAuthGuard } from '../common/ingest-auth.guard.js';
import { IngestController } from './ingest.controller.js';
import { IngestService } from './ingest.service.js';

@Module({
  imports: [ChatModule],
  controllers: [IngestController],
  providers: [IngestService, IngestAuthGuard],
  exports: [IngestService],
})
export class IngestModule {}
