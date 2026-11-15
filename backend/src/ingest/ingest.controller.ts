import {
  Controller,
  Inject,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { IngestAuthGuard } from '../common/ingest-auth.guard.js';
import { IngestService } from './ingest.service.js';

@Controller('api/ingest')
export class IngestController {
  constructor(
    @Inject(IngestService) private readonly ingestService: IngestService,
  ) {}

  @Post('cv')
  @UseGuards(IngestAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (
          file.mimetype !== 'application/pdf' &&
          !file.originalname.toLowerCase().endsWith('.pdf')
        ) {
          callback(new BadRequestException('Only PDF files are allowed'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadCv(@UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('PDF file is required');
    }

    const result = await this.ingestService.ingestCvBuffer(file.buffer);
    return {
      ok: true,
      inserted: result.inserted,
      message: `CV ingested (${result.inserted} chunks)`,
    };
  }

  @Post('run')
  @UseGuards(IngestAuthGuard)
  async runFullIngest() {
    const result = await this.ingestService.run();
    return {
      ok: true,
      inserted: result.inserted,
      message: `Full ingest complete (${result.inserted} chunks)`,
    };
  }
}
