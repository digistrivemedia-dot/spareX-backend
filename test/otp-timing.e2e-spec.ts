import { createTestApp, type TestApp } from './support/test-app';

describe('OTP resend gap and expiry (e2e)', () => {
  let test: TestApp;

  beforeAll(async () => {
    // A one-second code, so expiry can be tested without waiting five minutes.
    test = await createTestApp({ OTP_TTL_SECONDS: 1 });
  });

  afterAll(() => test.close());

  it('refuses a second code to the same number within 30 seconds', async () => {
    await test.http().post('/v1/b2c/auth/otp').send({ mobile: '9100000001' }).expect(200);
    const again = await test
      .http()
      .post('/v1/b2c/auth/otp')
      .send({ mobile: '9100000001' })
      .expect(429);
    expect(again.body.code).toBe('OTP_RESEND_TOO_SOON');
    expect(again.body.message).toMatch(/^Wait \d+ seconds before asking for another code\.$/);
  });

  it('rejects a code once it has expired', async () => {
    await test.http().post('/v1/b2c/auth/otp').send({ mobile: '9100000002' }).expect(200);
    const code = test.sms.lastCode('+919100000002');
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    const response = await test
      .http()
      .post('/v1/b2c/auth/otp/verify')
      .send({ mobile: '9100000002', otp: code, name: 'Late' })
      .expect(422);
    expect(response.body.code).toBe('OTP_EXPIRED');
  });
});
