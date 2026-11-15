import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

type Bucket = { count: number; resetAt: number };

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly buckets = new Map<string, Bucket>();
  private readonly windowMs = 60_000;
  private readonly maxRequests = Number(process.env.CHAT_RATE_LIMIT ?? '30');

  use(req: Request, res: Response, next: NextFunction) {
    const key =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      res.setHeader('X-RateLimit-Limit', String(this.maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(this.maxRequests - 1));
      next();
      return;
    }

    bucket.count += 1;
    const remaining = Math.max(this.maxRequests - bucket.count, 0);
    res.setHeader('X-RateLimit-Limit', String(this.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (bucket.count > this.maxRequests) {
      res.status(429).json({
        error: 'Too many requests. Please wait a minute and try again.',
      });
      return;
    }

    next();
  }
}
