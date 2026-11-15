import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service.js';
import { DatabaseService } from './database/database.service.js';

@Controller()
export class AppController {
  constructor(
    @Inject(AppService) private readonly appService: AppService,
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth() {
    const db = await this.database.healthCheck();
    return {
      status: 'ok',
      service: 'neura-folio-backend',
      database: db,
    };
  }
}
