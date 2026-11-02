import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { withTransaction } from '../src/common/database/transaction';
import { AuditEntry } from '../src/modules/audit/audit.schema';
import { adminToken, createTestApp, seedAdmins, type TestApp } from './support/test-app';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

describe('Platform: health, errors, uploads, audit, transactions (e2e)', () => {
  let test: TestApp;
  let token: string;

  beforeAll(async () => {
    // Low per-IP limit on sign-in routes, to see the limiter answer.
    test = await createTestApp({ RATE_LIMIT_AUTH_PER_MINUTE: 3 });
    await seedAdmins(test.connection, [
      { id: 'adm_kiran' },
      { id: 'adm_nobody', roleId: 'no-access' },
    ]);
    token = await adminToken(test, 'adm_kiran');
  });

  afterAll(() => test.close());

  it('reports MongoDB as up on /health, outside /v1', async () => {
    const response = await test.http().get('/health').expect(200);
    expect(response.body.status).toBe('ok');
    expect(Object.keys(response.body.info)).toEqual(['mongodb']);
  });

  it('answers an unknown route in the standard error shape', async () => {
    const response = await test.http().get('/v1/admin/nothing-here').expect(404);
    expect(response.body).toEqual({ message: 'We could not find that.', code: 'NOT_FOUND' });
  });

  it('rejects fields a DTO does not declare', async () => {
    const response = await test
      .http()
      .post('/v1/admin/auth/sign-in')
      .send({ email: 'x@kannaligarage.in', password: 'x', isAdmin: true })
      .expect(400);
    expect(response.body.fieldErrors).toEqual({ isAdmin: ['property isAdmin should not exist'] });
  });

  it('requires a session unless an endpoint is public', async () => {
    const response = await test.http().get('/v1/admin/audit-log').expect(401);
    expect(response.body.code).toBe('UNAUTHENTICATED');
  });

  describe('uploads', () => {
    const upload = (visibility?: 'public' | 'private') => {
      const call = test.http().post('/v1/admin/uploads').auth(token, { type: 'bearer' });
      if (visibility) call.field('visibility', visibility);
      return call.attach('file', PNG, {
        filename: '../../etc/brake pads.png',
        contentType: 'image/png',
      });
    };
    /** The path part of a file URL, which the test server answers. */
    const pathOf = (url: string) => {
      const parsed = new URL(url);
      return `${parsed.pathname}${parsed.search}`;
    };

    it('stores a private file under a random key and serves it only through a signed link', async () => {
      const response = await upload().expect(201);
      expect(response.body).toMatchObject({
        name: 'brake pads.png',
        visibility: 'private',
        mimeType: 'image/png',
        sizeBytes: PNG.length,
      });
      const url = new URL(response.body.url);
      expect(url.pathname).toMatch(/^\/files\/private\/\d{4}\/\d{2}\/[0-9a-f]{32}\.png$/);
      expect(existsSync(join(test.uploadsDir, url.pathname.replace('/files/', '')))).toBe(true);

      const download = await test.http().get(pathOf(response.body.url)).expect(200);
      expect(Buffer.compare(download.body as Buffer, PNG)).toBe(0);
      expect(download.headers['cache-control']).toBe('private, no-store');

      await test.http().get(url.pathname).expect(403);
      url.searchParams.set('name', 'other.png');
      const tampered = await test.http().get(pathOf(url.toString())).expect(403);
      expect(tampered.body.code).toBe('LINK_EXPIRED');
    });

    it('gives a public file a stable URL that may be cached', async () => {
      const response = await upload('public').expect(201);
      expect(response.body.visibility).toBe('public');
      expect(new URL(response.body.url).search).toBe('');

      const served = await test.http().get(pathOf(response.body.url)).expect(200);
      expect(served.headers['cache-control']).toBe('public, max-age=31536000, immutable');

      const again = await test
        .http()
        .get(`/v1/admin/files/${response.body.id}`)
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(again.body.url).toBe(response.body.url);
    });

    it('answers 404 for a file that does not exist or a key that is not one', async () => {
      await test
        .http()
        .get('/files/public/2026/01/0123456789abcdef0123456789abcdef.png')
        .expect(404);
      await test.http().get('/files/public/2026/01/..%2F..%2Fpackage.json').expect(404);
    });

    it('judges the type by the bytes, not by what the client claims', async () => {
      const response = await test
        .http()
        .post('/v1/admin/uploads')
        .auth(token, { type: 'bearer' })
        .attach('file', Buffer.from('MZ this is a program'), {
          filename: 'photo.png',
          contentType: 'image/png',
        })
        .expect(422);
      expect(response.body.code).toBe('FILE_TYPE_NOT_ALLOWED');
    });
  });

  describe('audit log', () => {
    it('records a CSV export made in the panel', async () => {
      await test
        .http()
        .post('/v1/admin/audit-log')
        .auth(token, { type: 'bearer' })
        .send({
          action: 'export',
          entity: 'order',
          entityId: '',
          entityLabel: 'Orders',
          summary: 'Exported orders to CSV (3 rows)',
          changes: [],
        })
        .expect(204);
      const all = await test
        .http()
        .get('/v1/admin/audit-log/all')
        .query({ action: 'export' })
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(all.body).toHaveLength(1);
      expect(all.body[0]).toMatchObject({ entityLabel: 'Orders', actor: { id: 'adm_kiran' } });
    });

    it('refuses anything but an export from the panel', async () => {
      await test
        .http()
        .post('/v1/admin/audit-log')
        .auth(token, { type: 'bearer' })
        .send({
          action: 'delete',
          entity: 'order',
          entityId: 'ord_1',
          entityLabel: 'x',
          summary: 'x',
          changes: [],
        })
        .expect(400);
    });

    it('rejects a sort field the list does not offer', async () => {
      const response = await test
        .http()
        .get('/v1/admin/audit-log')
        .query({ sort: 'summary.asc' })
        .auth(token, { type: 'bearer' })
        .expect(400);
      expect(response.body.fieldErrors.sort).toEqual(['sort must be one of at, entity, actor']);
    });
  });

  it('commits all of a transaction or none of it', async () => {
    const entries = test.connection.model<AuditEntry>(AuditEntry.name);
    const entry = (summary: string): Partial<AuditEntry> => ({
      actor: { type: 'system', id: 'test', name: 'Test' },
      action: 'update',
      entity: 'settings',
      entityLabel: 'Settings',
      summary,
    });
    await expect(
      withTransaction(test.connection, async (session) => {
        await entries.create([entry('first half')], { session });
        throw new Error('fails half way');
      }),
    ).rejects.toThrow('fails half way');
    expect(await entries.countDocuments({ summary: 'first half' })).toBe(0);

    await withTransaction(test.connection, (session) =>
      entries.create([entry('whole')], { session }),
    );
    expect(await entries.countDocuments({ summary: 'whole' })).toBe(1);
  });

  it('limits sign-in attempts per IP', async () => {
    const attempt = () =>
      test
        .http()
        .post('/v1/admin/auth/sign-in')
        .send({ email: 'adm_nobody@kannaligarage.in', password: 'Wrong@1234' });
    // Four more tries in the same minute: whatever earlier tests used, the last one is over the limit of 3.
    let last = await attempt();
    for (let tries = 1; tries < 4; tries++) last = await attempt();
    expect(last.status).toBe(429);
    expect(last.body.code).toBe('RATE_LIMITED');
  });
});
