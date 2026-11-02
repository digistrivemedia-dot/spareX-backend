import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

import { AppModule } from '../src/app.module';
import { AppConfig } from '../src/config/app-config.service';
import { NodeEnv } from '../src/config/env';
import { AdminUser } from '../src/modules/admin-users/admin-users.schema';
import { AuditEntry } from '../src/modules/audit/audit.schema';
import { hashPassword } from '../src/modules/auth/password';
import { Customer } from '../src/modules/customers/customers.schema';
import { Role } from '../src/modules/roles/roles.schema';
import { ADMIN_USERS, DEMO_ADMIN_PASSWORD } from './data/admin-users';
import { AUDIT_ENTRIES } from './data/audit-entries';
import { CUSTOMERS_SEED } from './data/customers';
import { ROLES } from './data/roles';
import { daysAgo } from './time';

/** Only developers' own databases on the shared Atlas cluster carry this in their name (CLAUDE.md §4). */
const DEV_DATABASE_MARK = '_dev';

/** Wipes the configured database and loads the demo data the frontends' mocks show. */
async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const config = app.get(AppConfig);
    const connection = app.get<Connection>(getConnectionToken());
    // Two locks, so a copied staging or production URI can never be wiped: the environment and the database name.
    if (
      config.get('NODE_ENV') !== NodeEnv.Development ||
      !connection.name.includes(DEV_DATABASE_MARK)
    ) {
      throw new Error(
        `Refusing to seed "${connection.name}": needs NODE_ENV=development and "${DEV_DATABASE_MARK}" in the database name.`,
      );
    }
    await connection.dropDatabase();
    for (const model of Object.values(connection.models)) await model.syncIndexes();

    const passwordHash = await hashPassword(DEMO_ADMIN_PASSWORD);
    const names = new Map(ADMIN_USERS.map((user) => [user._id, user.name]));

    await connection.model(Role.name).insertMany(ROLES);
    await connection
      .model(AdminUser.name)
      .insertMany(ADMIN_USERS.map((user) => ({ ...user, passwordHash })));
    await connection.model(Customer.name).insertMany(CUSTOMERS_SEED);
    await connection.model(AuditEntry.name).insertMany(
      AUDIT_ENTRIES.map(({ id, days, hour, minute, actorId, ...entry }) => ({
        ...entry,
        _id: id,
        at: daysAgo(days, hour, minute),
        actor: { type: 'admin', id: actorId, name: names.get(actorId) ?? actorId },
      })),
    );

    console.log(
      `Seeded ${ROLES.length} roles, ${ADMIN_USERS.length} admin users, ${CUSTOMERS_SEED.length} customers, ` +
        `${AUDIT_ENTRIES.length} audit entries. Admin password: ${DEMO_ADMIN_PASSWORD}`,
    );
  } finally {
    await app.close();
  }
}

seed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
