import { MongoMemoryReplSet } from 'mongodb-memory-server';

/** Holds the replica set between Jest's global setup and teardown, which share this process. */
export const memoryServer = globalThis as typeof globalThis & {
  __mongoReplSet?: MongoMemoryReplSet;
};

/**
 * One in-memory replica set for the whole test run (so transactions work, with nothing installed). Each test file
 * then uses its own database on it. Workers inherit MONGO_URI from this process.
 */
export default async function globalSetup(): Promise<void> {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  memoryServer.__mongoReplSet = replSet;
  process.env.MONGO_URI = replSet.getUri();
}
