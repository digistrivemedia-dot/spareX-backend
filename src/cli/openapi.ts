import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const OUTPUT_DIR = 'openapi';

/**
 * Writes openapi/admin.json, openapi/b2c.json and openapi/b2b.json for the frontend teams. The app needs a database
 * to boot, so this starts an in-memory one and never touches Atlas.
 */
async function writeDocuments(): Promise<void> {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGO_URI = replSet.getUri('openapi');
  // Loaded after MONGO_URI is set: ConfigModule reads the environment when the app module is first loaded.
  const [{ AppModule }, { configureApp }, { buildOpenApiDocuments }] = await Promise.all([
    import('../app.module.js'),
    import('../app.setup.js'),
    import('../openapi.js'),
  ]);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    configureApp(app);
    await mkdir(OUTPUT_DIR, { recursive: true });
    for (const [surface, document] of Object.entries(buildOpenApiDocuments(app))) {
      const file = join(OUTPUT_DIR, `${surface}.json`);
      await writeFile(file, `${JSON.stringify(document, null, 2)}\n`);
      console.log(`Wrote ${file} (${Object.keys(document.paths).length} paths)`);
    }
  } finally {
    await app.close();
    await replSet.stop();
  }
}

writeDocuments().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
