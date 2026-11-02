import { AdminUser } from '../src/modules/admin-users/admin-users.schema';
import {
  adminEmail,
  adminToken,
  createTestApp,
  seedAdmins,
  TEST_PASSWORD,
  type TestApp,
} from './support/test-app';

describe('Admin sign-in and account (e2e)', () => {
  let test: TestApp;

  beforeAll(async () => {
    // Several tests send codes to the same phone within seconds; the resend gap has its own test.
    test = await createTestApp({ OTP_RESEND_SECONDS: 0 });
    await seedAdmins(test.connection, [
      { id: 'adm_kiran' },
      { id: 'adm_locky' },
      { id: 'adm_ravi', roleId: 'super-admin', twoStepEnabled: true },
      { id: 'adm_meera', twoStepEnabled: true },
      { id: 'adm_ananya', status: 'inactive' },
      { id: 'adm_nobody', roleId: 'no-access' },
      { id: 'adm_reset' },
      { id: 'adm_changer' },
    ]);
  });

  afterAll(() => test.close());

  const signIn = (email: string, password: string) =>
    test.http().post('/v1/admin/auth/sign-in').send({ email, password });

  it('signs in with email and password and returns the admin from /auth/me', async () => {
    const token = await adminToken(test, 'adm_kiran');
    const me = await test
      .http()
      .get('/v1/admin/auth/me')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(me.body).toMatchObject({ id: 'adm_kiran', roleId: 'admin', status: 'active' });
    expect(me.body).not.toHaveProperty('passwordHash');
    expect(me.body).not.toHaveProperty('_id');
  });

  it('rejects a wrong password without saying whether the email exists', async () => {
    const wrongPassword = await signIn(adminEmail('adm_kiran'), 'Wrong@1234').expect(401);
    const unknownEmail = await signIn('nobody@kannaligarage.in', 'Wrong@1234').expect(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('locks the account after 5 wrong passwords, even against the right password', async () => {
    for (let attempt = 1; attempt <= 4; attempt++) {
      await signIn(adminEmail('adm_locky'), 'Wrong@1234').expect(401);
    }
    const fifth = await signIn(adminEmail('adm_locky'), 'Wrong@1234').expect(422);
    expect(fifth.body.code).toBe('ACCOUNT_LOCKED');
    const correct = await signIn(adminEmail('adm_locky'), TEST_PASSWORD).expect(422);
    expect(correct.body.code).toBe('ACCOUNT_LOCKED');
  });

  it('counts wrong passwords sent at the same moment without losing any', async () => {
    await test.connection
      .model(AdminUser.name)
      .updateOne({ _id: 'adm_locky' }, { $set: { failedSignIns: 0, lockedUntil: null } });
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => signIn(adminEmail('adm_locky'), 'Wrong@1234')),
    );
    expect(responses.filter((response) => response.status === 422)).toHaveLength(1);
    await signIn(adminEmail('adm_locky'), TEST_PASSWORD).expect(422);
  });

  it('refuses an inactive admin', async () => {
    const response = await signIn(adminEmail('adm_ananya'), TEST_PASSWORD).expect(403);
    expect(response.body.code).toBe('ACCOUNT_INACTIVE');
  });

  describe('2-step verification', () => {
    it('requires a code for a Super Admin and signs in with it', async () => {
      const first = await signIn(adminEmail('adm_ravi'), TEST_PASSWORD).expect(200);
      expect(first.body).toEqual({ kind: 'two_step_required', challengeId: expect.any(String) });

      const challenge = await test
        .http()
        .get(`/v1/admin/auth/two-step/${first.body.challengeId}`)
        .expect(200);
      expect(challenge.body.maskedPhone).toMatch(/^\+91 \d\d••• ••\d{3}$/);
      const code = test.sms.lastCode('+919845010002');
      expect(challenge.body.demoCode).toBe(code);

      const verified = await test
        .http()
        .post('/v1/admin/auth/two-step/verify')
        .send({ challengeId: first.body.challengeId, code })
        .expect(200);
      expect(verified.body).toEqual({ kind: 'signed_in', token: expect.any(String) });
    });

    it('rejects a wrong code and accepts a code only once', async () => {
      const first = await signIn(adminEmail('adm_meera'), TEST_PASSWORD).expect(200);
      const { challengeId } = first.body;
      const code = test.sms.lastCode('+919845010003');
      const wrongCode = code.replace(/.$/, (digit) => String((Number(digit) + 1) % 10));
      const wrong = await test
        .http()
        .post('/v1/admin/auth/two-step/verify')
        .send({ challengeId, code: wrongCode })
        .expect(422);
      expect(wrong.body.code).toBe('OTP_INVALID');

      const [a, b] = await Promise.all([
        test.http().post('/v1/admin/auth/two-step/verify').send({ challengeId, code }),
        test.http().post('/v1/admin/auth/two-step/verify').send({ challengeId, code }),
      ]);
      const winners = [a, b].filter((response) => response.status === 200);
      const loser = a.status === 200 ? b : a;
      expect(winners).toHaveLength(1);
      expect(['OTP_EXPIRED', 'NOT_FOUND']).toContain(loser.body.code);
    });

    it("can't be turned off for a Super Admin", async () => {
      const first = await signIn(adminEmail('adm_ravi'), TEST_PASSWORD).expect(200);
      const verified = await test
        .http()
        .post('/v1/admin/auth/two-step/verify')
        .send({ challengeId: first.body.challengeId, code: test.sms.lastCode('+919845010002') })
        .expect(200);
      const response = await test
        .http()
        .patch('/v1/admin/me/two-step')
        .auth(verified.body.token, { type: 'bearer' })
        .send({ enabled: false })
        .expect(422);
      expect(response.body.code).toBe('TWO_STEP_REQUIRED');
    });
  });

  it('stops a token working once the admin signs out', async () => {
    const token = await adminToken(test, 'adm_kiran');
    await test.http().post('/v1/admin/auth/sign-out').auth(token, { type: 'bearer' }).expect(204);
    const after = await test
      .http()
      .get('/v1/admin/auth/me')
      .auth(token, { type: 'bearer' })
      .expect(401);
    expect(after.body.code).toBe('UNAUTHENTICATED');
  });

  it('denies an admin without the permission', async () => {
    const token = await adminToken(test, 'adm_nobody');
    const response = await test
      .http()
      .get('/v1/admin/audit-log')
      .auth(token, { type: 'bearer' })
      .expect(403);
    expect(response.body).toEqual({
      message: "You don't have permission to do this.",
      code: 'FORBIDDEN',
    });
  });

  it('records sign-ins in the audit log and filters it by actor', async () => {
    const token = await adminToken(test, 'adm_kiran');
    const response = await test
      .http()
      .get('/v1/admin/audit-log')
      .query({ actor: 'adm_kiran', action: 'sign_in', pageSize: 10 })
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(response.body).toMatchObject({ page: 1, pageSize: 10 });
    expect(response.body.total).toBeGreaterThan(0);
    expect(response.body.items[0]).toMatchObject({
      actor: { type: 'admin', id: 'adm_kiran' },
      action: 'sign_in',
      entity: 'admin_user',
    });
  });

  describe('password reset', () => {
    it('resets with a link that works once, and signs the admin out everywhere', async () => {
      const oldToken = await adminToken(test, 'adm_reset');
      const requested = await test
        .http()
        .post('/v1/admin/auth/password-reset')
        .send({ email: adminEmail('adm_reset') })
        .expect(200);
      const resetToken: string = requested.body.demoToken;
      expect(resetToken).toEqual(expect.any(String));

      const [a, b] = await Promise.all([
        test
          .http()
          .post('/v1/admin/auth/password-reset/confirm')
          .send({ token: resetToken, password: 'Fresh@5678' }),
        test
          .http()
          .post('/v1/admin/auth/password-reset/confirm')
          .send({ token: resetToken, password: 'Fresh@5678' }),
      ]);
      expect([a.status, b.status].sort()).toEqual([204, 422]);

      await test.http().get('/v1/admin/auth/me').auth(oldToken, { type: 'bearer' }).expect(401);
      await signIn(adminEmail('adm_reset'), 'Fresh@5678').expect(200);
    });

    it('answers the same for an unknown email', async () => {
      const response = await test
        .http()
        .post('/v1/admin/auth/password-reset')
        .send({ email: 'nobody@kannaligarage.in' })
        .expect(200);
      expect(response.body).toEqual({ demoToken: null });
    });
  });

  it('changes the password after checking the current one, signing out other devices', async () => {
    const thisDevice = await adminToken(test, 'adm_changer');
    const otherDevice = await adminToken(test, 'adm_changer');

    const wrong = await test
      .http()
      .post('/v1/admin/me/password')
      .auth(thisDevice, { type: 'bearer' })
      .send({ currentPassword: 'Wrong@1234', newPassword: 'Newer@5678' })
      .expect(400);
    expect(wrong.body.fieldErrors).toEqual({
      currentPassword: ['Your current password is incorrect.'],
    });

    await test
      .http()
      .post('/v1/admin/me/password')
      .auth(thisDevice, { type: 'bearer' })
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'Newer@5678' })
      .expect(204);
    await test.http().get('/v1/admin/auth/me').auth(thisDevice, { type: 'bearer' }).expect(200);
    await test.http().get('/v1/admin/auth/me').auth(otherDevice, { type: 'bearer' }).expect(401);
  });

  it('updates the profile, normalising the mobile number', async () => {
    const token = await adminToken(test, 'adm_kiran');
    const response = await test
      .http()
      .patch('/v1/admin/me')
      .auth(token, { type: 'bearer' })
      .send({ name: 'Kiran G', phone: '97413 56789' })
      .expect(200);
    expect(response.body).toMatchObject({ name: 'Kiran G', phone: '+919741356789' });
  });
});
