import { Customer } from '../src/modules/customers/customers.schema';
import {
  adminToken,
  createTestApp,
  customerToken,
  seedAdmins,
  type TestApp,
} from './support/test-app';

const CHROME_ON_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const SAFARI_ON_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

const HOME = {
  label: 'Home',
  name: 'Arjun Rao',
  mobile: '9845012345',
  pin: '560066',
  line1: 'Flat 304, Sai Krupa Residency, 4th Cross',
  area: 'Whitefield',
  city: 'Bengaluru',
  state: 'Karnataka',
  isDefault: true,
};

describe('B2C sign-in and account (e2e)', () => {
  let test: TestApp;

  beforeAll(async () => {
    // Codes are requested back to back here; the resend gap has its own test file.
    test = await createTestApp({ OTP_RESEND_SECONDS: 0 });
    await seedAdmins(test.connection, [{ id: 'adm_kiran' }]);
  });

  afterAll(() => test.close());

  const requestOtp = (mobile: string) => test.http().post('/v1/b2c/auth/otp').send({ mobile });
  const verifyOtp = (mobile: string, otp: string, name: string | null = null) =>
    test.http().post('/v1/b2c/auth/otp/verify').send({ mobile, otp, name });
  const wrong = (code: string) => code.replace(/.$/, (digit) => String((Number(digit) + 1) % 10));

  it('creates the account for a new number, with the name given', async () => {
    const requested = await requestOtp('9000000001').expect(200);
    expect(requested.body).toEqual({ isNewUser: true, resendAfterSeconds: 0 });

    const verified = await verifyOtp('9000000001', test.sms.lastCode('+919000000001'), 'Sneha K');
    expect(verified.status).toBe(200);
    expect(verified.body.user).toMatchObject({
      name: 'Sneha K',
      mobile: '9000000001',
      email: null,
    });

    const again = await requestOtp('9000000001').expect(200);
    expect(again.body.isNewUser).toBe(false);
  });

  it('asks a new number for a name before using up the code', async () => {
    await requestOtp('9000000002').expect(200);
    const code = test.sms.lastCode('+919000000002');
    const withoutName = await verifyOtp('9000000002', code).expect(422);
    expect(withoutName.body.code).toBe('NAME_REQUIRED');
    await verifyOtp('9000000002', code, 'Rahul M').expect(200);
  });

  it('rejects a wrong code and says how many tries are left', async () => {
    await requestOtp('9000000003').expect(200);
    const response = await verifyOtp(
      '9000000003',
      wrong(test.sms.lastCode('+919000000003')),
      'X Y',
    );
    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      code: 'OTP_INVALID',
      message: 'The code is incorrect. You have 4 tries left.',
    });
  });

  it('kills the code after 5 wrong tries, so even the right code then fails', async () => {
    await requestOtp('9000000004').expect(200);
    const code = test.sms.lastCode('+919000000004');
    for (let attempt = 1; attempt <= 4; attempt++) {
      await verifyOtp('9000000004', wrong(code), 'X Y').expect(422);
    }
    const fifth = await verifyOtp('9000000004', wrong(code), 'X Y').expect(422);
    expect(fifth.body.code).toBe('OTP_ATTEMPTS_EXCEEDED');
    const right = await verifyOtp('9000000004', code, 'X Y').expect(422);
    expect(right.body.code).toBe('OTP_ATTEMPTS_EXCEEDED');
  });

  it('lets a code sign in once, even when it is sent twice at the same moment', async () => {
    await requestOtp('9000000005').expect(200);
    const code = test.sms.lastCode('+919000000005');
    const responses = await Promise.all([
      verifyOtp('9000000005', code, 'Twice'),
      verifyOtp('9000000005', code, 'Twice'),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 422]);
    expect(
      await test.connection.model(Customer.name).countDocuments({ phone: '+919000000005' }),
    ).toBe(1);
  });

  it('stops sending codes to a number after 5 in an hour', async () => {
    for (let send = 1; send <= 5; send++) await requestOtp('9000000006').expect(200);
    const sixth = await requestOtp('9000000006').expect(429);
    expect(sixth.body.code).toBe('OTP_SEND_LIMIT');
  });

  it('refuses a deactivated customer', async () => {
    await test.connection
      .model(Customer.name)
      .create({ phone: '+919000000007', name: 'Anjali', status: 'inactive' });
    const response = await requestOtp('9000000007').expect(403);
    expect(response.body.code).toBe('ACCOUNT_INACTIVE');
  });

  it('returns the session, and ends it on logout', async () => {
    const token = await customerToken(test, '9000000008');
    const session = await test
      .http()
      .get('/v1/b2c/auth/session')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(session.body.user.mobile).toBe('9000000008');
    await test.http().post('/v1/b2c/auth/logout').auth(token, { type: 'bearer' }).expect(204);
    await test.http().get('/v1/b2c/auth/session').auth(token, { type: 'bearer' }).expect(401);
  });

  it('rejects a token from one surface on another', async () => {
    const customer = await customerToken(test, '9000000009');
    const admin = await adminToken(test, 'adm_kiran');
    await test.http().get('/v1/admin/auth/me').auth(customer, { type: 'bearer' }).expect(401);
    await test.http().get('/v1/b2c/auth/session').auth(admin, { type: 'bearer' }).expect(401);
  });

  describe('devices', () => {
    it('lists devices with this one first, and logs out one or all the others', async () => {
      const laptop = await customerToken(test, '9000000010', CHROME_ON_WINDOWS);
      const phone = await customerToken(test, '9000000010', SAFARI_ON_IPHONE);
      const tablet = await customerToken(test, '9000000010', 'Unknown');

      const listed = await test
        .http()
        .get('/v1/b2c/me/sessions')
        .auth(laptop, { type: 'bearer' })
        .expect(200);
      expect(listed.body).toHaveLength(3);
      expect(listed.body[0]).toMatchObject({
        name: 'Chrome on Windows',
        kind: 'computer',
        isCurrent: true,
      });
      const iphone = listed.body.find(
        (device: { name: string }) => device.name === 'Safari on iPhone',
      );

      await test
        .http()
        .delete(`/v1/b2c/me/sessions/${iphone.id}`)
        .auth(laptop, { type: 'bearer' })
        .expect(204);
      await test.http().get('/v1/b2c/auth/session').auth(phone, { type: 'bearer' }).expect(401);

      await test
        .http()
        .delete('/v1/b2c/me/sessions/others')
        .auth(laptop, { type: 'bearer' })
        .expect(204);
      await test.http().get('/v1/b2c/auth/session').auth(tablet, { type: 'bearer' }).expect(401);
      await test.http().get('/v1/b2c/auth/session').auth(laptop, { type: 'bearer' }).expect(200);
    });

    it("can't log out someone else's device", async () => {
      const mine = await customerToken(test, '9000000011');
      const theirs = await customerToken(test, '9000000012');
      const [theirDevice] = (
        await test.http().get('/v1/b2c/me/sessions').auth(theirs, { type: 'bearer' }).expect(200)
      ).body;
      await test
        .http()
        .delete(`/v1/b2c/me/sessions/${theirDevice.id}`)
        .auth(mine, { type: 'bearer' })
        .expect(404);
      await test.http().get('/v1/b2c/auth/session').auth(theirs, { type: 'bearer' }).expect(200);
    });
  });

  describe('addresses', () => {
    it('keeps exactly one default, the default listed first', async () => {
      const token = await customerToken(test, '9000000013');
      const home = await test
        .http()
        .post('/v1/b2c/me/addresses')
        .auth(token, { type: 'bearer' })
        .send(HOME)
        .expect(201);
      const work = await test
        .http()
        .post('/v1/b2c/me/addresses')
        .auth(token, { type: 'bearer' })
        .send({ ...HOME, label: 'Work', pin: '560037', isDefault: true })
        .expect(201);

      const listed = await test
        .http()
        .get('/v1/b2c/me/addresses')
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(
        listed.body.map((address: { id: string; isDefault: boolean }) => [
          address.id,
          address.isDefault,
        ]),
      ).toEqual([
        [work.body.id, true],
        [home.body.id, false],
      ]);

      await test
        .http()
        .delete(`/v1/b2c/me/addresses/${work.body.id}`)
        .auth(token, { type: 'bearer' })
        .expect(204);
      const after = await test
        .http()
        .get(`/v1/b2c/me/addresses/${home.body.id}`)
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(after.body.isDefault).toBe(true);
    });

    it("can't read, change or delete another customer's address", async () => {
      const owner = await customerToken(test, '9000000014');
      const stranger = await customerToken(test, '9000000015');
      const address = await test
        .http()
        .post('/v1/b2c/me/addresses')
        .auth(owner, { type: 'bearer' })
        .send(HOME)
        .expect(201);
      const path = `/v1/b2c/me/addresses/${address.body.id}`;

      await test.http().get(path).auth(stranger, { type: 'bearer' }).expect(404);
      await test.http().put(path).auth(stranger, { type: 'bearer' }).send(HOME).expect(404);
      await test.http().delete(path).auth(stranger, { type: 'bearer' }).expect(404);
      await test.http().get(path).auth(owner, { type: 'bearer' }).expect(200);
    });

    it('explains every invalid field', async () => {
      const token = await customerToken(test, '9000000016');
      const response = await test
        .http()
        .post('/v1/b2c/me/addresses')
        .auth(token, { type: 'bearer' })
        .send({ ...HOME, pin: '12345', mobile: '+919845012345' })
        .expect(400);
      expect(response.body.code).toBe('VALIDATION_FAILED');
      expect(response.body.fieldErrors).toEqual({
        pin: ['Enter a valid 6-digit PIN code.'],
        mobile: ['Enter a 10-digit mobile number, without +91.'],
      });
    });
  });

  it('updates the profile, turning cleared fields into null', async () => {
    const token = await customerToken(test, '9000000017');
    const response = await test
      .http()
      .patch('/v1/b2c/me')
      .auth(token, { type: 'bearer' })
      .send({ name: 'Divya Hegde', email: '', gstin: '29ABCDE1234F1Z5' })
      .expect(200);
    expect(response.body).toMatchObject({
      name: 'Divya Hegde',
      email: null,
      gstin: '29ABCDE1234F1Z5',
    });
  });
});
