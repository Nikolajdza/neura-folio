import {
  BadRequestException,
  Controller,
  Headers,
  Inject,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SessionCvService } from './session-cv.service.js';

@Controller('api/session')
export class SessionController {
  constructor(
    @Inject(SessionCvService) private readonly sessionCv: SessionCvService,
  ) {}

  @Post('cv')
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
  async uploadSessionCv(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Headers('x-session-id') sessionIdHeader?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('PDF file is required');
    }

    const result = await this.sessionCv.ingestPdf(
      file.buffer,
      sessionIdHeader,
    );

    return {
      ok: true,
      sessionId: result.sessionId,
      inserted: result.inserted,
      message:
        'Session CV active until you refresh the page (then creator CV returns).',
    };
  }
}
