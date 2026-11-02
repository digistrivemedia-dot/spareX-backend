import { HttpStatus, Injectable } from '@nestjs/common';

import { AppError, ErrorCode } from '../../common/errors/app-error';
import type { ActorRef } from '../../common/http/auth-decorators';
import type { Customer } from '../customers/customers.schema';
import { CustomersService } from '../customers/customers.service';
import { B2cUserView } from '../customers/dto/b2c-customer.dto';
import { type ClientInfo, SessionsService } from '../sessions/sessions.service';
import type { B2cSessionView, OtpRequestView, OtpVerificationView } from './dto/b2c-auth.dto';
import { OtpService } from './otp.service';

/** B2C sign-in by mobile number and SMS code. A new number creates the account. */
@Injectable()
export class B2cAuthService {
  constructor(
    private readonly customers: CustomersService,
    private readonly sessions: SessionsService,
    private readonly otp: OtpService,
  ) {}

  /** Sends a sign-in code to the 10-digit number. */
  async requestOtp(mobile: string): Promise<OtpRequestView> {
    const phone = `+91${mobile}`;
    const customer = await this.customers.findByPhone(phone);
    if (customer) this.assertActive(customer);
    const sent = await this.otp.send({
      purpose: 'b2c-sign-in',
      phone,
      message: (code) => `${code} is your SpareX sign-in code. Don't share it with anyone.`,
    });
    return { isNewUser: !customer, resendAfterSeconds: sent.resendAfterSeconds };
  }

  /** Checks the code, creates the account for a new number, and opens a session. */
  async verifyOtp(
    mobile: string,
    code: string,
    name: string | null,
    client: ClientInfo,
  ): Promise<OtpVerificationView> {
    const phone = `+91${mobile}`;
    const existing = await this.customers.findByPhone(phone);
    // Checked before the code, so a missing name doesn't use up a valid code.
    if (!existing && !name) {
      throw new AppError(
        ErrorCode.NameRequired,
        'Tell us your name, so we know what to call you.',
        HttpStatus.UNPROCESSABLE_ENTITY,
        {
          name: ['Tell us your name, so we know what to call you.'],
        },
      );
    }
    await this.otp.verifyLatest('b2c-sign-in', phone, code);

    const customer = existing ?? (await this.customers.createWithPhone(phone, name ?? ''));
    this.assertActive(customer);
    const token = await this.sessions.create('b2c', customer._id, client);
    return { token, user: B2cUserView.from(customer) };
  }

  /** The signed-in customer. */
  async session(actor: ActorRef): Promise<B2cSessionView> {
    const customer = await this.customers.findById(actor.id);
    if (!customer) throw AppError.unauthenticated();
    return { user: B2cUserView.from(customer) };
  }

  /** Ends this session, so the token stops working even if it was copied. */
  logout(actor: ActorRef, sessionId: string): Promise<void> {
    return this.sessions.revoke('b2c', actor.id, sessionId);
  }

  private assertActive(customer: Customer): void {
    if (customer.status !== 'active') {
      throw new AppError(
        ErrorCode.AccountInactive,
        'This account is not active. Contact Kannali support for help.',
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
