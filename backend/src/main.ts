import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`NeuraFolio backend listening on http://localhost:${port}`);
}

await bootstrap();
