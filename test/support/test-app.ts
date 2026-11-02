import { randomBytes } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Connection } from 'mongoose';
import request from 'supertest';

import { ROLES } from '../../seed/data/roles';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { AppConfig } from '../../src/config/app-config.service';
import type { Env } from '../../src/config/env';
import { SmsSender } from '../../src/infra/sms/sms.module';
import { AdminUser } from '../../src/modules/admin-users/admin-users.schema';
import { hashPassword } from '../../src/modules/auth/password';
import { Role } from '../../src/modules/roles/roles.schema';

/** Collects every SMS instead of sending it, so tests can read the codes. */
export class CapturingSmsSender extends SmsSender {
  readonly messages: { phone: string; message: string }[] = [];

  send(phone: string, message: string): Promise<void> {
    this.messages.push({ phone, message });
    return Promise.resolve();
  }

  /** The code in the latest SMS to this number. */
  lastCode(phone: string): string {
    const sms = [...this.messages].reverse().find((candidate) => candidate.phone === phone);
    const code = sms?.message.match(/^\d+/)?.[0];
    if (!code) throw new Error(`No code was sent to ${phone}`);
    return code;
  }
}

/** Defaults every test file shares; a file's own overrides win. */
const TEST_DEFAULTS: Partial<Env> = {
  LOG_LEVEL: 'silent',
  RATE_LIMIT_PER_MINUTE: 10_000,
  RATE_LIMIT_AUTH_PER_MINUTE: 10_000,
  RATE_LIMIT_AUTH_PER_IDENTITY_PER_HOUR: 10_000,
};

/** The real config with a test file's values on top. */
class TestConfig extends AppConfig {
  constructor(
    config: ConfigService<Env, true>,
    private readonly overrides: Partial<Env>,
  ) {
    super(config);
  }

  override get<K extends keyof Env>(key: K): Env[K] {
    const value = this.overrides[key];
    return value === undefined ? super.get(key) : value;
  }
}

export type TestApp = {
  app: NestExpressApplication;
  http: () => ReturnType<typeof request>;
  sms: CapturingSmsSender;
  /** The folder the local-disk storage writes to; removed by `close`. */
  uploadsDir: string;
  connection: Connection;
  close: () => Promise<void>;
};

/**
 * Boots the whole app against its own database on the shared in-memory replica set, with uploads in its own
 * temporary folder. `close` drops both.
 */
export async function createTestApp(overrides: Partial<Env> = {}): Promise<TestApp> {
  const name = `sparex_test_${randomBytes(6).toString('hex')}`;
  const mongoUri = new URL(process.env.MONGO_URI ?? '');
  mongoUri.pathname = `/${name}`;

  const sms = new CapturingSmsSender();
  const uploadsDir = join(tmpdir(), name);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AppConfig)
    .useFactory({
      inject: [ConfigService],
      factory: (config: ConfigService<Env, true>) =>
        new TestConfig(config, {
          ...TEST_DEFAULTS,
          ...overrides,
          MONGO_URI: mongoUri.toString(),
          LOCAL_UPLOADS_DIR: uploadsDir,
        }),
    })
    .overrideProvider(SmsSender)
    .useValue(sms)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  const connection = app.get<Connection>(getConnectionToken());
  await Promise.all(Object.values(connection.models).map((model) => model.syncIndexes()));

  return {
    app,
    http: () => request(app.getHttpServer()),
    sms,
    uploadsDir,
    connection,
    close: async () => {
      await connection.dropDatabase();
      await app.close();
      await rm(uploadsDir, { recursive: true, force: true });
    },
  };
}

export const TEST_PASSWORD = 'Test@1234';

type AdminSeed = {
  id: string;
  roleId?: string;
  status?: 'active' | 'inactive' | 'invited';
  twoStepEnabled?: boolean;
};

/** Loads the two real roles plus `no-access` (a role with no permissions), and the given admins. */
export async function seedAdmins(connection: Connection, admins: AdminSeed[]): Promise<void> {
  await connection.model<Role>(Role.name).insertMany([
    ...ROLES,
    {
      _id: 'no-access',
      name: 'No access',
      description: 'Test role',
      twoStepRequired: false,
      permissions: [],
    },
  ]);
  const passwordHash = await hashPassword(TEST_PASSWORD);
  await connection.model<AdminUser>(AdminUser.name).insertMany(
    admins.map((admin, index) => ({
      _id: admin.id,
      name: `Admin ${admin.id}`,
      email: `${admin.id}@kannaligarage.in`,
      phone: `+9198450${String(10000 + index)}`,
      roleId: admin.roleId ?? 'admin',
      status: admin.status ?? 'active',
      twoStepEnabled: admin.twoStepEnabled ?? false,
      passwordHash,
    })),
  );
}

export function adminEmail(id: string): string {
  return `${id}@kannaligarage.in`;
}

/** Signs an admin in (one without 2-step) and returns the session token. */
export async function adminToken(test: TestApp, id: string): Promise<string> {
  const response = await test
    .http()
    .post('/v1/admin/auth/sign-in')
    .send({ email: adminEmail(id), password: TEST_PASSWORD })
    .expect(200);
  return response.body.token as string;
}

/** Signs a customer in by OTP (creating the account for a new number) and returns the session token. */
export async function customerToken(
  test: TestApp,
  mobile: string,
  userAgent = 'jest',
): Promise<string> {
  await test.http().post('/v1/b2c/auth/otp').send({ mobile }).expect(200);
  const response = await test
    .http()
    .post('/v1/b2c/auth/otp/verify')
    .set('User-Agent', userAgent)
    .send({ mobile, otp: test.sms.lastCode(`+91${mobile}`), name: 'Test Customer' })
    .expect(200);
  return response.body.token as string;
}
