import { memoryServer } from './global-setup';

export default async function globalTeardown(): Promise<void> {
  await memoryServer.__mongoReplSet?.stop();
}
