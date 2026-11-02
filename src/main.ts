import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { AppConfig } from './config/app-config.service';
import { serveOpenApiDocuments } from './openapi';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  configureApp(app);
  const config = app.get(AppConfig);
  if (!config.isProduction) serveOpenApiDocuments(app);
  await app.listen(config.get('PORT'));
}

void bootstrap();
