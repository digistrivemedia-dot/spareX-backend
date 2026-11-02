import type { ClientSession, Connection } from 'mongoose';

/**
 * Runs `work` in one MongoDB transaction, retried on transient errors. Every flow that changes money, stock or a
 * number sequence goes through here and passes `session` to every operation inside.
 */
export function withTransaction<T>(
  connection: Connection,
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  return connection.transaction(work);
}
