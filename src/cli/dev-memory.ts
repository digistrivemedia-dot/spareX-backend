import { spawn } from 'node:child_process';

import { MongoMemoryReplSet } from 'mongodb-memory-server';

/** Contains "_dev", so the seed accepts it. */
const DATABASE_NAME = 'kannali_dev_memory';

function run(script: string, args: string[], env: NodeJS.ProcessEnv): Promise<number> {
  const child = spawn(process.execPath, [script, ...args], { env, stdio: 'inherit' });
  return new Promise((resolve) => child.on('exit', (code) => resolve(code ?? 1)));
}

/**
 * `npm run dev:memory`: for working before an Atlas database exists. Starts an in-memory replica set, seeds it,
 * and runs the app with watch against it. Nothing is kept after stopping.
 */
async function devMemory(): Promise<void> {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const env = { ...process.env, NODE_ENV: 'development', MONGO_URI: replSet.getUri(DATABASE_NAME) };
  console.log(`In-memory MongoDB replica set running; database ${DATABASE_NAME}.`);

  const stop = async (code: number) => {
    await replSet.stop();
    process.exit(code);
  };
  process.on('SIGINT', () => void stop(0));
  process.on('SIGTERM', () => void stop(0));

  if ((await run('dist/seed/seed', [], env)) !== 0) return stop(1);
  const nest = require.resolve('@nestjs/cli/bin/nest.js');
  await stop(await run(nest, ['start', '--watch'], env));
}

void devMemory();
