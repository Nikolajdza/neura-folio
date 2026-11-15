import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class IngestAuthGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('INGEST_SECRET');
    if (!expected) {
      throw new UnauthorizedException(
        'INGEST_SECRET is not configured on the server',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided =
      request.header('x-ingest-secret') ??
      (typeof request.body?.secret === 'string' ? request.body.secret : undefined);

    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid ingest secret');
    }

    return true;
  }
}
