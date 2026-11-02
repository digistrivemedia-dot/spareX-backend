import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

import { AppModule } from '../app.module';

/**
 * Creates or updates every collection's indexes from the schemas (and drops indexes no schema declares). Staging
 * and production run this on deploy, since autoIndex is off there.
 */
async function syncIndexes(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const connection = app.get<Connection>(getConnectionToken());
    for (const model of Object.values(connection.models)) {
      const dropped = await model.syncIndexes();
      console.log(
        `${model.collection.collectionName}: indexes in sync${dropped.length ? `, dropped ${dropped.join(', ')}` : ''}`,
      );
    }
  } finally {
    await app.close();
  }
}

syncIndexes().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
